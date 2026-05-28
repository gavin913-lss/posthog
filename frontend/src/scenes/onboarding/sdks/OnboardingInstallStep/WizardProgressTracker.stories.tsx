import { Meta, StoryFn } from '@storybook/react'
import { useMountedLogic } from 'kea'
import { useEffect } from 'react'

import { wizardSessionStreamLogic } from 'products/wizard/frontend/wizardSessionStreamLogic'

import { WizardProgressTracker } from './WizardProgressTracker'
import { wizardProgressTrackerLogic } from './wizardProgressTrackerLogic'

const WORKFLOW_ID = 'posthog-integration'
const SKILL_ID = 'laravel'

if (typeof window !== 'undefined' && !(window as any).__wizardEventSourceStubbed) {
    class StubEventSource {
        readyState = 0
        url = ''
        withCredentials = false
        onopen: ((ev: Event) => void) | null = null
        onmessage: ((ev: MessageEvent) => void) | null = null
        onerror: ((ev: Event) => void) | null = null
        addEventListener(): void {}
        removeEventListener(): void {}
        dispatchEvent(): boolean {
            return false
        }
        close(): void {}
        static readonly CONNECTING = 0
        static readonly OPEN = 1
        static readonly CLOSED = 2
    }
    ;(window as any).EventSource = StubEventSource
    ;(window as any).__wizardEventSourceStubbed = true
}

type WizardSessionFixture = {
    session_id: string
    team_id: number
    workflow_id: string
    skill_id: string
    started_at: string
    run_phase: 'idle' | 'running' | 'completed' | 'error'
    tasks: Array<{
        id: string
        title: string
        status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'canceled'
    }>
    event_plan: unknown | null
    error: { type: string; message: string } | null
    created_at: string
    updated_at: string
}

function makeSession(overrides: Partial<WizardSessionFixture>): WizardSessionFixture {
    const startedAt = new Date(Date.now() - 30_000).toISOString()
    return {
        session_id: `${WORKFLOW_ID}-${SKILL_ID}-${startedAt}`,
        team_id: 1,
        workflow_id: WORKFLOW_ID,
        skill_id: SKILL_ID,
        started_at: startedAt,
        run_phase: 'running',
        tasks: [],
        event_plan: null,
        error: null,
        created_at: startedAt,
        updated_at: new Date().toISOString(),
        ...overrides,
    }
}

function withSession(session: WizardSessionFixture | null): StoryFn {
    return function StoryRender() {
        useMountedLogic(wizardProgressTrackerLogic)
        const streamLogic = wizardSessionStreamLogic({ workflowId: WORKFLOW_ID })
        useMountedLogic(streamLogic)

        useEffect(() => {
            streamLogic.actions.connectionOpened()
            if (session) {
                streamLogic.actions.sessionUpdated(session as any)
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [])

        return (
            <SceneFrame>
                <WizardProgressTracker onManualSetup={() => alert('Open manual setup modal')} />
            </SceneFrame>
        )
    }
}

const meta: Meta = {
    title: 'Scenes-Other/Onboarding/Wizard Progress Tracker',
    component: WizardProgressTracker,
    parameters: {
        layout: 'fullscreen',
        viewMode: 'story',
    },
}
export default meta

function SceneFrame({ children }: { children: React.ReactNode }): JSX.Element {
    return (
        <div className="min-h-screen bg-bg-light text-default px-6 py-10">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-1">Install</h1>
                <p className="text-muted mb-8">
                    Once the wizard session is observed, this confirmation card replaces the install command block. The
                    live progress lives in the floating FAB.
                </p>
                <div className="max-w-2xl mx-auto">{children}</div>
            </div>
        </div>
    )
}

/** No session yet — tracker renders nothing (parent shows the command block). */
export const PreTakeover: StoryFn = withSession(null)

/** Live session in flight — AI-toned confirmation with the skill badge. */
export const Running: StoryFn = withSession(
    makeSession({
        run_phase: 'running',
    })
)

/** Connection blip while running — same card, sub-line shifts to "restoring connection". */
export const Reconnecting: StoryFn = function ReconnectingStory() {
    useMountedLogic(wizardProgressTrackerLogic)
    const streamLogic = wizardSessionStreamLogic({ workflowId: WORKFLOW_ID })
    useMountedLogic(streamLogic)

    useEffect(() => {
        streamLogic.actions.connectionOpened()
        streamLogic.actions.sessionUpdated(
            makeSession({
                run_phase: 'running',
            }) as any
        )
        const id = window.setTimeout(() => {
            streamLogic.actions.connectionErrored('EventSource transport error')
        }, 50)
        return () => window.clearTimeout(id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <SceneFrame>
            <WizardProgressTracker onManualSetup={() => alert('Open manual setup modal')} />
        </SceneFrame>
    )
}

/** Run finished cleanly — success card pointing the user at the Continue button. */
export const Completed: StoryFn = withSession(
    makeSession({
        run_phase: 'completed',
    })
)

/** Run hit an error — error card with type + message + manual-setup fallback. */
export const Errored: StoryFn = withSession(
    makeSession({
        run_phase: 'error',
        error: {
            type: 'CompositionError',
            message: 'Could not detect a writable .env file. Re-run from the project root and try again.',
        },
    })
)
