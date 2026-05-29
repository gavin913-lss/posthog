import { actions, connect, kea, path, reducers, selectors } from 'kea'

import type { wizardInstallStepLogicType } from './wizardInstallStepLogicType'
import { wizardProgressTrackerLogic } from './wizardProgressTrackerLogic'

export const wizardInstallStepLogic = kea<wizardInstallStepLogicType>([
    path(['scenes', 'onboarding', 'wizardInstallStepLogic']),
    connect(() => ({
        values: [wizardProgressTrackerLogic, ['displayState', 'sessionIsCurrent']],
    })),
    actions({
        setManualModalOpen: (open: boolean) => ({ open }),
        setSdkInstructionsOpen: (open: boolean) => ({ open }),
    }),
    reducers({
        manualModalOpen: [
            false,
            {
                setManualModalOpen: (_, { open }) => open,
            },
        ],
        sdkInstructionsOpen: [
            false,
            {
                setSdkInstructionsOpen: (_, { open }) => open,
            },
        ],
    }),
    selectors({
        // True once the wizard has produced a current session. Used to swap the
        // command block for the confirmation banner AND to unlock the OnboardingStep's
        // Continue button without waiting for the first event to come through.
        isTakeoverActive: [
            (s) => [s.displayState, s.sessionIsCurrent],
            (displayState, sessionIsCurrent): boolean => displayState !== 'preTakeover' && sessionIsCurrent,
        ],
    }),
])
