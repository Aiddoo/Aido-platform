import { useStartVoiceNote } from '@src/features/voice/hooks/use-start-voice-note';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { Box, Spacing, Steps } from '@src/shared/ui';
import { View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { match } from 'ts-pattern';

import { VOICE_NOTE_MEDIA, VOICE_TODO_MEDIA } from '../constants/release-1-15-0-media';
import { RELEASE_1_15_0, RELEASES } from '../constants/releases';
import { WhatsNewPolicy } from '../domains/whats-new.model';
import { useStepFling } from '../hooks/use-step-fling';
import { useWhatsNewFlow } from '../hooks/use-whats-new-flow';
import { useWhatsNewParams } from '../hooks/use-whats-new-params';
import { WhatsNewStep } from './whats-new-step';

const STEP_COUNT = 2;

type Release1150StepMap = {
  voiceTodo: object;
  voiceNote: object;
};

export function Release1150Steps() {
  const [{ source }] = useWhatsNewParams();
  const { t } = useTranslation(['whatsNew', 'common']);
  const flow = useWhatsNewFlow({ release: RELEASE_1_15_0, source });
  const startVoiceNote = useStartVoiceNote();
  const stepper = useStepper<Release1150StepMap>({
    initial: { step: 'voiceTodo', context: {} },
    onStepChange: flow.trackStepViewed,
  });
  const isLast = stepper.step === 'voiceNote';

  const goNext = () => {
    match(stepper.step)
      .with('voiceTodo', () => stepper.history.push('voiceNote', {}))
      .with('voiceNote', () => undefined)
      .exhaustive();
  };
  const fling = useStepFling({ onNext: goNext, onBack: stepper.history.back });

  return (
    <>
      <WhatsNewStep.Header
        isNew={WhatsNewPolicy.getLatestRelease(RELEASES).id === RELEASE_1_15_0.id}
        onClose={flow.close}
      />

      <Spacing size={8} />

      <GestureDetector gesture={fling}>
        <View style={{ flex: 1 }}>
          <stepper.Render
            voiceTodo={() => (
              <WhatsNewStep
                media={
                  <WhatsNewStep.Media
                    sources={VOICE_TODO_MEDIA}
                    alt={t('v1_15_0.voiceTodo.mediaLabel')}
                  />
                }
                title={t('v1_15_0.voiceTodo.title')}
                description={t('v1_15_0.voiceTodo.description')}
                actionLabel={t('v1_15_0.voiceTodo.action')}
                onAction={() => {
                  flow.trackCta({ step: 'voiceTodo', feature: 'voice_quick' });
                  flow.leaveTo({ pathname: '/todo/new', params: { voiceHint: '1' } });
                }}
              />
            )}
            voiceNote={() => (
              <WhatsNewStep
                media={
                  <WhatsNewStep.Media
                    sources={VOICE_NOTE_MEDIA}
                    alt={t('v1_15_0.voiceNote.mediaLabel')}
                  />
                }
                title={t('v1_15_0.voiceNote.title')}
                description={t('v1_15_0.voiceNote.description')}
                actionLabel={t('v1_15_0.voiceNote.action')}
                onAction={() => {
                  flow.trackCta({ step: 'voiceNote', feature: 'voice_note' });
                  startVoiceNote({ navigate: flow.leaveTo });
                }}
              />
            )}
          />
        </View>
      </GestureDetector>

      <Spacing size={12} />

      <Box className="items-center">
        <Steps.Dots index={stepper.index} count={STEP_COUNT} />
      </Box>

      <Spacing size={16} />

      <Steps.Buttons
        index={stepper.index}
        isLast={isLast}
        backLabel={t('common:actions.back')}
        nextLabel={isLast ? t('common:actions.done') : t('common:actions.continue')}
        onBack={stepper.history.back}
        onNext={isLast ? flow.complete : goNext}
      />
    </>
  );
}
