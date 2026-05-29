/**
 * Inline keyframe definitions for the FAB. Co-located so the animations live
 * next to the component that consumes them and don't leak into the global
 * stylesheet.
 */
export function FabKeyframes(): JSX.Element {
    return (
        <style>{`
            @keyframes wizard-fab-slide-in {
                from { opacity: 0; transform: translateY(12px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            .wizard-fab-slide-in {
                animation: wizard-fab-slide-in 320ms ease-out both;
            }
            @keyframes wizard-fab-ring-spin {
                to { transform: rotate(360deg); }
            }
            .wizard-fab-ring-spin {
                animation: wizard-fab-ring-spin 1.2s linear infinite;
                transform-box: fill-box;
            }
            @keyframes wizard-fab-sparkle {
                0%, 60%, 100% { opacity: 1; transform: scale(1) rotate(0deg); }
                70%           { opacity: 0.4; transform: scale(0.85) rotate(-8deg); }
                85%           { opacity: 1; transform: scale(1.1) rotate(8deg); }
            }
            .wizard-fab-sparkle {
                color: #b285ff;
                animation: wizard-fab-sparkle 3.4s ease-in-out infinite;
                transform-origin: center;
            }
        `}</style>
    )
}
