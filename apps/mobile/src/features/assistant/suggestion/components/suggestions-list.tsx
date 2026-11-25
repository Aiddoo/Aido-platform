import { AI_SUGGESTION_LIMITS, DAYS_OF_WEEK } from '@aido/api/vocabulary';
import { getPremiumGateAnalyticsFeature } from '@src/features/billing/subscription/utils/subscription-analytics';
import {
  selectTimeFormat,
  useGetPreferenceQueryOptions,
} from '@src/features/identity/preference/queries/preference.queries';
import { TodoRow } from '@src/features/planning/todo/components/todo-row';
import { useTrack, useTrackView } from '@src/shared/analytics';
import type { TimeFormat } from '@src/shared/date/format/date-format';
import { formatDayCountLabel } from '@src/shared/date/format/date-labels';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  DashedDivider,
  HStack,
  LabelChip,
  type QueryErrorFallbackProps,
  ScallopedContainer,
  Spacing,
  Text,
  VStack,
} from '@src/shared/ui';
import { useMutation, usePrefetchQuery, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useRouter, useIsFocused } from 'expo-router';

import { isSuggestionsPremiumRequiredError } from '../domains/suggestion.error';
import { type AiSuggestion, AiSuggestionPolicy } from '../domains/suggestion.model';
import { usePromptSuggestionLimit } from '../hooks/use-prompt-suggestion-limit';
import { useActOnSuggestionMutationOptions } from '../queries/suggestion.mutations';
import { useGetSuggestionsQueryOptions } from '../queries/suggestion.queries';
import { formatSuggestionTime } from '../utils/suggestion-schedule.view-model';
import { SuggestionStatus } from './suggestion-status';

/** 무료 예시 제안. 서버에 없는 제안이라 처리 요청에 쓰지 않는 id다 */
const EXAMPLE_SUGGESTION_ID = 0;

interface SuggestionItemProps {
  suggestion: AiSuggestion;
  timeFormat: TimeFormat;
  onMake: () => void;
  onDismiss: () => void;
  isDismissing?: boolean;
  isLast?: boolean;
}

/** 제안 영수증에서 상태 머리 아래 이어지는 제안 줄. 제안이 없으면 머리만 남는다 */
export function SuggestionsList() {
  const { t } = useTranslation('ai');
  const dateFormatContext = useDateFormatContext();
  // useSuspenseQueries는 쿼리마다 subscribed를 받지 않아 가려지면 구독을 끊는 목록과 따로 읽는다
  usePrefetchQuery(useGetPreferenceQueryOptions());
  const isFocused = useIsFocused();
  const { data: list } = useSuspenseQuery({
    ...useGetSuggestionsQueryOptions(),
    subscribed: isFocused,
  });
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const router = useRouter();
  // 시트를 여는 이동은 줄과 상관없이 한 번만 쌓이게 목록이 가드 하나를 갖는다
  const push = useSingleTap(router.push);

  if (list.suggestions.length === 0) {
    return null;
  }

  const handleMake = (suggestionId: number) =>
    push({ pathname: '/suggestions/[suggestionId]/category', params: { suggestionId } });

  return (
    <>
      <DashedDivider className="mx-5" />
      <Box className="px-5 pt-1">
        {list.suggestions.map((suggestion, index) => (
          <PendingSuggestion
            key={suggestion.id}
            suggestion={suggestion}
            timeFormat={preference.timeFormat}
            onMake={() => handleMake(suggestion.id)}
            isLast={index === list.suggestions.length - 1}
          />
        ))}
      </Box>
      <Text size="e1" shade={5} align="center" className="px-5 pb-5">
        {t('suggestions.expiryNotice', {
          period: formatDayCountLabel(
            AI_SUGGESTION_LIMITS.SUGGESTION_EXPIRY_DAYS,
            dateFormatContext,
          ),
        })}
      </Text>
    </>
  );
}

