import { useActions, useValues } from 'kea'

import { LemonButton, LemonModal } from '@posthog/lemon-ui'

import { OnboardingStepKey, type SDK } from '~/types'

import { OnboardingStep } from '../../../OnboardingStep'
import { AdblockWarning, RealtimeCheckIndicator } from '../../RealtimeCheckIndicator'
import { SDKGrid } from '../SDKGrid'
import { SDKInstructionsModal } from '../SDKInstructionsModal'
import { VariantProps } from '../types'
import { WizardCommandBlock } from '../WizardCommandBlock'
import { wizardInstallStepLogic } from '../wizardInstallStepLogic'
import { WizardProgressTracker } from '../WizardProgressTracker'
import { WizardInstallIntro } from './WizardInstallIntro'

/**
 * Default install step for non-Logs onboarding flows. Wizard-centered: the SDK
 * grid lives behind a "Need to set up manually?" link.
 *
 * Owns its own SDKInstructionsModal because the manual-setup flow is nested —
 * picking an SDK in the manual modal closes it and opens the instructions
 * modal; closing the instructions modal reopens manual setup. The shared modal
 * in the parent OnboardingInstallStep is skipped here.
 */
export function WizardInstallStep({
    sdkGridProps,
    sdkInstructionMap,
    adblockResult,
    installationComplete,
    listeningForName,
    teamPropertyToVerify,
    selectedSDK,
    header,
}: VariantProps): JSX.Element {
    const { manualModalOpen, sdkInstructionsOpen, isTakeoverActive } = useValues(wizardInstallStepLogic)
    const { setManualModalOpen, setSdkInstructionsOpen } = useActions(wizardInstallStepLogic)

    const handleManualSDKClick = (sdk: SDK): void => {
        sdkGridProps.onSDKClick(sdk)
        setManualModalOpen(false)
        setSdkInstructionsOpen(true)
    }

    // While the wizard is in flight, trust it and let the user proceed —
    // installation events aren't required to unblock Continue.
    const continueDisabledReason = isTakeoverActive || installationComplete ? undefined : 'Installation is not complete'

    return (
        <OnboardingStep
            title="Install"
            stepKey={OnboardingStepKey.INSTALL}
            continueDisabledReason={continueDisabledReason}
            showSkip={!installationComplete && !isTakeoverActive}
            actions={
                <div className="pr-2">
                    <RealtimeCheckIndicator
                        teamPropertyToVerify={teamPropertyToVerify}
                        listeningForName={listeningForName}
                    />
                </div>
            }
        >
            {header}
            {!installationComplete && <AdblockWarning adblockResult={adblockResult} />}
            <div className="mt-6 space-y-8">
                {isTakeoverActive ? (
                    <WizardProgressTracker />
                ) : (
                    <>
                        <WizardInstallIntro />
                        <div className="max-w-xl mx-auto">
                            <WizardCommandBlock />
                        </div>
                    </>
                )}

                <div className="text-center">
                    <LemonButton type="tertiary" size="small" onClick={() => setManualModalOpen(true)}>
                        Need to set up manually?
                    </LemonButton>
                </div>
            </div>

            <LemonModal
                isOpen={manualModalOpen}
                onClose={() => setManualModalOpen(false)}
                title="Manual SDK setup"
                width="80vw"
            >
                <div className="p-4">
                    <SDKGrid {...{ ...sdkGridProps, onSDKClick: handleManualSDKClick }} showTopControls />
                </div>
            </LemonModal>

            {selectedSDK && (
                <SDKInstructionsModal
                    isOpen={sdkInstructionsOpen && !manualModalOpen}
                    onClose={() => {
                        setSdkInstructionsOpen(false)
                        setManualModalOpen(true)
                    }}
                    sdk={selectedSDK}
                    sdkInstructionMap={sdkInstructionMap}
                    adblockResult={adblockResult}
                    verifyingProperty={teamPropertyToVerify}
                    verifyingName={listeningForName}
                />
            )}
        </OnboardingStep>
    )
}
