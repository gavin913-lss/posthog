import type { DashboardTile, QueryBasedInsightModel } from '~/types'

import { dashboardsWidgetsPartialUpdate } from './generated/api'
import { WidgetConfigValidationError, type WidgetFieldErrors } from './widget_types/widgetConfigValidation'
import { parseErrorTrackingWidgetConfigApiError } from './widgets/error_tracking/errorTrackingWidgetConfigValidation'
import { parseSessionReplayWidgetConfigApiError } from './widgets/session_replay/sessionReplayWidgetConfigValidation'

function parseWidgetConfigApiError(widgetType: string, error: unknown): WidgetFieldErrors | null {
    switch (widgetType) {
        case 'error_tracking':
        case 'error_tracking_list':
            return parseErrorTrackingWidgetConfigApiError(error)
        case 'session_replay_list':
            return parseSessionReplayWidgetConfigApiError(error)
        default:
            return null
    }
}

export async function updateDashboardWidgetTileConfig({
    teamId,
    dashboardId,
    tile,
    config,
}: {
    teamId: number
    dashboardId: number
    tile: DashboardTile<QueryBasedInsightModel>
    config: Record<string, unknown>
}): Promise<DashboardTile<QueryBasedInsightModel>> {
    if (!tile.widget) {
        throw new Error('Tile has no widget')
    }

    try {
        return await dashboardsWidgetsPartialUpdate(String(teamId), dashboardId, tile.id, { config })
    } catch (error) {
        const fieldErrors = parseWidgetConfigApiError(tile.widget.widget_type, error)
        if (fieldErrors && Object.keys(fieldErrors).length > 0) {
            throw new WidgetConfigValidationError(fieldErrors)
        }
        throw error
    }
}

export async function updateDashboardWidgetTileMetadata({
    teamId,
    dashboardId,
    tile,
    name,
    description,
}: {
    teamId: number
    dashboardId: number
    tile: DashboardTile<QueryBasedInsightModel>
    name?: string | null
    description?: string
}): Promise<DashboardTile<QueryBasedInsightModel>> {
    if (!tile.widget) {
        throw new Error('Tile has no widget')
    }

    const payload: { name?: string | null; description?: string } = {}
    if (name !== undefined) {
        payload.name = name || null
    }
    if (description !== undefined) {
        payload.description = description
    }

    return dashboardsWidgetsPartialUpdate(String(teamId), dashboardId, tile.id, payload)
}