SuggestionsList.Item = function Item({
  suggestion,
  timeFormat,
  onMake,
  onDismiss,
  isDismissing = false,
  isLast = false,
}: SuggestionItemProps) {
  const { t } = useTranslation('ai');
  const dateFormatContext = useDateFormatContext();

  return (
    <Box className="py-3">
      <VStack gap={2}>
        <TodoRow.TitleLine
          label={
            <TodoRow.Label isCompleted={false} numberOfLines={2} className="flex-1">
              {suggestion.title}
            </TodoRow.Label>
          }
          isPrivate={false}
        />
        <TodoRow.ScheduleLine
          repeat={AiSuggestionPolicy.getTodoRepeat(suggestion)}
          isRepeating
          timeLabel={formatSuggestionTime(suggestion, timeFormat, dateFormatContext)}
        />
        {suggestion.evidence != null && (
          <Text size="e1" shade={6}>
            {t('suggestions.item.evidence', {
              period: formatDayCountLabel(suggestion.evidence.periodDays, dateFormatContext),
              total: suggestion.evidence.recordedCount,
              done: suggestion.evidence.completedCount,
            })}
          </Text>
        )}
      </VStack>

      <Spacing size={12} />

      <HStack gap={8} justify="end">
        <Button
          size="small"
          display="inline"
          variant="weak"
          color="dark"
          isLoading={isDismissing}
          onPress={onDismiss}
        >
          {t('suggestions.item.dismiss')}
        </Button>
        <Button size="small" display="inline" isDisabled={isDismissing} onPress={onMake}>
          {t('suggestions.item.make')}
        </Button>
      </HStack>

      {!isLast && (
        <>
          <Spacing size={12} />
          <DashedDivider />
        </>
      )}
    </Box>
  );
};

/** 무료는 실제 제안 화면과 같은 영수증에 예시 제안을 그린다. 줄의 버튼과 아래 버튼은 모두 결제 화면으로 간다 */
SuggestionsList.Free = function Free() {
  const router = useRouter();
  const { t } = useTranslation('ai');
  const { trackEvent } = useTrack();
  // 예시라 설정을 받기까지 기다리지 않고 기본 표기로 먼저 보인다
  const { data: preference } = useQuery(useGetPreferenceQueryOptions());
  const timeFormat = selectTimeFormat(preference);
  const gateParams = {
    feature: getPremiumGateAnalyticsFeature('AI_SUGGESTION'),
    surface: 'suggestions',
    presentation: 'inline',
  } as const;

  useTrackView('premium_gate_shown', { key: gateParams.feature, params: gateParams });

  // 결제 화면을 한 번 여는 누름은 지표도 한 번만 남긴다
  const handleSubscribePress = useSingleTap(() => {
    trackEvent('premium_gate_cta_tapped', gateParams);
    router.push({ pathname: '/paywall', params: { feature: 'AI_SUGGESTION' } });
  });

  return (
    <VStack gap={16}>
      <ScallopedContainer testID="suggestions-status">
        <SuggestionStatus.Free />
        <DashedDivider className="mx-5" />
        <Box className="px-5 pt-4 pb-2">
          <Box className="items-start">
            <LabelChip
              color="warning"
              label={t('suggestions.paywall.exampleBadge')}
              labelProps={{ numberOfLines: 1 }}
              pointerEvents="none"
            />
          </Box>
          <SuggestionsList.Item
            suggestion={{
              id: EXAMPLE_SUGGESTION_ID,
              suggestedCategoryId: null,
              title: t('suggestions.paywall.examples.vitamins'),
              daysOfWeek: [...DAYS_OF_WEEK],
              scheduledTime: '08:30',
              evidence: {
                recordedCount: 14,
                completedCount: 13,
                periodDays: AI_SUGGESTION_LIMITS.ANALYSIS_PERIOD_DAYS,
              },
            }}
            timeFormat={timeFormat}
            onMake={handleSubscribePress}
            onDismiss={handleSubscribePress}
          />
          <SuggestionsList.Item
            suggestion={{
              id: EXAMPLE_SUGGESTION_ID,
              suggestedCategoryId: null,
              title: t('suggestions.paywall.examples.gym'),
              daysOfWeek: ['MON', 'WED', 'FRI'],
              scheduledTime: '19:00',
              evidence: {
                recordedCount: 6,
                completedCount: 5,
                periodDays: AI_SUGGESTION_LIMITS.ANALYSIS_PERIOD_DAYS,
              },
            }}
            timeFormat={timeFormat}
            onMake={handleSubscribePress}
            onDismiss={handleSubscribePress}
          />
          <SuggestionsList.Item
            suggestion={{
              id: EXAMPLE_SUGGESTION_ID,
              suggestedCategoryId: null,
              title: t('suggestions.paywall.examples.recycling'),
              daysOfWeek: ['TUE', 'THU'],
              scheduledTime: '21:00',
              evidence: {
                recordedCount: 4,
                completedCount: 3,
                periodDays: AI_SUGGESTION_LIMITS.ANALYSIS_PERIOD_DAYS,
              },
            }}
            timeFormat={timeFormat}
            onMake={handleSubscribePress}
            onDismiss={handleSubscribePress}
          />
          <SuggestionsList.Item
            suggestion={{
              id: EXAMPLE_SUGGESTION_ID,
              suggestedCategoryId: null,
              title: t('suggestions.paywall.examples.weeklyReview'),
              daysOfWeek: ['SUN'],
              scheduledTime: null,
              evidence: {
                recordedCount: 2,
                completedCount: 2,
                periodDays: AI_SUGGESTION_LIMITS.ANALYSIS_PERIOD_DAYS,
              },
            }}
            timeFormat={timeFormat}
            onMake={handleSubscribePress}
            onDismiss={handleSubscribePress}
            isLast
          />
        </Box>
      </ScallopedContainer>

      <Button size="medium" onPress={handleSubscribePress}>
        {t('suggestions.paywall.subscribeCta')}
      </Button>
    </VStack>
  );
};

