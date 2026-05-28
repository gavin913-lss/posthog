import { IconCode } from '@posthog/icons'

import { type SDK } from '~/types'

import { ALL_SDKS } from './allSDKs'

/**
 * Look up an SDK entry by its `key` — the same string the wizard CLI sends as
 * `skill_id`. Returns `null` for unknown ids; callers should fall back gracefully.
 */
export function findSdkByKey(skillId: string): SDK | null {
    return ALL_SDKS.find((sdk) => sdk.key === skillId) ?? null
}

/**
 * Human-readable name for a skill_id. Uses the canonical SDK name when known
 * (`laravel → Laravel`, `nextjs → Next.js`) and falls back to a tidied-up
 * version of the raw id (`some_thing → Some thing`).
 */
export function getSkillDisplayName(skillId: string): string {
    const sdk = findSdkByKey(skillId)
    if (sdk) {
        return sdk.name
    }
    return skillId.charAt(0).toUpperCase() + skillId.slice(1).replace(/[_-]/g, ' ')
}

/**
 * Inline logo + display name for a wizard skill_id. Use anywhere a wizard
 * session needs to be visually identified (progress panel, FAB, logs, etc.).
 *
 * Unknown skills fall back to a generic code icon plus a tidied display name.
 */
export function SkillBadge({
    skillId,
    size = 16,
    className,
}: {
    skillId: string
    /** Logo edge length in px (also used for the fallback icon). Defaults to 16. */
    size?: number
    /** Extra classes for the wrapper. */
    className?: string
}): JSX.Element {
    const sdk = findSdkByKey(skillId)
    const displayName = sdk?.name ?? getSkillDisplayName(skillId)
    return (
        <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`.trim()}>
            <SkillLogo sdk={sdk} alt={`${displayName} logo`} size={size} />
            <span>{displayName}</span>
        </span>
    )
}

function SkillLogo({ sdk, alt, size }: { sdk: SDK | null; alt: string; size: number }): JSX.Element {
    const sizeStyle = { width: size, height: size }
    if (!sdk) {
        return (
            <span style={sizeStyle} className="inline-flex items-center justify-center text-muted shrink-0">
                <IconCode style={sizeStyle} aria-hidden />
            </span>
        )
    }
    const image = sdk.image
    if (typeof image === 'string') {
        return <img src={image} alt={alt} style={sizeStyle} className="object-contain shrink-0" />
    }
    if (typeof image === 'object' && image !== null && 'default' in image) {
        return <img src={image.default} alt={alt} style={sizeStyle} className="object-contain shrink-0" />
    }
    // React element (custom logo component). It draws into its own container; constrain via CSS.
    return (
        <span style={sizeStyle} className="inline-flex items-center justify-center shrink-0">
            {image}
        </span>
    )
}
