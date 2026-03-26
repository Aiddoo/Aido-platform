import type { AiSuggestion } from '@src/features/ai/models/ai.model';
import { Button, H4, HStack, Spacing, Text, useOverlay, VStack } from '@src/shared/ui';
import { formatDaysOfWeek, formatMonthDay } from '@src/shared/utils/date';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Spinner } from 'heroui-native';
import { useState } from 'react';
import { Image, View } from 'react-native';

import { useGetSuggestionsQueryOptions } from '../queries/use-get-suggestions-query-options';
import { useHandleSuggestionMutationOptions } from '../queries/use-handle-suggestion-mutation-options';
import { ScallopedContainer } from './ScallopedContainer';
import { SuggestionCategoryBottomSheet } from './SuggestionCategoryBottomSheet';

export function SuggestionsList() {
  const { data: suggestions } = useSuspenseQuery(useGetSuggestionsQueryOptions());
  const router = useRouter();
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
            제안이 아직 도착하지 않았어요
          </H4>
          <Text size="b4" shade={6} align="center">
            할 일 기록이 쌓이면 AI가 반복 패턴을 분석해 추천해드려요
          </Text>
        </View>

        <Spacing size={20} />

        <View className="px-4 pb-4">
          <View className="rounded-2xl border border-dashed border-gray-3 bg-gray-1 px-4 py-8">
            <VStack gap={4} align="center">
              <Text size="b3" weight="semibold" shade={8} align="center">
                지금은 추천할 제안이 없어요
              </Text>
              <Text size="b4" shade={6} align="center">
                반복 할 일이 생기면 여기에 바로 도착해요
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
          {suggestions.length}개의 제안이 도착했어요
        </H4>
        <Text size="b4" shade={6} align="center">
          반복되는 패턴을 분석해서 추천해드려요
        </Text>
      </View>

      <Spacing size={20} />

      <View className="px-4 pb-4">
        {suggestions.map((suggestion, index) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onAccepted={() => router.replace('/feed')}
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
  const time = suggestion.scheduledTime ?? '종일';
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
          onAccepted={() => {
            closeSheet();
            onAccepted();
          }}
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
              신뢰도 {confidenceLabel}
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
            만료 {formatMonthDay(suggestion.expiresAt)}
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
              거절
            </Button>
            <Button
              size="small"
              display="inline"
              onPress={openCategorySheet}
              isDisabled={isPending}
              isLoading={isPending && pendingAction === 'accept'}
            >
              수락
            </Button>
          </HStack>
        </HStack>
      </VStack>

      {!isLast && <View className="mt-5 border-b border-dashed border-gray-3" />}
    </View>
  );
}
