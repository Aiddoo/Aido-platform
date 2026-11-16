import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import {
  AiFilledIcon,
  Box,
  Button,
  HStack,
  Mascot,
  ReportDuoIcon,
  Spacing,
  Steps,
  Text,
  VStack,
} from '@src/shared/ui';
import { useCallback } from 'react';
import { View } from 'react-native';
import {
  Directions,
  GestureDetector,
  useCompetingGestures,
  useFlingGesture,
} from 'react-native-gesture-handler';

import { RELEASE_1_16_0_STEPS } from '../constants/release-1-16-0.constants';
import { RELEASE_1_16_0, RELEASES } from '../constants/releases.constants';
import { getLatestRelease } from '../domains/whats-new.model';
import { useWhatsNewFlow } from '../hooks/use-whats-new-flow';
import { useWhatsNewParams } from '../hooks/use-whats-new-params';
import { FreeRecordDemo, ReportHoursDemo, ReportSummaryDemo } from './report-demo';
import { SuggestionListDemo, SuggestionRequestDemo } from './suggestion-demo';
import { WhatsNewStep } from './whats-new-step';

/** 왼쪽 끝은 iOS 스와이프 뒤로 가기 자리라 밀어 넘기기에서 뺀다 */
const SCREEN_EDGE_INSET = 24;
/** 마무리는 고를 카드가 아래에 붙어 있어, 작은 화면·큰 글꼴에서 그림이 먼저 줄고 질문 제목이 보이게 한다 */
const FINISH_MEDIA_MIN_HEIGHT = 120;
const FINISH_CAT_SIZE = 140;
const INTRO_CAT_SIZE = 132;
const BUBBLE_ICON_SIZE = 18;

type Release1160Step = (typeof RELEASE_1_16_0_STEPS)[number];
type Release1160StepMap = Record<Release1160Step, object>;

const CHAPTER_START_STEP = {
  suggestion: 'suggestionRequest',
  report: 'reportSummary',
} as const satisfies Record<string, Release1160Step>;
type Release1160Chapter = keyof typeof CHAPTER_START_STEP;

/** 소개에서 한 기능으로 건너뛰어도 진행 점은 기록 길이가 아니라 흐름 안의 자리를 가리킨다 */
function getStepPosition(step: Release1160Step): number {
  return RELEASE_1_16_0_STEPS.indexOf(step);
}

function findNextStep(step: Release1160Step): Release1160Step | null {
  return RELEASE_1_16_0_STEPS[getStepPosition(step) + 1] ?? null;
}

