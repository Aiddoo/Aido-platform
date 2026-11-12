import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import {
  formatHHmmTime,
  formatYearAwareDateLabel,
  type DateFormatContext,
  type TimeFormat,
} from '@src/shared/date/format/date-format';
import { formatDaysOfWeek } from '@src/shared/date/format/date-labels';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { toLanguageOfIntlLocale } from '@src/shared/i18n/app-locales';
import {
  Box,
  Button,
  DashedDivider,
  H4,
  HStack,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  ScallopedContainer,
  Spacing,
  Text,
  TextSkeleton,
  VStack,
  Mascot,
} from '@src/shared/ui';
import { useMutation, usePrefetchQuery, useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';

import { isSuggestionsPremiumRequiredError } from '../domains/suggestion.error';
import type { AiSuggestion } from '../domains/suggestion.model';
import { useActOnSuggestionMutationOptions } from '../queries/suggestion.mutations';
import { useGetSuggestionsQueryOptions } from '../queries/suggestion.queries';

const SUGGESTION_LOADING_COUNT = 2;
/** 소개의 고양이와 로딩 자리가 같은 크기라 함께 쓴다 */
const INTRO_IMAGE_SIZE = 100;

interface SuggestionsIntroProps {
  title: string;
  description: string;
}

function SuggestionsIntro({ title, description }: SuggestionsIntroProps) {
  return (
    <Box className="items-center px-5 pt-4">
      <Mascot name="catSuggestion" size={INTRO_IMAGE_SIZE} />
      <Spacing size={8} />
      <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
        {title}
      </H4>
      <Text size="b4" shade={6} align="center">
        {description}
      </Text>
    </Box>
  );
}

export function SuggestionsList() {
  const { t } = useTranslation('ai');
  usePrefetchQuery(useGetPreferenceQueryOptions());
  const { data: suggestions } = useSuspenseQuery(useGetSuggestionsQueryOptions());
  const dismissSuggestionMutation = useMutation(useActOnSuggestionMutationOptions());

  if (suggestions.length === 0) {
    return <SuggestionsList.Empty />;
  }

  const handleDismiss = (suggestionId: number) => {
    dismissSuggestionMutation.mutate({ suggestionId, input: { action: 'dismiss' } });
  };

  return (
    <ScallopedContainer>
      <SuggestionsIntro
        title={t('suggestions.list.header', { count: suggestions.length })}
        description={t('suggestions.list.headerDescription')}
      />

      <Spacing size={20} />

      <Box className="px-4 pb-4">
        {suggestions.map((suggestion, index) => (
          <SuggestionsList.Item
            key={suggestion.id}
            suggestion={suggestion}
            onDismiss={() => handleDismiss(suggestion.id)}
            isDismissing={
              dismissSuggestionMutation.isPending &&
              dismissSuggestionMutation.variables?.suggestionId === suggestion.id
            }
            isLast={index === suggestions.length - 1}
          />
        ))}
      </Box>
    </ScallopedContainer>
  );
}

function formatSchedule(
  suggestion: AiSuggestion,
  {
    timeFormat,
    context,
    allDayLabel,
  }: { timeFormat: TimeFormat; context: DateFormatContext; allDayLabel: string },
): string {
  const days = formatDaysOfWeek(suggestion.daysOfWeek, toLanguageOfIntlLocale(context.locale));
  const time =
    suggestion.scheduledTime == null
      ? allDayLabel
      : formatHHmmTime(suggestion.scheduledTime, timeFormat, context);
  return `${days} · ${time}`;
}

interface SuggestionItemProps {
  suggestion: AiSuggestion;
  onDismiss: () => void;
  isDismissing?: boolean;
  isLast?: boolean;
}

SuggestionsList.Item = function Item({
  suggestion,
  onDismiss,
  isDismissing = false,
  isLast = false,
}: SuggestionItemProps) {
  const { t } = useTranslation('ai');
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const push = useSingleTap(router.push);
  // 확신도는 정수로 보인다. formatPercent(소수 한 자리)로 바꾸면 칩 글자 폭이 달라진다
  const confidenceLabel = `${Math.round(suggestion.confidence * 100)}%`;

  const handleOpenCategorySheet = () =>
    push({
      pathname: '/suggestions/[suggestionId]/category',
      params: { suggestionId: suggestion.id },
    });

  return (
    <Box className="py-2">
      <VStack className="gap-2">
        <VStack className="gap-1">
          <HStack justify="between" align="center">
            <Text size="b2" weight="semibold" shade={9}>
              {suggestion.title}
            </Text>
            <Text size="e1" shade={5}>
              {t('suggestions.list.confidence', { value: confidenceLabel })}
            </Text>
          </HStack>
          <Text size="b4" shade={7}>
            {formatSchedule(suggestion, {
              timeFormat: preference.timeFormat,
              context: dateFormatContext,
              allDayLabel: t('suggestions.list.allDay'),
            })}
          </Text>
        </VStack>

        <Text size="b4" shade={6}>
          {suggestion.reason}
        </Text>

        <HStack justify="between" align="center" className="mt-1">
          <Text size="e1" shade={5}>
            {t('suggestions.list.expires', {
              date: formatYearAwareDateLabel(suggestion.expiresAt, todayKey, dateFormatContext),
            })}
          </Text>

          <HStack gap={8}>
            <Button
              size="small"
              variant="weak"
              color="dark"
              display="inline"
              onPress={onDismiss}
              isDisabled={isDismissing}
              isLoading={isDismissing}
            >
              {t('suggestions.list.reject')}
            </Button>
            <Button
              size="small"
              display="inline"
              onPress={handleOpenCategorySheet}
              isDisabled={isDismissing}
            >
              {t('suggestions.list.accept')}
            </Button>
          </HStack>
        </HStack>
      </VStack>

      {!isLast && <DashedDivider className="mt-5" />}
    </Box>
  );
};

SuggestionsList.Empty = function Empty() {
  const { t } = useTranslation('ai');
  return (
    <ScallopedContainer>
      <SuggestionsIntro
        title={t('suggestions.list.emptyNoHistory')}
        description={t('suggestions.list.emptyNoHistoryDescription')}
      />

      <Spacing size={20} />

      <Box className="px-4 pb-4">
        <Box className="rounded-2xl border border-dashed border-gray-3 bg-white px-4 py-8">
          <VStack gap={4} align="center">
            <Text size="b3" weight="semibold" shade={8} align="center">
              {t('suggestions.list.emptyNoPending')}
            </Text>
            <Text size="b4" shade={6} align="center">
              {t('suggestions.list.emptyNoPendingDescription')}
            </Text>
          </VStack>
        </Box>
      </Box>
    </ScallopedContainer>
  );
};

SuggestionsList.PremiumPreview = function PremiumPreview() {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('ai');

  return (
    <ScallopedContainer>
      <SuggestionsIntro
        title={t('suggestions.paywall.title')}
        description={t('suggestions.paywall.description')}
      />

      <Spacing size={20} />

      <Box className="px-4 pb-4">
        <Box className="py-2 opacity-60">
          <VStack gap={8}>
            <VStack gap={4}>
              <HStack justify="between" align="center">
                <Text size="b2" weight="semibold" shade={9}>
                  {t('suggestions.paywall.sampleTitle')}
                </Text>
                <Text size="e1" shade={5}>
                  {t('suggestions.paywall.sampleConfidence')}
                </Text>
              </HStack>
              <Text size="b4" shade={7}>
                {t('suggestions.paywall.sampleSchedule')}
              </Text>
            </VStack>
            <Text size="b4" shade={6}>
              {t('suggestions.paywall.sampleReason')}
            </Text>
          </VStack>
        </Box>

        <Spacing size={16} />

        <Button
          size="medium"
          onPress={() => push({ pathname: '/paywall', params: { feature: 'AI_SUGGESTION' } })}
        >
          {t('suggestions.paywall.subscribeCta')}
        </Button>
      </Box>
    </ScallopedContainer>
  );
};

SuggestionsList.Loading = function Loading() {
  return (
    <ScallopedContainer>
      <Box className="items-center px-5 pt-4">
        <Mascot name="catSuggestion" size={INTRO_IMAGE_SIZE} />
        <Spacing size={8} />
        <TextSkeleton size="t3" className="w-48" />
        <Spacing size={4} />
        <TextSkeleton size="b4" className="w-56" />
      </Box>

      <Spacing size={20} />

      <Box className="px-4 pb-4">
        {range(SUGGESTION_LOADING_COUNT).map((index) => (
          <Box key={index} className="py-2">
            <VStack className="gap-2">
              <VStack className="gap-1">
                <HStack justify="between" align="center">
                  <TextSkeleton size="b2" className="w-32" />
                  <TextSkeleton size="e1" className="w-16" />
                </HStack>
                <TextSkeleton size="b4" className="w-40" />
              </VStack>
              <TextSkeleton size="b4" className="w-full" />
              <HStack justify="between" align="center" className="mt-1">
                <TextSkeleton size="e1" className="w-24" />
                <HStack gap={8}>
                  <Skeleton className="h-8 w-12 rounded-xl" />
                  <Skeleton className="h-8 w-12 rounded-xl" />
                </HStack>
              </HStack>
            </VStack>
            {index < SUGGESTION_LOADING_COUNT - 1 && <DashedDivider className="mt-5" />}
          </Box>
        ))}
      </Box>
    </ScallopedContainer>
  );
};

SuggestionsList.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  if (isSuggestionsPremiumRequiredError(error)) {
    return <SuggestionsList.PremiumPreview />;
  }

  return (
    <ScallopedContainer>
      <Box className="px-5 py-6">
        <QueryErrorFallback reset={reset} />
      </Box>
    </ScallopedContainer>
  );
};
