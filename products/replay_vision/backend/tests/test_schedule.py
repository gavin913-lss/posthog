import uuid
import datetime as dt
from typing import Any

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

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


# scanner_schedule_id


def test_schedule_id_format() -> None:
    sid = uuid.UUID("c2 32d230-484b-4342-8d88-c70718a796b7".replace(" ", ""))
    assert scanner_schedule_id(sid) == f"{SCANNER_SCHEDULE_ID_PREFIX}-{sid}"


# _compute_offset


def test_offset_is_deterministic_per_scanner() -> None:
    sid = uuid.uuid4()
    assert _compute_offset(sid) == _compute_offset(sid)


def test_offset_within_interval() -> None:
    interval_s = int(SCANNER_SCHEDULE_INTERVAL.total_seconds())
    for _ in range(50):
        offset = _compute_offset(uuid.uuid4())
        assert dt.timedelta(0) <= offset < dt.timedelta(seconds=interval_s)


def test_offset_distributes_across_window() -> None:
    # 100 random scanners should spread across the window; collisions are fine but full clustering is not.
    offsets = {_compute_offset(uuid.uuid4()).total_seconds() for _ in range(100)}
    assert len(offsets) > 50  # not all colliding


# compute_schedule_fingerprint


def test_fingerprint_stable_across_calls() -> None:
    snapshot = {"a": 1, "b": [1, 2], "c": {"nested": True}}
    assert compute_schedule_fingerprint(snapshot) == compute_schedule_fingerprint(snapshot)


def test_fingerprint_key_order_independent() -> None:
    a = {"x": 1, "y": 2}
    b = {"y": 2, "x": 1}
    assert compute_schedule_fingerprint(a) == compute_schedule_fingerprint(b)


def test_fingerprint_changes_on_field_change() -> None:
    base = {"scanner_version": 1, "enabled": True}
    bumped = {"scanner_version": 2, "enabled": True}
    assert compute_schedule_fingerprint(base) != compute_schedule_fingerprint(bumped)


def test_fingerprint_handles_none() -> None:
    assert compute_schedule_fingerprint(None) == compute_schedule_fingerprint({})


# _build_schedule


def test_build_schedule_carries_scanner_inputs_and_offset() -> None:
    scanner_id = uuid.uuid4()
    schedule = _build_schedule(scanner_id, team_id=99)
    action = schedule.action
    assert isinstance(action, ScheduleActionStartWorkflow)
    assert action.workflow == "replay-vision-sweep-scanner"
    inputs = action.args[0]
    assert inputs.scanner_id == scanner_id
    assert inputs.team_id == 99
    assert schedule.spec.intervals[0].every == SCANNER_SCHEDULE_INTERVAL
    assert schedule.spec.intervals[0].offset == _compute_offset(scanner_id)


