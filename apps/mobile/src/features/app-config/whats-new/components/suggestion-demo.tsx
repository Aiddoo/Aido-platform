import type { DayOfWeek } from '@aido/api/vocabulary';
import { SuggestionStatus } from '@src/features/assistant/suggestion/components/suggestion-status';
import { SuggestionsList } from '@src/features/assistant/suggestion/components/suggestions-list';
import type { AiSuggestion } from '@src/features/assistant/suggestion/domains/ai-suggestion.model';
import {
  selectTimeFormat,
  useGetPreferenceQueryOptions,
} from '@src/features/identity/preference/queries/preference.queries';
import { ANIMATION } from '@src/shared/constants/animation';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import { toZonedInstant } from '@src/shared/date/zoned';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, ScallopedContainer } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Animated, { FadeIn, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { DEMO_SCRIPT_MS } from '../constants/release-1-16-0.constants';
import { useDemoScript } from '../hooks/use-demo-script';
import { WhatsNewStep } from './whats-new-step';

/** 최근 2주 기록에서 찾았다고 보여 줄 제안이다. 제목은 카탈로그 `v1_16_0.demo.suggestions`에 있다 */
const DEMO_SUGGESTIONS = [
  {
    id: 'workout',
    daysOfWeek: ['MON', 'WED', 'FRI'],
    scheduledTime: '07:00',
    evidence: { recordedCount: 6, completedCount: 5, periodDays: 14 },
  },
  {
    id: 'vitamins',
    daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    scheduledTime: '08:30',
    evidence: { recordedCount: 10, completedCount: 9, periodDays: 14 },
  },
] as const satisfies readonly {
  id: string;
  daysOfWeek: readonly DayOfWeek[];
  scheduledTime: string;
  evidence: { recordedCount: number; completedCount: number; periodDays: number };
}[];

/** 서버가 알려 주는 다음 아침 분석 시각(현지 9시)과 같다 */
const DEMO_NEXT_ANALYSIS_TIME = '09:00';

type DemoSuggestion = (typeof DEMO_SUGGESTIONS)[number];
/** 서버에 없는 예시 제안이라 처리 요청에 쓰지 않는 id다. 행은 예시 이름으로 구분한다 */
const UNSENT_SUGGESTION_ID = 0;
type DemoSuggestionId = DemoSuggestion['id'];

const ROW_ENTERING = FadeIn.duration(ANIMATION.durationMs.slow).reduceMotion(ReduceMotion.System);
const ROW_LAYOUT = LinearTransition.duration(ANIMATION.durationMs.slow).reduceMotion(
  ReduceMotion.System,
);

export function SuggestionRequestDemo() {
  const [isRequested, setIsRequested] = useState(false);

  return (
    <WhatsNewStep.Stage>
      <ScallopedContainer>
        {isRequested ? (
          <RequestedStatus />
        ) : (
          <WaitingStatus onRequest={() => setIsRequested(true)} />
        )}
      </ScallopedContainer>
    </WhatsNewStep.Stage>
  );
}

function WaitingStatus({ onRequest }: { onRequest: () => void }) {
  const { t } = useTranslation('ai');
  const todayKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();

  // 예시라 설정을 받기까지 기다리지 않고 기본 표기로 먼저 보인다
  const { data: preference } = useQuery(useGetPreferenceQueryOptions());

  const timeFormat = selectTimeFormat(preference);
  const nextAnalysisAt = toZonedInstant({
    date: addDaysToDateKey(todayKey, 1),
    time: DEMO_NEXT_ANALYSIS_TIME,
    timezone: dateFormatContext.timezone,
  });

  return (
    <SuggestionStatus.NextAnalysis
      title={t('suggestions.status.waitingForNextRun')}
      nextAnalysisAt={nextAnalysisAt}
      timeFormat={timeFormat}
    >
      <Button size="small" display="inline" onPress={onRequest} testID="whats-new-request-now">
        {t('suggestions.status.requestNow')}
      </Button>
    </SuggestionStatus.NextAnalysis>
  );
}

function RequestedStatus() {
  const { t } = useTranslation('ai');
  const foundCount = useDemoScript({
    frameCount: 1,
    frameMs: 0,
    startDelayMs: DEMO_SCRIPT_MS.analyzingCard,
  });

  if (foundCount === 0) {
    return <SuggestionStatus.Analyzing />;
  }

  // 소개 장면은 아래에 제안 줄이 없어 분석 중과 같은 높이를 남겨 카드가 줄어들지 않게 한다
  return (
    <SuggestionStatus.Message
      title={t('suggestions.status.hasSuggestions', { count: DEMO_SUGGESTIONS.length })}
      description={t('suggestions.status.hasSuggestionsDescription')}
    >
      <SuggestionStatus.ActionRow />
    </SuggestionStatus.Message>
  );
}

interface SuggestionListDemoProps {
  /** 예시 제안을 반복으로 만들면 다음 장면으로 넘어간다 */
  onNext: () => void;
}

export function SuggestionListDemo({ onNext }: SuggestionListDemoProps) {
  const { t } = useTranslation('whatsNew');

  // 예시라 설정을 받기까지 기다리지 않고 기본 표기로 먼저 보인다
  const { data: preference } = useQuery(useGetPreferenceQueryOptions());

  const [dismissedIds, setDismissedIds] = useState<readonly DemoSuggestionId[]>([]);

  const shownCount = useDemoScript({
    frameCount: DEMO_SUGGESTIONS.length,
    frameMs: DEMO_SCRIPT_MS.suggestionRow,
  });

  const timeFormat = selectTimeFormat(preference);
  const shownSuggestions = DEMO_SUGGESTIONS.slice(0, shownCount).filter(
    ({ id }) => !dismissedIds.includes(id),
  );

  return (
    <WhatsNewStep.Stage>
      {shownSuggestions.length > 0 && (
        <Animated.View entering={ROW_ENTERING}>
          <ScallopedContainer>
            <Box className="px-4 py-2">
              {shownSuggestions.map((suggestion, index) => (
                <Animated.View key={suggestion.id} entering={ROW_ENTERING} layout={ROW_LAYOUT}>
                  <SuggestionsList.Item
                    suggestion={toDemoSuggestion(
                      suggestion,
                      t(`v1_16_0.demo.suggestions.${suggestion.id}`),
                    )}
                    timeFormat={timeFormat}
                    onMake={onNext}
                    onDismiss={() => setDismissedIds((current) => [...current, suggestion.id])}
                    isLast={index === shownSuggestions.length - 1}
                  />
                </Animated.View>
              ))}
            </Box>
          </ScallopedContainer>
        </Animated.View>
      )}
    </WhatsNewStep.Stage>
  );
}

function toDemoSuggestion(
  { daysOfWeek, scheduledTime, evidence }: DemoSuggestion,
  title: string,
): AiSuggestion {
  return {
    id: UNSENT_SUGGESTION_ID,
    title,
    daysOfWeek: [...daysOfWeek],
    scheduledTime,
    suggestedCategoryId: null,
    evidence,
  };
}
