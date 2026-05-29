import { type DisplayState } from '../wizardProgressTrackerLogic'

// Characteristic time for the simulated per-task progress curve. The fraction
// asymptotically approaches 0.95 — fast initial fill, then slowing down so it
// never claims "done" until the backend confirms. 45s is close to a typical
// wizard task duration while still moving visibly on short tasks.
export const SIMULATED_TASK_DECAY_SECONDS = 45
export const SIMULATED_TASK_CAP = 0.95

/**
 * 0 → 0.95 asymptotic curve from a task's observed start time. Used to keep the
 * ring and per-task bars moving while a task is in flight, without any backend
 * micro-progress signal. The call site upgrades to 1.0 only once the task
 * transitions to `completed`.
 */
export function simulatedTaskFraction(startedAtMs: number | undefined, nowMs: number): number {
    if (!startedAtMs) {
        return 0
    }
    const elapsedSeconds = Math.max(0, (nowMs - startedAtMs) / 1000)
    return Math.min(SIMULATED_TASK_CAP, 1 - Math.exp(-elapsedSeconds / SIMULATED_TASK_DECAY_SECONDS))
}

export function headlineFor(state: DisplayState): string {
    switch (state) {
        case 'completed':
            return 'PostHog is set up'
        case 'error':
            return 'Wizard hit a snag'
        case 'connecting':
            return 'Reconnecting…'
        default:
            return 'PostHog is being installed'
    }
}

export function subLineFor(state: DisplayState, currentTask: string | undefined, elapsedSeconds: number): string {
    if (state === 'completed') {
        return 'tap to see what was set up'
    }
    if (state === 'error') {
        return ''
    }
    if (state === 'connecting') {
        return 'restoring connection to the wizard'
    }
    const elapsed = formatElapsed(elapsedSeconds)
    if (currentTask) {
        return `${currentTask} · ${elapsed}`
    }
    return 'connecting...'
}

export function accentColor(state: DisplayState): string {
    if (state === 'completed') {
        return 'rgb(16, 185, 129)' // emerald-500
    }
    return 'rgb(245, 78, 0)' // brand-red — used for running, connecting, and error
}

export function formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}