export function Release1160Steps() {
  const [{ source }] = useWhatsNewParams();
  const { t } = useTranslation(['whatsNew', 'common']);
  const flow = useWhatsNewFlow({ release: RELEASE_1_16_0, source });
  const stepper = useStepper<Release1160StepMap>({
    id: 'whats-new-1.16.0',
    initial: { step: 'intro', context: {} },
    onStepChange: ({ step }) => flow.trackStepViewed({ step, index: getStepPosition(step) }),
  });
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
        isNew={getLatestRelease(RELEASES).id === RELEASE_1_16_0.id}
        version={RELEASE_1_16_0.version}
        onClose={flow.close}
      />

      <Spacing size={8} />

      <GestureDetector gesture={fling}>
        {/* GestureDetector는 네이티브 View 자식 하나에 제스처를 붙인다 */}
        <View className="flex-1">
          <stepper.Render
            intro={() => (
              <WhatsNewStep
                media={
                  <IntroMedia
                    onSelect={(chapter) => history.push(CHAPTER_START_STEP[chapter], {})}
                  />
                }
                title={t('v1_16_0.intro.title')}
                description={t('v1_16_0.intro.description')}
              />
            )}
            suggestionRequest={() => (
              <WhatsNewStep
                media={<SuggestionRequestDemo />}
                title={t('v1_16_0.request.title')}
                description={t('v1_16_0.request.description')}
              />
            )}
            suggestionList={() => (
              <WhatsNewStep
                media={<SuggestionListDemo onMake={goNext} />}
                title={t('v1_16_0.suggestions.title')}
                description={t('v1_16_0.suggestions.description')}
              />
            )}
            reportSummary={() => (
              <WhatsNewStep
                media={<ReportSummaryDemo />}
                title={t('v1_16_0.summary.title')}
                description={t('v1_16_0.summary.description')}
              />
            )}
            reportHours={() => (
              <WhatsNewStep
                media={<ReportHoursDemo />}
                title={t('v1_16_0.hours.title')}
                description={t('v1_16_0.hours.description')}
              />
            )}
            freeRecord={() => (
              <WhatsNewStep
                media={<FreeRecordDemo />}
                title={t('v1_16_0.free.title')}
                description={t('v1_16_0.free.description')}
              />
            )}
            finish={() => (
              <WhatsNewStep
                media={<FinishMedia />}
                mediaMinHeight={FINISH_MEDIA_MIN_HEIGHT}
                title={t('v1_16_0.finish.title')}
                description={t('v1_16_0.finish.description')}
              />
            )}
          />
        </View>
      </GestureDetector>

      <Spacing size={12} />

      {step === 'finish' ? (
        <>
          <VStack gap={8}>
            <WhatsNewStep.FeatureCard
              Icon={AiFilledIcon}
              title={t('v1_16_0.finish.suggestion')}
              description={t('v1_16_0.suggestion.title')}
              onPress={() => {
                flow.trackCta({ step, feature: 'ai_suggestion' });
                flow.leaveTo(RELEASE_1_16_0.cta.href);
              }}
              testID="whats-new-open-suggestions"
            />
            <WhatsNewStep.FeatureCard
              Icon={ReportDuoIcon}
              title={t('v1_16_0.finish.report')}
              description={t('v1_16_0.report.title')}
              onPress={() => {
                flow.trackCta({ step, feature: 'ai_report' });
                flow.leaveTo('/reports');
              }}
              testID="whats-new-open-reports"
            />
          </VStack>

          <Spacing size={12} />

          <Button variant="weak" color="dark" onPress={flow.complete} testID="whats-new-later">
            {t('v1_16_0.finish.later')}
          </Button>
        </>
      ) : (
        <>
          <Box className="items-center">
            <Steps.Dots index={position} count={RELEASE_1_16_0_STEPS.length} />
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

function IntroMedia({ onSelect }: { onSelect: (chapter: Release1160Chapter) => void }) {
  const { t } = useTranslation(['whatsNew', 'subscription']);

  return (
    <Box flex={1} className="justify-center overflow-hidden rounded-3xl bg-highlight p-3">
      <Mascot
        name="catSuggestion"
        size={INTRO_CAT_SIZE}
        className="absolute -right-2.5 -bottom-6"
      />
      <VStack gap={8}>
        <WhatsNewStep.FeatureCard
          Icon={AiFilledIcon}
          title={t('whatsNew:v1_16_0.suggestion.title')}
          description={t('whatsNew:v1_16_0.suggestion.description')}
          badge={t('subscription:tier.premium')}
          onPress={() => onSelect('suggestion')}
          testID="whats-new-intro-suggestion"
          className="bg-white"
        />
        <WhatsNewStep.FeatureCard
          Icon={ReportDuoIcon}
          title={t('whatsNew:v1_16_0.report.title')}
          description={t('whatsNew:v1_16_0.report.description')}
          badge={t('subscription:tier.premium')}
          onPress={() => onSelect('report')}
          testID="whats-new-intro-report"
          className="bg-white"
        />
      </VStack>
    </Box>
  );
}

function FinishMedia() {
  const { t } = useTranslation('whatsNew');
  const fontScaledSize = useFontScaledSize();

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
          <AiFilledIcon
            width={fontScaledSize(BUBBLE_ICON_SIZE)}
            height={fontScaledSize(BUBBLE_ICON_SIZE)}
            colorClassName="text-main"
          />
          <Text size="b3" weight="semibold">
            {t('v1_16_0.finish.bubble')}
          </Text>
        </HStack>
        <Mascot
          name="catSuggestion"
          style={{ height: FINISH_CAT_SIZE, aspectRatio: 1, flexShrink: 1, minHeight: 0 }}
        />
      </VStack>
    </Box>
  );
}
