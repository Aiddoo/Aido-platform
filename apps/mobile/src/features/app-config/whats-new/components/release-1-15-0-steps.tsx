import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  Box,
  Button,
  HStack,
  IconCircle,
  MicIcon,
  QueryErrorBoundary,
  ReportDuoIcon,
  Spacing,
  Steps,
  type StyledIcon,
  Text,
  VoiceDuoIcon,
  VStack,
  WordWrapText,
  Mascot,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { Chip, PressableFeedback } from 'heroui-native';
import { type ComponentProps, Suspense, useCallback, useState } from 'react';
import { View } from 'react-native';
import {
  Directions,
  GestureDetector,
  useCompetingGestures,
  useFlingGesture,
} from 'react-native-gesture-handler';

import { DEMO_PLANNED_TODOS, RELEASE_1_15_0_STEPS } from '../constants/release-1-15-0.constants';
import { RELEASE_1_15_0, RELEASES } from '../constants/releases';
import { WhatsNewPolicy } from '../domains/whats-new.model';
import { useWhatsNewFlow } from '../hooks/use-whats-new-flow';
import { useWhatsNewParams } from '../hooks/use-whats-new-params';
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
/** 마무리는 고를 카드가 아래에 붙어 있어, 작은 화면·큰 글꼴에서 그림이 먼저 줄고 질문 제목이 보이게 한다 */
const FINISH_MEDIA_MIN_HEIGHT = 120;
const FINISH_CAT_SIZE = 140;
const FEATURE_ICON_CIRCLE_SIZE = 40;
const FEATURE_ICON_SIZE = 22;

type Release1150Step = (typeof RELEASE_1_15_0_STEPS)[number];
type Release1150StepMap = Record<Release1150Step, object>;

/** 소개에서 고른 기능의 첫 장면 */
const CHAPTER_START_STEP = {
  voiceTodo: 'voiceTodoCapture',
  voiceNote: 'voiceNoteRecord',
} as const satisfies Record<string, Release1150Step>;
type Release1150Chapter = keyof typeof CHAPTER_START_STEP;

/** 소개에서 한 기능으로 건너뛰어도 진행 점은 기록 길이가 아니라 흐름 안의 자리를 가리킨다 */
function getStepPosition(step: Release1150Step): number {
  return RELEASE_1_15_0_STEPS.indexOf(step);
}

function findNextStep(step: Release1150Step): Release1150Step | null {
  return RELEASE_1_15_0_STEPS[getStepPosition(step) + 1] ?? null;
}

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
  const flingNext = useFlingGesture({
    direction: Directions.LEFT,
    runOnJS: true,
    onDeactivate: goNext,
  });
  const flingBack = useFlingGesture({
    direction: Directions.RIGHT,
    hitSlop: { left: -SCREEN_EDGE_INSET },
    runOnJS: true,
    onDeactivate: history.back,
  });
  const fling = useCompetingGestures(flingNext, flingBack);

  return (
    <>
      <WhatsNewStep.Header
        isNew={WhatsNewPolicy.getLatestRelease(RELEASES).id === RELEASE_1_15_0.id}
        version={RELEASE_1_15_0.version}
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
                    onSelect={(chapter) => history.push(CHAPTER_START_STEP[chapter], {})}
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
                mediaMinHeight={FINISH_MEDIA_MIN_HEIGHT}
                title={t('v1_15_0.finish.title')}
                description={t('v1_15_0.finish.description')}
              />
            )}
          />
        </View>
      </GestureDetector>

      <Spacing size={12} />

      {step === 'finish' ? (
        <>
          <VStack gap={8}>
            <FeatureCard
              Icon={VoiceDuoIcon}
              title={t('v1_15_0.finish.voiceTodo')}
              description={t('v1_15_0.voiceTodo.title')}
              onPress={() => {
                flow.trackCta({ step, feature: 'voice_quick' });
                flow.leaveTo(RELEASE_1_15_0.cta.href);
              }}
              testID="whats-new-start-voice-todo"
            />
            <FeatureCard
              Icon={ReportDuoIcon}
              title={t('v1_15_0.finish.voiceNote')}
              description={t('v1_15_0.voiceNote.title')}
              onPress={() => {
                flow.trackCta({ step, feature: 'voice_note' });
                flow.leaveTo({ pathname: '/memo', params: { startVoiceNote: '1' } });
              }}
              testID="whats-new-start-voice-note"
            />
          </VStack>

          <Spacing size={12} />

          <Button variant="weak" color="dark" onPress={flow.complete} testID="whats-new-later">
            {t('v1_15_0.finish.later')}
          </Button>
        </>
      ) : (
        <>
          <Box className="items-center">
            <Steps.Dots index={position} count={RELEASE_1_15_0_STEPS.length} />
          </Box>

          <Spacing size={16} />

          <Steps.Buttons
            index={position}
            isLast={false}
            backLabel={t('common:actions.back')}
            nextLabel={t('common:actions.continue')}
            onBack={history.back}
            onNext={goNext}
          />
        </>
      )}
    </>
  );
}

