import { getPremiumGateAnalyticsFeature } from '@src/features/billing/subscription/utils/subscription-analytics';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useTrack, useTrackView } from '@src/shared/analytics';
import type { TimeFormat } from '@src/shared/date/format/date-format';
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
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useMutation, usePrefetchQuery, useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { router, useIsFocused } from 'expo-router';
import { Skeleton } from 'heroui-native';

import { isSuggestionsPremiumRequiredError } from '../domains/suggestion.error';
import type { AiSuggestion } from '../domains/suggestion.model';
import { useActOnSuggestionMutationOptions } from '../queries/suggestion.mutations';
import { useGetSuggestionsQueryOptions } from '../queries/suggestion.queries';
import { formatRepeatDays, formatScheduledTime } from '../utils/suggestion-schedule.view-model';

const SUGGESTION_LOADING_COUNT = 2;

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

  return (
    <Box className="py-2">
      <VStack gap={8}>
        <Text
          size="b2"
          weight="semibold"
          shade={9}
          numberOfLines={2}
          lineBreakStrategyIOS="hangul-word"
        >
          {suggestion.title}
        </Text>
        <HStack gap={6} className="flex-wrap">
          <LabelChip
            size="sm"
            color="default"
            pointerEvents="none"
            label={formatRepeatDays(suggestion.daysOfWeek, dateFormatContext)}
          />
          {suggestion.scheduledTime != null && (
            <LabelChip
              size="sm"
              color="default"
              pointerEvents="none"
              label={formatScheduledTime(suggestion.scheduledTime, timeFormat, dateFormatContext)}
            />
          )}
        </HStack>
        {suggestion.evidence != null && (
          <Text size="b4" shade={6}>
            {t('suggestions.item.evidence', {
              total: suggestion.evidence.recordedCount,
              done: suggestion.evidence.completedCount,
            })}
          </Text>
        )}
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

SuggestionsList.PremiumPreview = function PremiumPreview() {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('ai');
  const { trackEvent } = useTrack();
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
        <VStack gap={8} className="py-2 opacity-60">
          <Text size="b2" weight="semibold" shade={9}>
            {t('suggestions.paywall.previewTitle')}
          </Text>
          <HStack gap={6} className="flex-wrap">
            <LabelChip
              size="sm"
              color="default"
              pointerEvents="none"
              label={t('suggestions.paywall.previewDays')}
            />
            <LabelChip
              size="sm"
              color="default"
              pointerEvents="none"
              label={t('suggestions.paywall.previewTime')}
            />
          </HStack>
          <Text size="b4" shade={6}>
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
            <VStack gap={8}>
              <TextSkeleton size="b2" className="w-32" />
              <HStack gap={6}>
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </HStack>
              <TextSkeleton size="b4" className="w-48" />
              <HStack gap={8} justify="end">
                <Skeleton className="h-8 w-12 rounded-xl" />
                <Skeleton className="h-8 w-12 rounded-xl" />
              </HStack>
            </VStack>
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
