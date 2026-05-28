import { useActions, useValues } from 'kea'
import { useEffect, useRef, useState } from 'react'

import { LemonBanner } from '@posthog/lemon-ui'

import { SkillBadge } from '../skillBadge'
import { type DisplayState, wizardProgressTrackerLogic } from './wizardProgressTrackerLogic'

const AUTO_ADVANCE_SECONDS = 5

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

function AutoAdvanceCountdown({
    durationSeconds,
    onAdvance,
}: {
    durationSeconds: number
    onAdvance: () => void
}): JSX.Element {
    const [remaining, setRemaining] = useState(durationSeconds)
    // Belt-and-suspenders: navigation usually unmounts us, but during the brief window
    // before the next scene takes over we may re-render — guard so we only fire once.
    const firedRef = useRef(false)

    useEffect(() => {
        if (remaining <= 0) {
            if (!firedRef.current) {
                firedRef.current = true
                onAdvance()
            }
            return
        }
        const id = window.setTimeout(() => setRemaining((r) => r - 1), 1000)
        return () => window.clearTimeout(id)
    }, [remaining, onAdvance])

    return (
        <div className="text-xs text-muted tabular-nums shrink-0">
            {remaining > 0 ? `Continuing in ${remaining}s…` : 'Continuing…'}
        </div>
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

function bannerTypeFor(state: DisplayState): 'ai' | 'success' | 'error' {
    if (state === 'completed') {
        return 'success'
    }
    if (state === 'error') {
        return 'error'
    }
    return 'ai'
}

function headlineFor(state: DisplayState): string {
    switch (state) {
        case 'completed':
            return 'PostHog is set up.'
        case 'error':
            return 'The wizard hit a snag.'
        case 'connecting':
            return 'Reconnecting to the wizard…'
        default:
            return 'The wizard is running for you.'
    }
}

function subLineFor(state: DisplayState): string {
    switch (state) {
        case 'completed':
            return 'Hit Continue below to finish onboarding.'
        case 'connecting':
            return 'restoring connection — your run is still going'
        default:
            return 'usually 5–10 minutes · watch progress in the corner'
    }
}
