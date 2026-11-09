import catHiImage from '@assets/images/ido_cat_hi.webp';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  Box,
  Button,
  HStack,
  Image,
  MicIcon,
  QueryErrorBoundary,
  ReportDuoIcon,
  Spacing,
  Steps,
  type StyledIcon,
  Text,
  TextButton,
  VoiceDuoIcon,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';

import { DEMO_PLANNED_TODOS, RELEASE_1_15_0_STEPS } from '../constants/release-1-15-0.constants';
import { RELEASE_1_15_0, RELEASES } from '../constants/releases';
import { WhatsNewPolicy } from '../domains/whats-new.model';
import { useWhatsNewFlow } from '../hooks/use-whats-new-flow';
import { useWhatsNewParams } from '../hooks/use-whats-new-params';
import {
  findNextStep,
  getChapterStartStep,
  getStepPosition,
  type Release1150Chapter,
  type Release1150Step,
} from '../utils/release-1-15-0-steps';
import { VoiceNoteRecordDemo, VoiceNoteResultDemo } from './voice-note-demo';
import {
  type DemoPlannedTodoId,
  VoiceTodoCaptureDemo,
  VoiceTodoListDemo,
  VoiceTodoReviewDemo,
} from './voice-todo-demo';
import { WhatsNewFreeQuota } from './whats-new-free-quota';
import { WhatsNewStep } from './whats-new-step';

/** 왼쪽 끝은 iOS 스와이프 뒤로 가기 자리라 밀어 넘기기에서 뺀다 */
const SCREEN_EDGE_INSET = 24;
const INTRO_ICON_TILE_SIZE = 40;
const INTRO_ICON_SIZE = 24;

type Release1150StepMap = Record<Release1150Step, object>;

export function Release1150Steps() {
  const [{ source }] = useWhatsNewParams();
  const { t } = useTranslation(['whatsNew', 'common']);
  const flow = useWhatsNewFlow({ release: RELEASE_1_15_0, source });
  const stepper = useStepper<Release1150StepMap>({
    id: 'whats-new-1.15.0',
    initial: { step: 'intro', context: {} },
    onStepChange: ({ step }) => flow.trackStepViewed({ step, index: getStepPosition(step) }),
  });
  // 고르기 장면에서 체크한 예시만 목록 장면에 넣으려고 두 장면 위에서 들고 있다
  const [addedTodoIds, setAddedTodoIds] = useState<DemoPlannedTodoId[]>(
    DEMO_PLANNED_TODOS.map(({ id }) => id),
  );
  const { step, history } = stepper;
  const position = getStepPosition(step);

  const goNext = useCallback(() => {
    const next = findNextStep(step);
    if (next != null) {
      history.push(next, {});
    }
  }, [step, history]);
  // 페이저 없이 현재 단계만 그리고, 옆으로 밀면 단계를 넘긴다. 움직이는 동안 React는 다시 그려지지 않는다
  const fling = useMemo(
    () =>
      Gesture.Race(
        Gesture.Fling().direction(Directions.LEFT).runOnJS(true).onEnd(goNext),
        Gesture.Fling()
          .direction(Directions.RIGHT)
          .hitSlop({ left: -SCREEN_EDGE_INSET })
          .runOnJS(true)
          .onEnd(history.back),
      ),
    [goNext, history.back],
  );

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
            intro={() => (
              <WhatsNewStep
                media={
                  <IntroMedia
                    onSelect={(chapter) => history.push(getChapterStartStep(chapter), {})}
                  />
                }
                title={t('v1_15_0.intro.title')}
                description={t('v1_15_0.intro.description')}
              />
            )}
            voiceTodoCapture={() => (
              <WhatsNewStep
                media={<VoiceTodoCaptureDemo onFinish={goNext} />}
                title={t('v1_15_0.capture.title')}
                description={t('v1_15_0.capture.description')}
              />
            )}
            voiceTodoReview={() => (
              <WhatsNewStep
                media={
                  <VoiceTodoReviewDemo
                    value={addedTodoIds}
                    onValueChange={setAddedTodoIds}
                    onApply={goNext}
                  />
                }
                title={t('v1_15_0.review.title')}
                description={t('v1_15_0.review.description')}
              />
            )}
            voiceTodoList={() => (
              <WhatsNewStep
                media={<VoiceTodoListDemo addedTodoIds={addedTodoIds} />}
                title={t('v1_15_0.list.title')}
                description={t('v1_15_0.list.description')}
              />
            )}
            voiceNoteRecord={() => (
              <WhatsNewStep
                media={<VoiceNoteRecordDemo />}
                title={t('v1_15_0.record.title')}
                description={t('v1_15_0.record.description')}
              />
            )}
            voiceNoteResult={() => (
              <WhatsNewStep
                media={<VoiceNoteResultDemo />}
                title={t('v1_15_0.result.title')}
                description={t('v1_15_0.result.description')}
              />
            )}
            freeQuota={() => (
              <WhatsNewStep
                media={
                  <QueryErrorBoundary fallback={WhatsNewFreeQuota.Error}>
                    <Suspense fallback={<WhatsNewFreeQuota.Loading />}>
                      <WhatsNewFreeQuota />
                    </Suspense>
                  </QueryErrorBoundary>
                }
                title={t('v1_15_0.quota.title')}
                description={t('v1_15_0.quota.description')}
              />
            )}
            finish={() => (
              <WhatsNewStep
                media={<FinishMedia />}
                title={t('v1_15_0.finish.title')}
                description={t('v1_15_0.finish.description')}
              />
            )}
          />
        </View>
      </GestureDetector>

      <Spacing size={12} />

      <Box className="items-center">
        <Steps.Dots index={position} count={RELEASE_1_15_0_STEPS.length} />
      </Box>

      <Spacing size={16} />

      {step === 'finish' ? (
        <VStack gap={8}>
          <Button
            size="large"
            onPress={() => {
              flow.trackCta({ step, feature: 'voice_quick' });
              flow.leaveTo({ pathname: '/todo/new', params: { startVoice: '1' } });
            }}
            testID="whats-new-start-voice-todo"
          >
            {t('v1_15_0.finish.voiceTodo')}
          </Button>
          <Button
            size="large"
            variant="weak"
            onPress={() => {
              flow.trackCta({ step, feature: 'voice_note' });
              flow.leaveTo({ pathname: '/memo', params: { startVoiceNote: '1' } });
            }}
            testID="whats-new-start-voice-note"
          >
            {t('v1_15_0.finish.voiceNote')}
          </Button>
          <TextButton className="self-center" onPress={flow.complete} testID="whats-new-later">
            {t('v1_15_0.finish.later')}
          </TextButton>
        </VStack>
      ) : (
        <Steps.Buttons
          index={position}
          isLast={false}
          backLabel={t('common:actions.back')}
          nextLabel={t('common:actions.continue')}
          onBack={history.back}
          onNext={goNext}
        />
      )}
    </>
  );
}