SuggestionsList.Error = function ErrorFallback(props: QueryErrorFallbackProps) {
  // 한도 스냅샷이 늦어 프리미엄으로 물었지만 서버가 거절했다. 구독 상태를 다시 받는 동안 무료 화면과 같은 구성을 보인다
  if (isSuggestionsPremiumRequiredError(props.error)) {
    return <SuggestionsList.Free />;
  }

  return <SuggestionStatus.Error {...props} />;
};

interface PendingSuggestionProps {
  suggestion: AiSuggestion;
  timeFormat: TimeFormat;
  onMake: () => void;
  isLast: boolean;
}

/** 서버에 있는 제안 한 줄. 거절과 그 연타 가드를 줄마다 가져 다른 줄의 거절을 막거나 덮지 않는다 */
function PendingSuggestion({ suggestion, timeFormat, onMake, isLast }: PendingSuggestionProps) {
  const promptSuggestionLimit = usePromptSuggestionLimit();
  // 한도 안내는 mutation 단계에 건다. 호출 단계 콜백은 줄이 내려가면 불리지 않는다
  const dismissMutation = useMutation({
    ...useActOnSuggestionMutationOptions(),
    onError: promptSuggestionLimit,
  });
  // isPending은 다시 그린 뒤에야 켜져 같은 프레임의 두 번째 누름이 거절을 한 번 더 보낸다
  const handleDismiss = useSingleTap(() =>
    dismissMutation.mutate({
      suggestionId: suggestion.id,
      input: { action: 'dismiss' },
      source: 'suggestions_screen',
    }),
  );

  return (
    <SuggestionsList.Item
      suggestion={suggestion}
      timeFormat={timeFormat}
      onMake={onMake}
      onDismiss={handleDismiss}
      isDismissing={dismissMutation.isPending}
      isLast={isLast}
    />
  );
}
