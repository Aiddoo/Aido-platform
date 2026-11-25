import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  CalendarImportIcon,
  HStack,
  Mascot,
  QueryErrorBoundary,
  Spacing,
  Steps,
  Text,
  VStack,
} from '@src/shared/ui';
import { Suspense } from 'react';
import { View } from 'react-native';
import {
  Directions,
  GestureDetector,
  useCompetingGestures,
  useFlingGesture,
} from 'react-native-gesture-handler';

import { RELEASE_1_17_0_STEPS } from '../constants/release-1-17-0.constants';
import { RELEASE_1_17_0, RELEASES } from '../constants/releases.constants';
import { WhatsNewPolicy } from '../domains/whats-new.model';
import { useWhatsNewFlow } from '../hooks/use-whats-new-flow';
import { useWhatsNewParams } from '../hooks/use-whats-new-params';
import {
  CalendarChoiceDemo,
  CalendarImportPlans,
  ImportDestinationDemo,
  ImportProgressDemo,
} from './calendar-import-demo';
import { WhatsNewStep } from './whats-new-step';

/** 왼쪽 끝은 iOS 스와이프 뒤로 가기 자리라 밀어 넘기기에서 뺀다 */
const SCREEN_EDGE_INSET = 24;
/** 마무리는 고를 카드가 아래에 붙어 있어, 작은 화면·큰 글꼴에서 그림이 먼저 줄고 질문 제목이 보이게 한다 */
const FINISH_MEDIA_MIN_HEIGHT = 120;
const INTRO_CAT_SIZE = 132;
const BUBBLE_ICON_SIZE = 18;

type Release1170Step = (typeof RELEASE_1_17_0_STEPS)[number];
type Release1170StepMap = Record<Release1170Step, Record<string, never>>;

function getStepPosition(step: Release1170Step): number {
  return RELEASE_1_17_0_STEPS.indexOf(step);
}

function findNextStep(step: Release1170Step): Release1170Step | null {
  return RELEASE_1_17_0_STEPS[getStepPosition(step) + 1] ?? null;
}

export function Release1170Steps() {
  const [{ source }] = useWhatsNewParams();
  const { t } = useTranslation(['whatsNew', 'todoImport', 'common']);
  const flow = useWhatsNewFlow({ release: RELEASE_1_17_0, source });
  const stepper = useStepper<Release1170StepMap>({
    id: 'whats-new-1.17.0',
    initial: { step: 'intro' },
    onStepChange: ({ step }) => flow.trackStepViewed({ step, index: getStepPosition(step) }),
  });
  const { step, history } = stepper;
  const position = getStepPosition(step);

  const goNext = () => {
    const next = findNextStep(step);
    if (next != null) {
      history.push(next);
    }
  };
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
        isNew={WhatsNewPolicy.getLatest(RELEASES).id === RELEASE_1_17_0.id}
        version={RELEASE_1_17_0.version}
        onClose={flow.close}
      />

      <Spacing size={8} />

      <GestureDetector gesture={fling}>
        {/* GestureDetector는 네이티브 View 자식 하나에 제스처를 붙인다 */}
        <View className="flex-1">
          <stepper.Render
            intro={() => (
              <WhatsNewStep
                media={<IntroMedia onNext={goNext} />}
                title={t('whatsNew:v1_17_0.intro.title')}
                description={t('whatsNew:v1_17_0.intro.description')}
              />
            )}
            chooseCalendars={() => (
              <WhatsNewStep
                media={<CalendarChoiceDemo />}
                title={t('whatsNew:v1_17_0.calendars.title')}
                description={t('whatsNew:v1_17_0.calendars.description')}
              />
            )}
            mapCategories={() => (
              <WhatsNewStep
                media={<ImportDestinationDemo />}
                title={t('whatsNew:v1_17_0.categories.title')}
                description={t('whatsNew:v1_17_0.categories.description')}
              />
            )}
            importing={() => (
              <WhatsNewStep
                media={<ImportProgressDemo />}
                title={t('whatsNew:v1_17_0.importing.title')}
                description={t('whatsNew:v1_17_0.importing.description', {
                  importLabel: t('todoImport:options.import'),
                })}
              />
            )}
            plans={() => (
              <WhatsNewStep
                media={
                  <QueryErrorBoundary fallback={CalendarImportPlans.Error}>
                    <Suspense fallback={<CalendarImportPlans.Loading />}>
                      <CalendarImportPlans />
                    </Suspense>
                  </QueryErrorBoundary>
                }
                title={t('whatsNew:v1_17_0.plans.title')}
                description={t('whatsNew:v1_17_0.plans.description')}
              />
            )}
            finish={() => (
              <WhatsNewStep
                media={<FinishMedia />}
                mediaMinHeight={FINISH_MEDIA_MIN_HEIGHT}
                title={t('whatsNew:v1_17_0.finish.title')}
                description={t('whatsNew:v1_17_0.finish.description')}
              />
            )}
          />
        </View>
      </GestureDetector>

      <Spacing size={12} />

      {step === 'finish' ? (
        <>
          <WhatsNewStep.FeatureCard
            Icon={CalendarImportIcon}
            title={t('todoImport:entry.menu')}
            description={t('whatsNew:v1_17_0.finish.card')}
            onPress={() => {
              flow.trackCta({ step, feature: RELEASE_1_17_0.cta.feature });
              flow.leaveTo(RELEASE_1_17_0.cta.href);
            }}
            testID="whats-new-open-todo-import"
          />

          <Spacing size={12} />

          <Button variant="weak" color="dark" onPress={flow.complete} testID="whats-new-later">
            {t('whatsNew:v1_17_0.finish.later')}
          </Button>
        </>
      ) : (
        <>
          <Box className="items-center">
            <Steps.Dots index={position} count={RELEASE_1_17_0_STEPS.length} />
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

function IntroMedia({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation(['whatsNew', 'todoImport']);

  return (
    <Box flex={1} className="justify-center overflow-hidden rounded-3xl bg-highlight p-3">
      <Mascot name="catHi" size={INTRO_CAT_SIZE} className="absolute -right-2.5 -bottom-6" />
      <WhatsNewStep.FeatureCard
        Icon={CalendarImportIcon}
        title={t('todoImport:entry.menu')}
        description={t('whatsNew:v1_17_0.intro.card')}
        onPress={onNext}
        testID="whats-new-intro-todo-import"
        className="bg-white"
      />
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
          <CalendarImportIcon
            width={fontScaledSize(BUBBLE_ICON_SIZE)}
            height={fontScaledSize(BUBBLE_ICON_SIZE)}
            colorClassName="text-main"
          />
          <Text size="b3" weight="semibold">
            {t('v1_17_0.finish.bubble')}
          </Text>
        </HStack>
        <Mascot name="catHi" className="aspect-square h-35 min-h-0 shrink" />
      </VStack>
    </Box>
  );
}