function IntroMedia({ onSelect }: { onSelect: (chapter: Release1150Chapter) => void }) {
  const { t } = useTranslation('whatsNew');

  return (
    <Box flex={1} className="justify-center overflow-hidden rounded-3xl bg-highlight p-3">
      <Image
        source={catHiImage}
        accessibilityIgnoresInvertColors
        className="absolute -bottom-6 -right-2.5 size-[132px]"
        contentFit="contain"
      />
      <VStack gap={8}>
        <IntroFeatureButton
          Icon={VoiceDuoIcon}
          title={t('v1_15_0.voiceTodo.title')}
          description={t('v1_15_0.voiceTodo.description')}
          onPress={() => onSelect('voiceTodo')}
          testID="whats-new-intro-voice-todo"
        />
        <IntroFeatureButton
          Icon={ReportDuoIcon}
          title={t('v1_15_0.voiceNote.title')}
          description={t('v1_15_0.voiceNote.description')}
          onPress={() => onSelect('voiceNote')}
          testID="whats-new-intro-voice-note"
        />
      </VStack>
    </Box>
  );
}

interface IntroFeatureButtonProps {
  Icon: StyledIcon;
  title: string;
  description: string;
  onPress: () => void;
  testID: string;
}

function IntroFeatureButton({
  Icon,
  title,
  description,
  onPress,
  testID,
}: IntroFeatureButtonProps) {
  const fontScaledSize = useFontScaledSize();

  return (
    <PressableFeedback
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      className="rounded-2xl bg-white p-4"
    >
      <HStack gap={12} align="center">
        <Box
          className="items-center justify-center rounded-xl bg-main/10"
          style={{
            width: fontScaledSize(INTRO_ICON_TILE_SIZE),
            height: fontScaledSize(INTRO_ICON_TILE_SIZE),
          }}
        >
          <Icon
            width={fontScaledSize(INTRO_ICON_SIZE)}
            height={fontScaledSize(INTRO_ICON_SIZE)}
            colorClassName="text-main"
          />
        </Box>
        <VStack flex={1} gap={2}>
          <Text size="b3" weight="semibold">
            {title}
          </Text>
          <WordWrapText size="e1" shade={6}>
            {description}
          </WordWrapText>
        </VStack>
        <ArrowRightIcon width={16} height={16} colorClassName="text-gray-5" />
      </HStack>
    </PressableFeedback>
  );
}

function FinishMedia() {
  const { t } = useTranslation('whatsNew');

  return (
    <VStack
      flex={1}
      align="center"
      justify="center"
      gap={8}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="overflow-hidden rounded-3xl bg-highlight"
    >
      <HStack gap={6} align="center" className="rounded-2xl bg-white px-4 py-3">
        <MicIcon width={18} height={18} colorClassName="text-main" />
        <Text size="b3" weight="semibold">
          {t('v1_15_0.finish.bubble')}
        </Text>
      </HStack>
      <Image
        source={catHiImage}
        accessibilityIgnoresInvertColors
        className="size-[140px]"
        contentFit="contain"
      />
    </VStack>
  );
}