function IntroMedia({ onSelect }: { onSelect: (chapter: Release1150Chapter) => void }) {
  const { t } = useTranslation('whatsNew');

  return (
    <Box flex={1} className="justify-center overflow-hidden rounded-3xl bg-highlight p-3">
      <Mascot name="catHi" size={132} className="absolute -bottom-6 -right-2.5" />
      <VStack gap={8}>
        <FeatureCard
          Icon={VoiceDuoIcon}
          title={t('v1_15_0.voiceTodo.title')}
          description={t('v1_15_0.voiceTodo.description')}
          badge={t('v1_15_0.voiceTodo.badge')}
          onPress={() => onSelect('voiceTodo')}
          testID="whats-new-intro-voice-todo"
          className="bg-white"
        />
        <FeatureCard
          Icon={ReportDuoIcon}
          title={t('v1_15_0.voiceNote.title')}
          description={t('v1_15_0.voiceNote.description')}
          badge={t('v1_15_0.voiceNote.badge')}
          onPress={() => onSelect('voiceNote')}
          testID="whats-new-intro-voice-note"
          className="bg-white"
        />
      </VStack>
    </Box>
  );
}

interface FeatureCardProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'onPress'
> {
  Icon: StyledIcon;
  title: string;
  description: string;
  badge?: string;
  onPress: () => void;
}

/** 소개와 마무리가 같은 카드로 이어진다. 바탕은 놓인 면에 따라 쓰는 쪽이 정한다 */
function FeatureCard({
  Icon,
  title,
  description,
  badge,
  onPress,
  className,
  ...pressableProps
}: FeatureCardProps) {
  const fontScaledSize = useFontScaledSize();
  const handlePress = useSingleTap(onPress);

  return (
    <PressableFeedback
      accessibilityRole="button"
      onPress={handlePress}
      className={cn('rounded-2xl bg-gray-1 p-4', className)}
      {...pressableProps}
    >
      <HStack gap={12} align="center">
        <IconCircle
          tone="plain"
          className="bg-main/10"
          style={{
            width: fontScaledSize(FEATURE_ICON_CIRCLE_SIZE),
            height: fontScaledSize(FEATURE_ICON_CIRCLE_SIZE),
          }}
          icon={
            <Icon
              width={fontScaledSize(FEATURE_ICON_SIZE)}
              height={fontScaledSize(FEATURE_ICON_SIZE)}
              colorClassName="text-main"
            />
          }
        />
        <VStack flex={1} gap={4}>
          {badge != null && (
            <Chip
              size="sm"
              variant="soft"
              color="accent"
              pointerEvents="none"
              className="self-start"
            >
              <Text
                size="e1"
                weight="semibold"
                numberOfLines={1}
                className="text-accent-soft-foreground"
              >
                {badge}
              </Text>
            </Chip>
          )}
          <Text size="b3" weight="semibold" lineBreakStrategyIOS="hangul-word">
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
    <Box
      flex={1}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="overflow-hidden rounded-3xl bg-highlight"
    >
      {/* 그림 높이가 무대를 늘리지 않고 남은 자리에 맞춰 고양이가 줄어든다 */}
      <VStack align="center" justify="center" gap={8} className="absolute inset-0 p-3">
        <HStack gap={6} align="center" className="rounded-2xl bg-white px-4 py-3">
          <MicIcon width={18} height={18} colorClassName="text-main" />
          <Text size="b3" weight="semibold">
            {t('v1_15_0.finish.bubble')}
          </Text>
        </HStack>
        <Mascot
          name="catHi"
          style={{ height: FINISH_CAT_SIZE, aspectRatio: 1, flexShrink: 1, minHeight: 0 }}
        />
      </VStack>
    </Box>
  );
}
