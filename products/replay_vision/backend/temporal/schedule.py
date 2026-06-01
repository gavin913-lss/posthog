"""Per-scanner Temporal schedule lifecycle helpers."""

import json
import hashlib
import datetime as dt
from typing import Any
from uuid import UUID

from django.conf import settings

import structlog
from temporalio import common
from temporalio.client import (
    Schedule,
    ScheduleActionStartWorkflow,
    ScheduleIntervalSpec,
    ScheduleOverlapPolicy,
    SchedulePolicy,
    ScheduleSpec,
)
from temporalio.common import SearchAttributePair, TypedSearchAttributes

from posthog.sync import database_sync_to_async
from posthog.temporal.common.client import async_connect
from posthog.temporal.common.schedule import a_create_schedule, a_delete_schedule, a_schedule_exists, a_update_schedule
from posthog.temporal.common.search_attributes import (
    POSTHOG_SCHEDULE_FINGERPRINT_KEY,
    POSTHOG_SCHEDULE_TYPE_KEY,
    POSTHOG_TEAM_ID_KEY,
)

from products.replay_vision.backend.models.replay_scanner import ReplayScanner
from products.replay_vision.backend.temporal.constants import (
    SCANNER_SCHEDULE_INTERVAL,
    SCANNER_SCHEDULE_TYPE,
    SWEEP_SCANNER_WORKFLOW_NAME,
    SWEEP_WORKFLOW_EXECUTION_TIMEOUT,
    scanner_schedule_id,
)
from products.replay_vision.backend.temporal.sweep_types import SweepScannerInputs

logger = structlog.get_logger(__name__)

# Scanner row fields whose change should retrigger the schedule via fingerprint drift.
_FINGERPRINT_FIELDS = (
    "scanner_version",
    "enabled",
    "sampling_rate",
    "model",
    "provider",
    "query",
    "scanner_config",
)


def compute_schedule_fingerprint(snapshot: dict[str, Any] | None) -> str:
    canonical = json.dumps(snapshot or {}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


def _compute_offset(scanner_id: UUID) -> dt.timedelta:
    # UUID.int is stable across processes; modulo distributes fires uniformly across the window.
    interval_s = int(SCANNER_SCHEDULE_INTERVAL.total_seconds())
    return dt.timedelta(seconds=scanner_id.int % interval_s)


def _build_schedule(scanner_id: UUID, team_id: int) -> Schedule:
    return Schedule(
        action=ScheduleActionStartWorkflow(
            SWEEP_SCANNER_WORKFLOW_NAME,
            SweepScannerInputs(scanner_id=scanner_id, team_id=team_id),
            id=f"{SWEEP_SCANNER_WORKFLOW_NAME}-{scanner_id}",
            task_queue=settings.REPLAY_VISION_TASK_QUEUE,
            execution_timeout=SWEEP_WORKFLOW_EXECUTION_TIMEOUT,
            retry_policy=common.RetryPolicy(maximum_attempts=1),
        ),
        spec=ScheduleSpec(
            intervals=[ScheduleIntervalSpec(every=SCANNER_SCHEDULE_INTERVAL, offset=_compute_offset(scanner_id))]
        ),
        policy=SchedulePolicy(overlap=ScheduleOverlapPolicy.SKIP, catchup_window=SCANNER_SCHEDULE_INTERVAL),
    )


def _load_fingerprint(scanner_id: UUID) -> str | None:
    row = ReplayScanner.objects.filter(pk=scanner_id).values(*_FINGERPRINT_FIELDS).first()
    return compute_schedule_fingerprint(dict(row)) if row else None


async def a_upsert_scanner_schedule(scanner_id: UUID, team_id: int) -> None:
    """Create or update the per-scanner schedule. No-op when the scanner row is gone."""
    fingerprint = await database_sync_to_async(_load_fingerprint)(scanner_id)
    if fingerprint is None:
        logger.info("replay_vision.upsert_schedule.scanner_missing", scanner_id=str(scanner_id))
        return

    client = await async_connect()
    schedule_id = scanner_schedule_id(scanner_id)
    schedule = _build_schedule(scanner_id, team_id)
    search_attributes = TypedSearchAttributes(
        search_attributes=[
            SearchAttributePair(key=POSTHOG_TEAM_ID_KEY, value=team_id),
            SearchAttributePair(key=POSTHOG_SCHEDULE_TYPE_KEY, value=SCANNER_SCHEDULE_TYPE),
            SearchAttributePair(key=POSTHOG_SCHEDULE_FINGERPRINT_KEY, value=fingerprint),
        ]
    )

    if await a_schedule_exists(client, schedule_id):
        await a_update_schedule(client, schedule_id, schedule, search_attributes=search_attributes)
    else:
        await a_create_schedule(
            client, schedule_id, schedule, trigger_immediately=True, search_attributes=search_attributes
        )


async def a_delete_scanner_schedule(scanner_id: UUID) -> None:
    """Idempotent — racing deleters log and continue."""
    client = await async_connect()
    schedule_id = scanner_schedule_id(scanner_id)
    if not await a_schedule_exists(client, schedule_id):
        return
    try:
        await a_delete_schedule(client, schedule_id)
    except Exception as e:
        logger.warning("replay_vision.delete_schedule_failed", scanner_id=str(scanner_id), error=str(e))
