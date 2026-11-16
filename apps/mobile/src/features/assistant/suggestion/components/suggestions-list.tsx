import { USER_PREFERENCE_DEFAULTS } from '@aido/api/vocabulary';
import { getPremiumGateAnalyticsFeature } from '@src/features/billing/subscription/utils/subscription-analytics';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { TodoRow } from '@src/features/planning/todo/components/todo-row';
import { useTrack, useTrackView } from '@src/shared/analytics';
import type { TimeFormat } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  DashedDivider,
  HStack,
  type QueryErrorFallbackProps,
  ScallopedContainer,
  Spacing,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useMutation, usePrefetchQuery, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { router, useIsFocused } from 'expo-router';
import { Skeleton } from 'heroui-native';

import { isSuggestionsPremiumRequiredError } from '../domains/suggestion.error';
import type { AiSuggestion } from '../domains/suggestion.model';
import { useActOnSuggestionMutationOptions } from '../queries/suggestion.mutations';
import { useGetSuggestionsQueryOptions } from '../queries/suggestion.queries';
import { getSuggestionSchedule } from '../utils/suggestion-schedule.view-model';

const SUGGESTION_LOADING_COUNT = 2;
const PREMIUM_PREVIEW_SCHEDULE: Pick<AiSuggestion, 'daysOfWeek' | 'scheduledTime'> = {
  daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  scheduledTime: '07:30',
};

interface SuggestionItemProps {
  suggestion: AiSuggestion;
  timeFormat: TimeFormat;
  onMake: () => void;
  onDismiss: () => void;
  isDismissing?: boolean;
  isLast?: boolean;
}

export function SuggestionsList() {
  const { t } = useTranslation('ai');
  // useSuspenseQueries는 쿼리마다 subscribed를 받지 않아 가려지면 구독을 끊는 목록과 따로 읽는다
  usePrefetchQuery(useGetPreferenceQueryOptions());
  const isFocused = useIsFocused();
  const { data: list } = useSuspenseQuery({
    ...useGetSuggestionsQueryOptions(),
    subscribed: isFocused,
  });
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const dismissSuggestionMutation = useMutation(useActOnSuggestionMutationOptions());
  const push = useSingleTap(router.push);

  if (list.suggestions.length === 0) {
    return null;
  }

  const handleMake = (suggestionId: number) =>
    push({ pathname: '/suggestions/[suggestionId]/category', params: { suggestionId } });

  const handleDismiss = (suggestionId: number) => {
    dismissSuggestionMutation.mutate({
      suggestionId,
      input: { action: 'dismiss' },
      source: 'suggestions_screen',
    });
  };

  return (
    <VStack gap={8}>
      <ScallopedContainer>
        <Box className="px-4 py-2">
          {list.suggestions.map((suggestion, index) => (
            <SuggestionsList.Item
              key={suggestion.id}
              suggestion={suggestion}
              timeFormat={preference.timeFormat}
              onMake={() => handleMake(suggestion.id)}
              onDismiss={() => handleDismiss(suggestion.id)}
              isDismissing={
                dismissSuggestionMutation.isPending &&
                dismissSuggestionMutation.variables?.suggestionId === suggestion.id
              }
              isLast={index === list.suggestions.length - 1}
            />
          ))}
        </Box>
      </ScallopedContainer>
      <Text size="e1" shade={5} align="center">
        {t('suggestions.expiryNotice')}
      </Text>
    </VStack>
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
  const todayKey = useTodayKey();
  const { repeat, timeLabel } = getSuggestionSchedule(suggestion, {
    todayKey,
    timeFormat,
    dateFormatContext,
  });

  return (
    <Box className="py-2">
      <VStack gap={2}>
        <TodoRow.TitleLine
          label={
            <TodoRow.Label isCompleted={false} numberOfLines={2} className="flex-1">
              {suggestion.title}
            </TodoRow.Label>
          }
          isPrivate={false}
        />
        <TodoRow.ScheduleLine repeat={repeat} isRepeating timeLabel={timeLabel} />
        {suggestion.evidence != null && (
          <Text size="e1" shade={6}>
            {t('suggestions.item.evidence', {
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

SuggestionsList.PremiumPreview = function PremiumPreview() {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('ai');
  const { trackEvent } = useTrack();
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  // 예시라 설정을 받기까지 기다리지 않고 기본 표기로 먼저 보인다
  const { data: preference } = useQuery(useGetPreferenceQueryOptions());
  const { repeat, timeLabel } = getSuggestionSchedule(PREMIUM_PREVIEW_SCHEDULE, {
    todayKey,
    timeFormat: preference?.timeFormat ?? USER_PREFERENCE_DEFAULTS.TIME_FORMAT,
    dateFormatContext,
  });
  const gateParams = {
    feature: getPremiumGateAnalyticsFeature('AI_SUGGESTION'),
    surface: 'suggestions',
    presentation: 'inline',
  } as const;

  useTrackView('premium_gate_shown', { key: gateParams.feature, params: gateParams });

  const handleSubscribePress = () => {
    trackEvent('premium_gate_cta_tapped', gateParams);
    push({ pathname: '/paywall', params: { feature: 'AI_SUGGESTION' } });
  };

  return (
    <ScallopedContainer>
      <Box className="px-4 py-4">
        <VStack gap={2} className="py-2 opacity-60">
          <TodoRow.TitleLine
            label={
              <TodoRow.Label isCompleted={false} className="flex-1">
                {t('suggestions.paywall.previewTitle')}
              </TodoRow.Label>
            }
            isPrivate={false}
          />
          <TodoRow.ScheduleLine repeat={repeat} isRepeating timeLabel={timeLabel} />
          <Text size="e1" shade={6}>
            {t('suggestions.paywall.previewEvidence')}
          </Text>
        </VStack>

        <Spacing size={16} />

        <Button size="medium" onPress={handleSubscribePress}>
          {t('suggestions.paywall.subscribeCta')}
        </Button>
      </Box>
    </ScallopedContainer>
  );
};

SuggestionsList.Loading = function Loading() {
  return (
    <ScallopedContainer>
      <Box className="px-4 py-2">
        {range(SUGGESTION_LOADING_COUNT).map((index) => (
          <Box key={index} className="py-2">
            <VStack gap={2}>
              <TextSkeleton size="b3" className="w-32" />
              <TextSkeleton size="e1" className="w-40" />
              <TextSkeleton size="e1" className="w-48" />
            </VStack>
            <Spacing size={12} />
            <HStack gap={8} justify="end">
              <Skeleton className="h-8 w-12 rounded-xl" />
              <Skeleton className="h-8 w-12 rounded-xl" />
            </HStack>
            {index < SUGGESTION_LOADING_COUNT - 1 && (
              <>
                <Spacing size={12} />
                <DashedDivider />
              </>
            )}
          </Box>
        ))}
      </Box>
    </ScallopedContainer>
  );
};

SuggestionsList.Error = function ErrorFallback({ error }: QueryErrorFallbackProps) {
  if (isSuggestionsPremiumRequiredError(error)) {
    return <SuggestionsList.PremiumPreview />;
  }

  return null;
};