# a_upsert_scanner_schedule


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_upsert_creates_when_missing() -> None:
    from asgiref.sync import sync_to_async

    scanner = await sync_to_async(_make_scanner)()
    client = MagicMock()
    create_mock = AsyncMock()
    update_mock = AsyncMock()
    with (
        patch("products.replay_vision.backend.temporal.schedule.async_connect", AsyncMock(return_value=client)),
        patch("products.replay_vision.backend.temporal.schedule.a_schedule_exists", AsyncMock(return_value=False)),
        patch("products.replay_vision.backend.temporal.schedule.a_create_schedule", create_mock),
        patch("products.replay_vision.backend.temporal.schedule.a_update_schedule", update_mock),
    ):
        await a_upsert_scanner_schedule(scanner.id, scanner.team_id)
    create_mock.assert_awaited_once()
    update_mock.assert_not_awaited()
    assert create_mock.call_args.kwargs["trigger_immediately"] is True
    search_attrs = create_mock.call_args.kwargs["search_attributes"]
    keys = {pair.key.name for pair in search_attrs}
    assert {"PostHogTeamId", "PostHogScheduleType", "PostHogScheduleFingerprint"} <= keys


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_upsert_updates_when_present() -> None:
    from asgiref.sync import sync_to_async

    scanner = await sync_to_async(_make_scanner)()
    client = MagicMock()
    create_mock = AsyncMock()
    update_mock = AsyncMock()
    with (
        patch("products.replay_vision.backend.temporal.schedule.async_connect", AsyncMock(return_value=client)),
        patch("products.replay_vision.backend.temporal.schedule.a_schedule_exists", AsyncMock(return_value=True)),
        patch("products.replay_vision.backend.temporal.schedule.a_create_schedule", create_mock),
        patch("products.replay_vision.backend.temporal.schedule.a_update_schedule", update_mock),
    ):
        await a_upsert_scanner_schedule(scanner.id, scanner.team_id)
    update_mock.assert_awaited_once()
    create_mock.assert_not_awaited()


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_upsert_no_ops_when_scanner_missing() -> None:
    client = MagicMock()
    with (
        patch("products.replay_vision.backend.temporal.schedule.async_connect", AsyncMock(return_value=client)),
        patch(
            "products.replay_vision.backend.temporal.schedule.a_schedule_exists", AsyncMock(return_value=False)
        ) as exists_mock,
        patch("products.replay_vision.backend.temporal.schedule.a_create_schedule", AsyncMock()) as create_mock,
    ):
        await a_upsert_scanner_schedule(uuid.uuid4(), team_id=99)
    exists_mock.assert_not_awaited()
    create_mock.assert_not_awaited()


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_upsert_stamps_fingerprint_attribute() -> None:
    from asgiref.sync import sync_to_async

    scanner = await sync_to_async(_make_scanner)()
    create_mock = AsyncMock()
    with (
        patch("products.replay_vision.backend.temporal.schedule.async_connect", AsyncMock(return_value=MagicMock())),
        patch("products.replay_vision.backend.temporal.schedule.a_schedule_exists", AsyncMock(return_value=False)),
        patch("products.replay_vision.backend.temporal.schedule.a_create_schedule", create_mock),
    ):
        await a_upsert_scanner_schedule(scanner.id, scanner.team_id)
    search_attrs = create_mock.call_args.kwargs["search_attributes"]
    pairs = {pair.key.name: pair.value for pair in search_attrs}
    assert pairs["PostHogTeamId"] == scanner.team_id
    assert pairs["PostHogScheduleType"] == SCANNER_SCHEDULE_TYPE
    assert isinstance(pairs["PostHogScheduleFingerprint"], str) and len(pairs["PostHogScheduleFingerprint"]) > 0


# a_delete_scanner_schedule


@pytest.mark.asyncio
async def test_delete_is_noop_when_schedule_missing() -> None:
    client = MagicMock()
    delete_mock = AsyncMock()
    with (
        patch("products.replay_vision.backend.temporal.schedule.async_connect", AsyncMock(return_value=client)),
        patch("products.replay_vision.backend.temporal.schedule.a_schedule_exists", AsyncMock(return_value=False)),
        patch("products.replay_vision.backend.temporal.schedule.a_delete_schedule", delete_mock),
    ):
        await a_delete_scanner_schedule(uuid.uuid4())
    delete_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_calls_delete_when_present() -> None:
    client = MagicMock()
    delete_mock = AsyncMock()
    with (
        patch("products.replay_vision.backend.temporal.schedule.async_connect", AsyncMock(return_value=client)),
        patch("products.replay_vision.backend.temporal.schedule.a_schedule_exists", AsyncMock(return_value=True)),
        patch("products.replay_vision.backend.temporal.schedule.a_delete_schedule", delete_mock),
    ):
        await a_delete_scanner_schedule(uuid.uuid4())
    delete_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_swallows_race_exceptions() -> None:
    client = MagicMock()
    delete_mock = AsyncMock(side_effect=RuntimeError("race"))
    with (
        patch("products.replay_vision.backend.temporal.schedule.async_connect", AsyncMock(return_value=client)),
        patch("products.replay_vision.backend.temporal.schedule.a_schedule_exists", AsyncMock(return_value=True)),
        patch("products.replay_vision.backend.temporal.schedule.a_delete_schedule", delete_mock),
    ):
        # Must not raise; the reconciler treats delete as best-effort.
        await a_delete_scanner_schedule(uuid.uuid4())
