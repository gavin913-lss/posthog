import { type DisplayState } from '../wizardProgressTrackerLogic'
import { accentColor } from './helpers'

const RING_SIZE = 44
const RING_STROKE = 4
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/**
 * Circular progress dial for the FAB header. Renders an indeterminate spin
 * while connecting or before any tasks arrive, otherwise fills clockwise from
 * 12 o'clock. The center glyph (`%`, `✓`, `✗`, blank) is delegated to
 * {@link RingCenter}.
 */
export function ProgressRing({
    progress,
    state,
    hasTasks,
}: {
    progress: number
    state: DisplayState
    hasTasks: boolean
}): JSX.Element {
    const accent = accentColor(state)
    const isIndeterminate = state === 'connecting' || (state === 'running' && !hasTasks)
    const dashOffset = RING_CIRCUMFERENCE * (1 - progress / 100)

    return (
        <div
            className="relative shrink-0 flex items-center justify-center"
            style={{ width: RING_SIZE, height: RING_SIZE }}
        >
            <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                <circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    fill="none"
                    stroke="currentColor"
                    className="text-border"
                    strokeWidth={RING_STROKE}
                />
                {isIndeterminate ? (
                    <g className="wizard-fab-ring-spin" style={{ transformOrigin: '50% 50%' }}>
                        <circle
                            cx={RING_SIZE / 2}
                            cy={RING_SIZE / 2}
                            r={RING_RADIUS}
                            fill="none"
                            stroke={accent}
                            strokeWidth={RING_STROKE}
                            strokeLinecap="round"
                            strokeDasharray={`${RING_CIRCUMFERENCE * 0.25} ${RING_CIRCUMFERENCE}`}
                            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                        />
                    </g>
                ) : (
                    <circle
                        cx={RING_SIZE / 2}
                        cy={RING_SIZE / 2}
                        r={RING_RADIUS}
                        fill="none"
                        stroke={accent}
                        strokeWidth={RING_STROKE}
                        strokeLinecap="round"
                        strokeDasharray={RING_CIRCUMFERENCE}
                        strokeDashoffset={dashOffset}
                        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                        style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
                    />
                )}
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">
                <RingCenter state={state} progress={progress} hasTasks={hasTasks} accent={accent} />
            </span>
        </div>
    )
}

/**
 * Center glyph for the {@link ProgressRing}. Private to this file because it
 * only makes sense in conjunction with the ring's color + state semantics.
 */
function RingCenter({
    state,
    progress,
    hasTasks,
    accent,
}: {
    state: DisplayState
    progress: number
    hasTasks: boolean
    accent: string
}): JSX.Element {
    if (state === 'completed') {
        return (
            <span style={{ color: accent }} aria-hidden>
                ✓
            </span>
        )
    }
    if (state === 'error') {
        return (
            <span style={{ color: accent }} aria-hidden>
                ✗
            </span>
        )
    }
    if (state === 'connecting' || !hasTasks) {
        return <span aria-hidden />
    }
    return <span style={{ color: accent }}>{`${progress}%`}</span>
}
