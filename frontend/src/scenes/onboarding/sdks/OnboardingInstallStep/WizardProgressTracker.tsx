import { useActions, useValues } from 'kea'
import { useEffect } from 'react'

import { LemonBanner, LemonButton } from '@posthog/lemon-ui'

import { SkillBadge } from '../skillBadge'
import { type DisplayState, wizardProgressTrackerLogic } from './wizardProgressTrackerLogic'

/**
 * Inline confirmation card shown on the install step once a wizard session exists.
 *
 * The card is intentionally lightweight — the live, second-by-second progress
 * lives in {@link WizardProgressFab}, which floats in the corner of every other
 * onboarding step. Here we just acknowledge the run and let the user move on.
 *
 * On mount the card sets `panelMounted: true` on the tracker logic, which
 * suppresses the FAB while this card is visible — so the user never sees both
 * the inline acknowledgement and the floating progress widget at once.
 */
export function WizardProgressTracker({ onManualSetup }: { onManualSetup?: () => void } = {}): JSX.Element | null {
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

    return (
        <LemonBanner type={bannerTypeFor(displayState)}>
            <div className="flex flex-wrap items-start justify-between gap-3">
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
                {showManualSetup(displayState) && onManualSetup ? (
                    <LemonButton size="small" type="secondary" onClick={onManualSetup}>
                        Set up manually instead
                    </LemonButton>
                ) : null}
            </div>
        </LemonBanner>
    )
}

/**
 * Used by the parent variant to decide whether to render the takeover at all.
 * Mounts the logic on first call. Returns `true` once we have any session
 * state to display.
 */
export function useWizardTakeoverActive(): boolean {
    const { displayState } = useValues(wizardProgressTrackerLogic)
    return displayState !== 'preTakeover'
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

function showManualSetup(state: DisplayState): boolean {
    return state === 'running' || state === 'connecting' || state === 'error'
}
