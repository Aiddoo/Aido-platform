import type { AiSuggestion } from '@src/features/ai/domains/ai.model';
import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  DashedDivider,
  H4,
  HStack,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Result,
  ScallopedContainer,
  Spacing,
  Text,
  VStack,
} from '@src/shared/ui';
import { formatDaysOfWeek } from '@src/shared/utils/date';
import { type DateFormatContext, formatDateLabel } from '@src/shared/utils/date-format';
import { formatTimeDisplay, type TimeFormat } from '@src/shared/utils/time';
import { useMutation, usePrefetchQuery, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { Image } from 'react-native';

import {
  isSuggestionsPremiumRequiredError,
  useGetSuggestionsQueryOptions,
} from '../queries/get-suggestions-query-options';
import { useHandleSuggestionMutationOptions } from '../queries/use-handle-suggestion-mutation-options';
import { suggestionCategorySheetHref } from '../utils/navigation/suggestion-sheet-href';

const SUGGESTION_LOADING_COUNT = 2;

interface SuggestionsIntroProps {
  title: string;
  description: string;
}

function SuggestionsIntro({ title, description }: SuggestionsIntroProps) {
  return (
    <Box className="items-center px-5 pt-4">
      <Image
        source={require('@assets/images/ido_cat_suggestion.webp')}
        style={{ width: 100, height: 100 }}
        resizeMode="contain"
      />
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
  const dismissSuggestionMutation = useMutation(useHandleSuggestionMutationOptions());

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
  timeFormat: TimeFormat,
  context: DateFormatContext,
): string {
  const days = formatDaysOfWeek(suggestion.daysOfWeek);
  const time =
    suggestion.scheduledTime == null
      ? tGlobal('ai:suggestions.list.allDay')
      : formatTimeDisplay(suggestion.scheduledTime, timeFormat, context);
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
  const push = useSingleTap(router.push);
  const confidenceLabel = `${Math.round(suggestion.confidence * 100)}%`;

  const handleOpenCategorySheet = () =>
    push(suggestionCategorySheetHref({ suggestionId: suggestion.id }));

  return (
    <Box className="py-2">
      <VStack gap={8}>
        <VStack gap={4}>
          <HStack justify="between" align="center">
            <Text size="b2" weight="semibold" shade={9}>
              {suggestion.title}
            </Text>
            <Text size="e1" shade={5}>
              {t('suggestions.list.confidence', { value: confidenceLabel })}
            </Text>
          </HStack>
          <Text size="b4" shade={7}>
            {formatSchedule(suggestion, preference.timeFormat, dateFormatContext)}
          </Text>
        </VStack>

        <Text size="b4" shade={6}>
          {suggestion.reason}
        </Text>

        <HStack justify="between" align="center" className="mt-1">
          <Text size="e1" shade={5}>
            {t('suggestions.list.expires', {
              date: formatDateLabel(suggestion.expiresAt, 'monthDay', dateFormatContext),
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
        <Box className="rounded-2xl border border-dashed border-gray-3 bg-gray-1 px-4 py-8">
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

        <Button size="medium" onPress={() => push('/settings/subscription')}>
          {t('suggestions.paywall.subscribeCta')}
        </Button>
      </Box>
    </ScallopedContainer>
  );
};

SuggestionsList.Loading = function Loading() {
  const fontScaledSize = useFontScaledSize();

  return (
    <ScallopedContainer>
      <Box className="items-center px-5 pt-4">
        <Image
          source={require('@assets/images/ido_cat_suggestion.webp')}
          style={{ width: 100, height: 100 }}
          resizeMode="contain"
        />
        <Spacing size={8} />
        <Skeleton className="w-48 rounded" style={{ height: fontScaledSize(28) }} />
        <Spacing size={4} />
        <Skeleton className="w-56 rounded" style={{ height: fontScaledSize(19) }} />
      </Box>

      <Spacing size={20} />

      <Box className="px-4 pb-4">
        {times(SUGGESTION_LOADING_COUNT, (index) => (
          <Box key={index} className="py-2">
            <VStack gap={8}>
              <VStack gap={4}>
                <HStack justify="between" align="center">
                  <Skeleton className="w-32 rounded" style={{ height: fontScaledSize(23) }} />
                  <Skeleton className="w-16 rounded" style={{ height: fontScaledSize(17) }} />
                </HStack>
                <Skeleton className="w-40 rounded" style={{ height: fontScaledSize(19) }} />
              </VStack>
              <Skeleton className="w-full rounded" style={{ height: fontScaledSize(19) }} />
            </VStack>
            {index < SUGGESTION_LOADING_COUNT - 1 && <DashedDivider className="mt-5" />}
          </Box>
        ))}
      </Box>
    </ScallopedContainer>
  );
};

SuggestionsList.Error = function ErrorState({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');

  if (isSuggestionsPremiumRequiredError(error)) {
    return <SuggestionsList.PremiumPreview />;
  }

  return (
    <ScallopedContainer>
      <Box className="px-5 py-6">
        <Result title={t('errorBoundary.title')} button={<QueryErrorActions onRetry={reset} />} />
      </Box>
    </ScallopedContainer>
  );
};
