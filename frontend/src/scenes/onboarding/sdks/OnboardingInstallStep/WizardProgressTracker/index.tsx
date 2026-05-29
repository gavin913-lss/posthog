import { useActions, useValues } from 'kea'
import { useEffect } from 'react'

import { LemonBanner } from '@posthog/lemon-ui'

import { SkillBadge } from '../../skillBadge'
import { wizardProgressTrackerLogic } from '../wizardProgressTrackerLogic'
import { AutoAdvanceCountdown } from './AutoAdvanceCountdown'
import { AUTO_ADVANCE_SECONDS, bannerTypeFor, headlineFor, subLineFor } from './helpers'

/**
 * Inline confirmation card shown on the install step once a wizard session exists.
 *
 * While the wizard is running, a small countdown advances the user to the next
 * onboarding step after a few seconds — the FAB carries the live progress from
 * that point on. The parent supplies `onAutoAdvance` (typically wired to
 * `onboardingLogic.goToNextStep`).
 */
export function WizardProgressTracker({ onAutoAdvance }: { onAutoAdvance?: () => void } = {}): JSX.Element | null {
    const { displayState, latestSession } = useValues(wizardProgressTrackerLogic)
    const { setPanelMounted } = useActions(wizardProgressTrackerLogic)

    useEffect(() => {
        setPanelMounted(true)
        return () => setPanelMounted(false)
    }, [setPanelMounted])

    if (displayState === 'preTakeover' || !latestSession) {
        return null
    }

    const errorPayload =
        displayState === 'error' && latestSession.error && typeof latestSession.error === 'object'
            ? (latestSession.error as { type?: string; message?: string })
            : null
    const showAutoAdvance = (displayState === 'running' || displayState === 'connecting') && onAutoAdvance !== undefined

    return (
        <LemonBanner type={bannerTypeFor(displayState)}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <div className="font-semibold">{headlineFor(displayState)}</div>
                    {displayState === 'error' && errorPayload ? (
                        <div className="text-xs">
                            <span className="font-semibold">{errorPayload.type}: </span>
                            <span className="text-muted">{errorPayload.message}</span>
                        </div>
                    ) : (
                        <div className="text-xs text-muted flex items-center flex-wrap gap-x-2 gap-y-1">
                            <SkillBadge skillId={latestSession.skill_id} size={14} />
                            <span>·</span>
                            <span>{subLineFor(displayState)}</span>
                        </div>
                    )}
                </div>
                {showAutoAdvance ? (
                    <AutoAdvanceCountdown durationSeconds={AUTO_ADVANCE_SECONDS} onAdvance={onAutoAdvance} />
                ) : null}
            </div>
        </LemonBanner>
    )
}

/**
 * Used by the parent variant to decide whether to render the takeover at all.
 * Mounts the logic on first call. Returns `true` once we have observed a
 * recent session — stale terminal sessions sitting in the DB don't trigger it.
 */
export function useWizardTakeoverActive(): boolean {
    const { displayState, sessionIsCurrent } = useValues(wizardProgressTrackerLogic)
    return displayState !== 'preTakeover' && sessionIsCurrent
}
