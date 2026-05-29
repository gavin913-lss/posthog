import { useEffect, useRef, useState } from 'react'

/**
 * Single-line countdown that fires `onAdvance` once at zero. Used by
 * {@link WizardProgressTracker} to auto-progress the user past the install step
 * after they've seen the "wizard is running" acknowledgement.
 *
 * Belt-and-suspenders: navigation usually unmounts us, but during the brief
 * window before the next scene takes over we may re-render — `firedRef` guards
 * against double-firing.
 */
export function AutoAdvanceCountdown({
    durationSeconds,
    onAdvance,
}: {
    durationSeconds: number
    onAdvance: () => void
}): JSX.Element {
    const [remaining, setRemaining] = useState(durationSeconds)
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
