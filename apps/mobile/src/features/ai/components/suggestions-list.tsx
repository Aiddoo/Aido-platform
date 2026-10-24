import type { AiSuggestion } from '@src/features/ai/domains/ai.model';
import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import {
  Button,
  DashedDivider,
  H4,
  HStack,
  Result,
  ScallopedContainer,
  Spacing,
  Text,
  useOverlay,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { formatDaysOfWeek, formatMonthDay } from '@src/shared/utils/date';
import { formatTimeDisplay, type TimeFormat } from '@src/shared/utils/time';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { useState } from 'react';
import { Image, View } from 'react-native';

import {
  isSuggestionsPremiumRequiredError,
  useGetSuggestionsQueryOptions,
} from '../queries/get-suggestions-query-options';
import { useHandleSuggestionMutationOptions } from '../queries/use-handle-suggestion-mutation-options';
import { SuggestionCategoryBottomSheet } from './suggestion-category-bottom-sheet';

const SUGGESTION_LOADING_COUNT = 2;

export function SuggestionsList() {
  const replace = useSingleTap(router.replace);

  const { t } = useTranslation('ai');
  const { data: suggestions } = useSuspenseQuery(useGetSuggestionsQueryOptions());
  const dismissSuggestionMutation = useMutation(useHandleSuggestionMutationOptions());
  const [pendingSuggestionId, setPendingSuggestionId] = useState<number | null>(null);

  if (suggestions.length === 0) {
    return <SuggestionsList.Empty />;
  }

  const handleDismiss = (suggestionId: number) => {
    setPendingSuggestionId(suggestionId);
    dismissSuggestionMutation.mutate(
      {
        suggestionId,
        input: { action: 'dismiss' },
      },
      {
        onSettled: () => {
          setPendingSuggestionId(null);
        },
      },
    );
  };

  return (
    <ScallopedContainer>
      <View className="items-center px-5 pt-4">
        <Image
          source={require('@assets/images/ido_cat_suggestion.webp')}
          style={{ width: 100, height: 100 }}
          resizeMode="contain"
        />
        <Spacing size={8} />
        <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
          {t('suggestions.list.header', { count: suggestions.length })}
        </H4>
        <Text size="b4" shade={6} align="center">
          {t('suggestions.list.headerDescription')}
        </Text>
      </View>

      <Spacing size={20} />

      <View className="px-4 pb-4">
        {suggestions.map((suggestion, index) => (
          <SuggestionsList.Item
            key={suggestion.id}
            suggestion={suggestion}
            onAccepted={() => replace('/feed')}
            onDismiss={() => handleDismiss(suggestion.id)}
            isDismissing={
              dismissSuggestionMutation.isPending && pendingSuggestionId === suggestion.id
            }
            isLast={index === suggestions.length - 1}
          />
        ))}
      </View>
    </ScallopedContainer>
  );
}

function formatSchedule(suggestion: AiSuggestion, timeFormat: TimeFormat): string {
  const days = formatDaysOfWeek(suggestion.daysOfWeek);
  const time =
    suggestion.scheduledTime === null
      ? tGlobal('ai:suggestions.list.allDay')
      : formatTimeDisplay(suggestion.scheduledTime, timeFormat);
  return `${days} · ${time}`;
}

interface SuggestionItemProps {
  suggestion: AiSuggestion;
  onAccepted: () => void;
  onDismiss: () => void;
  isDismissing?: boolean;
  isLast?: boolean;
}

SuggestionsList.Item = function Item({
  suggestion,
  onAccepted,
  onDismiss,
  isDismissing = false,
  isLast = false,
}: SuggestionItemProps) {
  const { t } = useTranslation('ai');
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const overlay = useOverlay();
  const confidenceLabel = `${Math.round(suggestion.confidence * 100)}%`;

  const openCategorySheet = () => {
    overlay.open(({ isOpen, close, exit }) => {
      const closeSheet = () => {
        close();
        exit();
      };

      return (
        <SuggestionCategoryBottomSheet
          suggestionId={suggestion.id}
          suggestedCategoryId={suggestion.suggestedCategoryId}
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeSheet();
            }
          }}
          onAccepted={onAccepted}
        />
      );
    });
  };

  return (
    <View className="py-2">
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
            {formatSchedule(suggestion, preference.timeFormat)}
          </Text>
        </VStack>

        <Text size="b4" shade={6}>
          {suggestion.reason}
        </Text>

        <HStack justify="between" align="center" className="mt-1">
          <Text size="e1" shade={5}>
            {t('suggestions.list.expires', { date: formatMonthDay(suggestion.expiresAt) })}
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
              onPress={openCategorySheet}
              isDisabled={isDismissing}
            >
              {t('suggestions.list.accept')}
            </Button>
          </HStack>
        </HStack>
      </VStack>

      {!isLast && <DashedDivider className="mt-5" />}
    </View>
  );
};

