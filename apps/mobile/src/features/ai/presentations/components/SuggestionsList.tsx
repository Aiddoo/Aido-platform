import type { AiSuggestion } from '@src/features/ai/models/ai.model';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import { Button, H4, HStack, Spacing, Text, useOverlay, VStack } from '@src/shared/ui';
import { formatDaysOfWeek, formatMonthDay } from '@src/shared/utils/date';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Spinner } from 'heroui-native';
import { useState } from 'react';
import { Image, View } from 'react-native';

import { useGetSuggestionsQueryOptions } from '../queries/use-get-suggestions-query-options';
import { useHandleSuggestionMutationOptions } from '../queries/use-handle-suggestion-mutation-options';
import { ScallopedContainer } from './ScallopedContainer';
import { SuggestionCategoryBottomSheet } from './SuggestionCategoryBottomSheet';

export function SuggestionsList() {
  const replace = useSingleTap(router.replace);

  const { t } = useTranslation('ai');
  const { data: suggestions } = useSuspenseQuery(useGetSuggestionsQueryOptions());
  const dismissSuggestionMutation = useMutation(useHandleSuggestionMutationOptions());
  const [pendingSuggestionId, setPendingSuggestionId] = useState<number | null>(null);

  if (suggestions.length === 0)
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
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onAccepted={() => replace('/feed')}
            onDismiss={() => handleDismiss(suggestion.id)}
            isPending={dismissSuggestionMutation.isPending && pendingSuggestionId === suggestion.id}
            pendingAction={dismissSuggestionMutation.isPending ? 'dismiss' : null}
            isLast={index === suggestions.length - 1}
          />
        ))}
      </View>
    </ScallopedContainer>
  );
}

SuggestionsList.Loading = function Loading() {
  return (
    <VStack className="flex-1" align="center" justify="center">
      <Spinner size="lg" />
    </VStack>
  );
};

// --- SuggestionCard ---

const formatSchedule = (suggestion: AiSuggestion): string => {
  const days = formatDaysOfWeek(suggestion.daysOfWeek);
  const time = suggestion.scheduledTime ?? tGlobal('ai:suggestions.list.allDay');
  return `${days} · ${time}`;
};

interface SuggestionCardProps {
  suggestion: AiSuggestion;
  onAccepted: () => void;
  onDismiss: () => void;
  pendingAction?: 'accept' | 'dismiss' | null;
  isPending?: boolean;
  isLast?: boolean;
}

function SuggestionCard({
  suggestion,
  onAccepted,
  onDismiss,
  pendingAction = null,
  isPending = false,
  isLast = false,
}: SuggestionCardProps) {
  const { t } = useTranslation('ai');
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
            if (!open) closeSheet();
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
            {formatSchedule(suggestion)}
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
              isDisabled={isPending}
              isLoading={isPending && pendingAction === 'dismiss'}
            >
              {t('suggestions.list.reject')}
            </Button>
            <Button
              size="small"
              display="inline"
              onPress={openCategorySheet}
              isDisabled={isPending}
              isLoading={isPending && pendingAction === 'accept'}
            >
              {t('suggestions.list.accept')}
            </Button>
          </HStack>
        </HStack>
      </VStack>

      {!isLast && <View className="mt-5 border-b border-dashed border-gray-3" />}
    </View>
  );
}
