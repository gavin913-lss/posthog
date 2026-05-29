import { AnyResponseType } from '~/queries/schema/schema-general'
import { QueryBasedInsightModel } from '~/types'

interface Entry {
    insight: QueryBasedInsightModel
    result: AnyResponseType | null
    expiresAt: number
}

const cache = new Map<string, Entry>()
const TTL_MS = 30_000

// Hand-off between a scene that just PATCHed an insight (e.g. the SQL editor) and the
// insight view scene that is about to mount. The destination scene's insightLogic reads
// this on mount and skips the GET that would otherwise return the server's pre-edit
// cached result.
export function stashRecentlyUpdatedInsight(insight: QueryBasedInsightModel, result: AnyResponseType | null): void {
    if (!insight.short_id) {
        return
    }
    cache.set(insight.short_id, { insight, result, expiresAt: Date.now() + TTL_MS })
}

export function consumeRecentlyUpdatedInsight(shortId: string): Entry | null {
    const entry = cache.get(shortId)
    if (!entry) {
        return null
    }
    cache.delete(shortId)
    if (entry.expiresAt < Date.now()) {
        return null
    }
    return entry
}
