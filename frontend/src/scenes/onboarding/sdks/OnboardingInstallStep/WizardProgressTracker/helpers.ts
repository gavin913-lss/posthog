import { type DisplayState } from '../wizardProgressTrackerLogic'

export function bannerTypeFor(state: DisplayState): 'ai' | 'success' | 'error' {
    if (state === 'completed') {
        return 'success'
    }
    if (state === 'error') {
        return 'error'
    }
    return 'ai'
}

export function headlineFor(state: DisplayState): string {
    switch (state) {
        case 'completed':
            return 'PostHog is set up.'
        case 'error':
            return 'The wizard hit a snag.'
        case 'connecting':
            return 'Reconnecting to the wizard…'
        default:
            return 'The wizard is installing PostHog for you.'
    }
}

export function subLineFor(state: DisplayState): string {
    switch (state) {
        case 'completed':
            return 'Hit Next below to finish onboarding.'
        case 'connecting':
            return 'restoring connection — your run is still going'
        default:
            return "usually 5–10 minutes — keep moving in onboarding, we'll track progress in the corner"
    }
}
