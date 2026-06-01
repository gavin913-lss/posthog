import uuid
import datetime as dt
from contextlib import contextmanager
from typing import Any

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from asgiref.sync import sync_to_async
from temporalio.client import ScheduleActionStartWorkflow

from posthog.models import Organization, Team

from products.replay_vision.backend.models.replay_scanner import ReplayScanner, ScannerModel, ScannerType
from products.replay_vision.backend.temporal.constants import (
    SCANNER_SCHEDULE_ID_PREFIX,
    SCANNER_SCHEDULE_INTERVAL,
    SCANNER_SCHEDULE_TYPE,
    scanner_schedule_id,
)
from products.replay_vision.backend.temporal.schedule import (
    _build_schedule,
    _compute_offset,
    a_delete_scanner_schedule,
    a_upsert_scanner_schedule,
    compute_schedule_fingerprint,
)
from products.replay_vision.backend.temporal.sweep_types import SweepScannerInputs

_MODULE = "products.replay_vision.backend.temporal.schedule"


def _make_scanner(**overrides) -> ReplayScanner:
    org = Organization.objects.create(name="vision-schedule-test-org")
    team = Team.objects.create(organization=org, name="vision-schedule-test-team")
    defaults: dict[str, Any] = {
        "team": team,
        "name": "schedule-scanner",
        "scanner_type": ScannerType.MONITOR,
        "scanner_config": {"prompt": "p"},
        "model": ScannerModel.GEMINI_3_FLASH,
    }
    defaults.update(overrides)
    return ReplayScanner.objects.create(**defaults)


@contextmanager
def _patched_temporal(*, exists: bool, delete_side_effect: BaseException | None = None):
    create = AsyncMock()
    update = AsyncMock()
    delete = AsyncMock(side_effect=delete_side_effect)
    with (
        patch(f"{_MODULE}.async_connect", AsyncMock(return_value=MagicMock())),
        patch(f"{_MODULE}.a_schedule_exists", AsyncMock(return_value=exists)) as exists_mock,
        patch(f"{_MODULE}.a_create_schedule", create),
        patch(f"{_MODULE}.a_update_schedule", update),
        patch(f"{_MODULE}.a_delete_schedule", delete),
    ):
        yield exists_mock, create, update, delete


def test_schedule_id_format() -> None:
    sid = uuid.UUID("c232d230-484b-4342-8d88-c70718a796b7")
    assert scanner_schedule_id(sid) == f"{SCANNER_SCHEDULE_ID_PREFIX}-{sid}"


def test_offset_is_deterministic_per_scanner() -> None:
    sid = uuid.uuid4()
    assert _compute_offset(sid) == _compute_offset(sid)


def test_offset_within_interval() -> None:
    interval_s = int(SCANNER_SCHEDULE_INTERVAL.total_seconds())
    for _ in range(50):
        offset = _compute_offset(uuid.uuid4())
        assert dt.timedelta(0) <= offset < dt.timedelta(seconds=interval_s)


def test_offset_distributes_across_window() -> None:
    offsets = {_compute_offset(uuid.uuid4()).total_seconds() for _ in range(100)}
    assert len(offsets) > 50


def test_fingerprint_stable_across_calls() -> None:
    snapshot = {"a": 1, "b": [1, 2], "c": {"nested": True}}
    assert compute_schedule_fingerprint(snapshot) == compute_schedule_fingerprint(snapshot)


def test_fingerprint_key_order_independent() -> None:
    assert compute_schedule_fingerprint({"x": 1, "y": 2}) == compute_schedule_fingerprint({"y": 2, "x": 1})


def test_fingerprint_changes_on_field_change() -> None:
    assert compute_schedule_fingerprint({"scanner_version": 1}) != compute_schedule_fingerprint({"scanner_version": 2})


def test_fingerprint_handles_none() -> None:
    assert compute_schedule_fingerprint(None) == compute_schedule_fingerprint({})


def test_build_schedule_carries_scanner_inputs_and_offset() -> None:
    scanner_id = uuid.uuid4()
    schedule = _build_schedule(scanner_id, team_id=99)
    action = schedule.action
    assert isinstance(action, ScheduleActionStartWorkflow)
    assert action.workflow == "replay-vision-sweep-scanner"
    inputs = action.args[0]
    assert isinstance(inputs, SweepScannerInputs)
    assert inputs.scanner_id == scanner_id
    assert inputs.team_id == 99
    assert schedule.spec.intervals[0].every == SCANNER_SCHEDULE_INTERVAL
    assert schedule.spec.intervals[0].offset == _compute_offset(scanner_id)


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_upsert_creates_when_missing() -> None:
    scanner = await sync_to_async(_make_scanner)()
    with _patched_temporal(exists=False) as (_exists, create, update, _delete):
        await a_upsert_scanner_schedule(scanner.id, scanner.team_id)
    create.assert_awaited_once()
    update.assert_not_awaited()
    assert create.call_args.kwargs["trigger_immediately"] is True
    keys = {pair.key.name for pair in create.call_args.kwargs["search_attributes"]}
    assert {"PostHogTeamId", "PostHogScheduleType", "PostHogScheduleFingerprint"} <= keys


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_upsert_updates_when_present() -> None:
    scanner = await sync_to_async(_make_scanner)()
    with _patched_temporal(exists=True) as (_exists, create, update, _delete):
        await a_upsert_scanner_schedule(scanner.id, scanner.team_id)
    update.assert_awaited_once()
    create.assert_not_awaited()


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_upsert_no_ops_when_scanner_missing() -> None:
    with _patched_temporal(exists=False) as (exists, create, _update, _delete):
        await a_upsert_scanner_schedule(uuid.uuid4(), team_id=99)
    exists.assert_not_awaited()
    create.assert_not_awaited()


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_upsert_stamps_fingerprint_attribute() -> None:
    scanner = await sync_to_async(_make_scanner)()
    with _patched_temporal(exists=False) as (_exists, create, _update, _delete):
        await a_upsert_scanner_schedule(scanner.id, scanner.team_id)
    pairs = {pair.key.name: pair.value for pair in create.call_args.kwargs["search_attributes"]}
    assert pairs["PostHogTeamId"] == scanner.team_id
    assert pairs["PostHogScheduleType"] == SCANNER_SCHEDULE_TYPE
    assert isinstance(pairs["PostHogScheduleFingerprint"], str) and pairs["PostHogScheduleFingerprint"]


@pytest.mark.asyncio
async def test_delete_is_noop_when_schedule_missing() -> None:
    with _patched_temporal(exists=False) as (_exists, _create, _update, delete):
        await a_delete_scanner_schedule(uuid.uuid4())
    delete.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_calls_delete_when_present() -> None:
    with _patched_temporal(exists=True) as (_exists, _create, _update, delete):
        await a_delete_scanner_schedule(uuid.uuid4())
    delete.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_swallows_race_exceptions() -> None:
    # Must not raise; the reconciler treats delete as best-effort.
    with _patched_temporal(exists=True, delete_side_effect=RuntimeError("race")):
        await a_delete_scanner_schedule(uuid.uuid4())
