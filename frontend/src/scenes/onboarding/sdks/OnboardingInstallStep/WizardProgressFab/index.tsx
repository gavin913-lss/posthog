import { useActions, useValues } from 'kea'
import { useState } from 'react'

import { IconChevronDown, IconX } from '@posthog/icons'

import { useFeatureFlag } from 'lib/hooks/useFeatureFlag'

import { wizardProgressTrackerLogic } from '../wizardProgressTrackerLogic'
import { ExpandedDetails } from './ExpandedDetails'
import { FabKeyframes } from './FabKeyframes'
import { headlineFor, simulatedTaskFraction, subLineFor } from './helpers'
import { ProgressRing } from './ProgressRing'

/**
 * Persistent corner widget that surfaces an in-flight wizard run while the user
 * navigates the rest of the app. Disappears when the install step's inline
 * confirmation card is mounted, when the user dismisses a terminal run, or when
 * we haven't observed a recent wizard session (see `sessionIsCurrent`).
 *
 * Click the header to expand the card inline — the expanded view shows the live
 * task list with per-task elapsed times. Clicking again collapses it.
 *
 * Gated on the same flag as the takeover panel so control-arm users don't mount
 * the sync logic (and open an SSE connection) at the scene level.
 */
export function WizardProgressFab(): JSX.Element | null {
    const isSyncEnabled = useFeatureFlag('ONBOARDING_WIZARD_SYNC', 'test')
    if (!isSyncEnabled) {
        return null
    }
    return <WizardProgressFabInner />
}

function WizardProgressFabInner(): JSX.Element | null {
    const {
        displayState,
        latestSession,
        elapsedSeconds,
        dismissed,
        panelMounted,
        sessionIsCurrent,
        taskStartedAt,
        now,
    } = useValues(wizardProgressTrackerLogic)
    const { dismiss } = useActions(wizardProgressTrackerLogic)

    const [expanded, setExpanded] = useState(false)

    if (dismissed || panelMounted || displayState === 'preTakeover' || !sessionIsCurrent) {
        return null
    }
    const tasks = latestSession?.tasks ?? []
    const totalCount = tasks.length
    const completedCount = tasks.filter((t) => t.status === 'completed').length
    const inProgressTask = tasks.find((t) => t.status === 'in_progress')
    const currentTask = inProgressTask?.title
    // Ring fill = real completed count plus a simulated fraction of the in-progress
    // task, so the ring keeps moving between backend updates.
    const inProgressFraction = inProgressTask ? simulatedTaskFraction(taskStartedAt[inProgressTask.id], now) : 0
    const progressPct = totalCount > 0 ? Math.round(((completedCount + inProgressFraction) / totalCount) * 100) : 0

    const isTerminal = displayState === 'completed' || displayState === 'error'

    return (
        <div className="fixed bottom-5 right-5 z-[60] wizard-fab-slide-in">
            <FabKeyframes />
            <div
                role="status"
                aria-live="polite"
                className="relative w-[300px] bg-bg-light rounded-xl shadow-xl shadow-black/15 border border-border overflow-hidden"
            >
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="w-full text-left flex items-center gap-3 px-3 py-3 hover:bg-bg-3000 transition-colors cursor-pointer"
                    aria-label={expanded ? 'Collapse wizard details' : 'Expand wizard details'}
                    aria-expanded={expanded}
                >
                    <ProgressRing
                        progress={displayState === 'completed' ? 100 : progressPct}
                        state={displayState}
                        hasTasks={totalCount > 0}
                    />
                    <div className="flex-1 min-w-0 leading-tight">
                        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted font-semibold">
                            <span>Setup wizard</span>
                        </div>
                        <div className="text-sm font-semibold text-default truncate mt-0.5">
                            {headlineFor(displayState)}
                        </div>
                        <div className="text-xs text-muted truncate mt-0.5 tabular-nums">
                            {subLineFor(displayState, currentTask, elapsedSeconds)}
                        </div>
                    </div>
                    <IconChevronDown
                        className={`text-base text-muted shrink-0 transition-transform duration-200 ${
                            expanded ? 'rotate-180' : ''
                        }`}
                        aria-hidden
                    />
                </button>
                {isTerminal ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            dismiss()
                        }}
                        aria-label="Dismiss"
                        className="absolute top-1.5 right-1.5 p-1 rounded-md text-muted hover:text-default hover:bg-bg-3000 transition-colors z-10"
                    >
                        <IconX className="text-base" />
                    </button>
                ) : null}
                <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                        expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                >
                    <div className="overflow-hidden">
                        <ExpandedDetails tasks={tasks} taskStartedAt={taskStartedAt} now={now} />
                    </div>
                </div>
            </div>
        </div>
    )
}
