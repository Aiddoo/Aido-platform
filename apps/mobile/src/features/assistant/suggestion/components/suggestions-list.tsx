import { DAYS_OF_WEEK, USER_PREFERENCE_DEFAULTS } from '@aido/api/vocabulary';
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
  LabelChip,
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
import { match } from 'ts-pattern';

import { isSuggestionsPremiumRequiredError } from '../domains/suggestion.error';
import type { AiSuggestion } from '../domains/suggestion.model';
import { useActOnSuggestionMutationOptions } from '../queries/suggestion.mutations';
import { useGetSuggestionsQueryOptions } from '../queries/suggestion.queries';
import { getSuggestionSchedule } from '../utils/suggestion-schedule.view-model';

const SUGGESTION_LOADING_COUNT = 2;

interface SuggestionItemProps {
  suggestion: AiSuggestion;
  timeFormat: TimeFormat;
  onMake: () => void;
  onDismiss: () => void;
  isDismissing?: boolean;
  isLast?: boolean;
}

interface ExampleItemProps extends Pick<AiSuggestion, 'title' | 'daysOfWeek' | 'scheduledTime'> {
  evidence: Pick<NonNullable<AiSuggestion['evidence']>, 'recordedCount' | 'completedCount'>;
  timeFormat: TimeFormat;
  /** teaser는 제목만 가리고 일정·근거는 보여 구독하면 무엇을 받는지 남긴다 */
  visibility: 'full' | 'teaser';
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

SuggestionsList.Free = function Free() {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('ai');
  const { trackEvent } = useTrack();
  // 예시라 설정을 받기까지 기다리지 않고 기본 표기로 먼저 보인다
  const { data: preference } = useQuery(useGetPreferenceQueryOptions());
  const timeFormat = preference?.timeFormat ?? USER_PREFERENCE_DEFAULTS.TIME_FORMAT;
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
    <VStack gap={16}>
      <ScallopedContainer>
        <Box className="px-4 py-2">
          <Box className="items-start pt-2">
            <LabelChip
              color="default"
              label={t('suggestions.paywall.exampleBadge')}
              className="bg-gray-3 dark:bg-gray-2"
              pointerEvents="none"
            />
          </Box>
          <SuggestionsList.ExampleItem
            title={t('suggestions.paywall.examples.vitamins')}
            daysOfWeek={[...DAYS_OF_WEEK]}
            scheduledTime="08:30"
            evidence={{ recordedCount: 14, completedCount: 13 }}
            timeFormat={timeFormat}
            visibility="full"
          />
          <SuggestionsList.ExampleItem
            title={t('suggestions.paywall.examples.gym')}
            daysOfWeek={['MON', 'WED', 'FRI']}
            scheduledTime="19:00"
            evidence={{ recordedCount: 6, completedCount: 5 }}
            timeFormat={timeFormat}
            visibility="teaser"
          />
          <SuggestionsList.ExampleItem
            title={t('suggestions.paywall.examples.recycling')}
            daysOfWeek={['TUE', 'THU']}
            scheduledTime="21:00"
            evidence={{ recordedCount: 4, completedCount: 3 }}
            timeFormat={timeFormat}
            visibility="teaser"
          />
          <SuggestionsList.ExampleItem
            title={t('suggestions.paywall.examples.weeklyReview')}
            daysOfWeek={['SUN']}
            scheduledTime={null}
            evidence={{ recordedCount: 2, completedCount: 2 }}
            timeFormat={timeFormat}
            visibility="teaser"
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

SuggestionsList.ExampleItem = function ExampleItem({
  title,
  daysOfWeek,
  scheduledTime,
  evidence,
  timeFormat,
  visibility,
  isLast = false,
}: ExampleItemProps) {
  const { t } = useTranslation('ai');
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const { repeat, timeLabel } = getSuggestionSchedule(
    { daysOfWeek, scheduledTime },
    { todayKey, timeFormat, dateFormatContext },
  );

  return (
    <Box className="py-2">
      <VStack gap={2}>
        {match(visibility)
          .with('full', () => (
            <TodoRow.TitleLine
              label={
                <TodoRow.Label isCompleted={false} numberOfLines={2} className="flex-1">
                  {title}
                </TodoRow.Label>
              }
              isPrivate={false}
            />
          ))
          .with('teaser', () => (
            // 가린 막대가 제목 길이·글꼴 단계만큼 자리를 잡도록 글자를 투명하게 그린다
            <Box
              accessible
              accessibilityLabel={t('suggestions.paywall.hiddenTitle')}
              className="self-start rounded-md bg-gray-3 dark:bg-gray-2"
            >
              <TodoRow.Label isCompleted={false} numberOfLines={1} className="opacity-0">
                {title}
              </TodoRow.Label>
            </Box>
          ))
          .exhaustive()}
        <TodoRow.ScheduleLine repeat={repeat} isRepeating timeLabel={timeLabel} />
        <Text size="e1" shade={6}>
          {t('suggestions.item.evidence', {
            total: evidence.recordedCount,
            done: evidence.completedCount,
          })}
        </Text>
      </VStack>

      {!isLast && (
        <>
          <Spacing size={12} />
          <DashedDivider />
        </>
      )}
    </Box>
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
    return <SuggestionsList.Free />;
  }

  return null;
};