SuggestionsList.Empty = function Empty() {
  const { t } = useTranslation('ai');
  return (
    <ScallopedContainer>
      <View className="items-center px-5 pt-4">
        <Image
          source={require('@assets/images/ido_cat_suggestion.webp')}
          style={{ width: 100, height: 100 }}
          resizeMode="contain"
        />
        <Spacing size={8} />
        <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
          {t('suggestions.list.emptyNoHistory')}
        </H4>
        <Text size="b4" shade={6} align="center">
          {t('suggestions.list.emptyNoHistoryDescription')}
        </Text>
      </View>

      <Spacing size={20} />

      <View className="px-4 pb-4">
        <View className="rounded-2xl border border-dashed border-gray-3 bg-gray-1 px-4 py-8">
          <VStack gap={4} align="center">
            <Text size="b3" weight="semibold" shade={8} align="center">
              {t('suggestions.list.emptyNoPending')}
            </Text>
            <Text size="b4" shade={6} align="center">
              {t('suggestions.list.emptyNoPendingDescription')}
            </Text>
          </VStack>
        </View>
      </View>
    </ScallopedContainer>
  );
};

SuggestionsList.PremiumPreview = function PremiumPreview() {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('ai');

  return (
    <ScallopedContainer>
      <View className="items-center px-5 pt-4">
        <Image
          source={require('@assets/images/ido_cat_suggestion.webp')}
          style={{ width: 100, height: 100 }}
          resizeMode="contain"
        />
        <Spacing size={8} />
        <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
          {t('suggestions.paywall.title')}
        </H4>
        <Text size="b4" shade={6} align="center">
          {t('suggestions.paywall.description')}
        </Text>
      </View>

      <Spacing size={20} />

      <View className="px-4 pb-4">
        <View className="py-2 opacity-60">
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
        </View>

        <Spacing size={16} />

        <Button size="medium" onPress={() => push('/settings/subscription')}>
          {t('suggestions.paywall.subscribeCta')}
        </Button>
      </View>
    </ScallopedContainer>
  );
};

SuggestionsList.Loading = function Loading() {
  const fontScaledSize = useFontScaledSize();

  return (
    <ScallopedContainer>
      <View className="items-center px-5 pt-4">
        <Image
          source={require('@assets/images/ido_cat_suggestion.webp')}
          style={{ width: 100, height: 100 }}
          resizeMode="contain"
        />
        <Spacing size={8} />
        <Skeleton className="w-48 rounded" style={{ height: fontScaledSize(28) }} />
        <Spacing size={4} />
        <Skeleton className="w-56 rounded" style={{ height: fontScaledSize(19) }} />
      </View>

      <Spacing size={20} />

      <View className="px-4 pb-4">
        {times(SUGGESTION_LOADING_COUNT, (index) => (
          <View key={index} className="py-2">
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
          </View>
        ))}
      </View>
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
      <View className="px-5 py-6">
        <Result
          title={t('errorBoundary.title')}
          button={<Result.Button onPress={reset}>{t('actions.retry')}</Result.Button>}
        />
      </View>
    </ScallopedContainer>
  );
};
