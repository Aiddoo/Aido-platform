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
  TextButton,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { range, take } from 'es-toolkit';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';

import type { AiSuggestion } from '../domains/suggestion.model';
import { useGetSuggestionsQueryOptions } from '../queries/suggestion.queries';
import { formatRepeatDays } from '../utils/suggestion-schedule.view-model';

const PREVIEW_SUGGESTION_COUNT = 2;

interface SuggestionsPreviewProps {
  className?: string;
}

export function SuggestionsPreview({ className }: SuggestionsPreviewProps) {
  const { t } = useTranslation('ai');
  const push = useSingleTap(router.push);
  const { data: suggestions } = useSuspenseQuery({
    ...useGetSuggestionsQueryOptions(),
    select: (list) => take(list.suggestions, PREVIEW_SUGGESTION_COUNT),
  });

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <VStack gap={8} className={className}>
      <HStack justify="between" align="center">
        <Text size="b3" weight="semibold" shade={9}>
          {t('suggestions.preview.title')}
        </Text>
        <TextButton size="small" variant="arrow" onPress={() => push('/suggestions')}>
          {t('suggestions.preview.viewAll')}
        </TextButton>
      </HStack>
      <ScallopedContainer>
        <Box className="px-4 py-2">
          {suggestions.map((suggestion, index) => (
            <SuggestionsPreview.Item
              key={suggestion.id}
              suggestion={suggestion}
              isLast={index === suggestions.length - 1}
            />
          ))}
        </Box>
      </ScallopedContainer>
    </VStack>
  );
}

interface SuggestionsPreviewItemProps {
  suggestion: AiSuggestion;
  isLast: boolean;
}

SuggestionsPreview.Item = function Item({ suggestion, isLast }: SuggestionsPreviewItemProps) {
  const { t } = useTranslation('ai');
  const dateFormatContext = useDateFormatContext();
  const push = useSingleTap(router.push);

  const handleMakePress = () =>
    push({
      pathname: '/suggestions/[suggestionId]/category',
      params: { suggestionId: suggestion.id, source: 'report_preview' },
    });

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
        <HStack justify="between" align="center" gap={8}>
          <LabelChip
            size="sm"
            color="default"
            pointerEvents="none"
            label={formatRepeatDays(suggestion.daysOfWeek, dateFormatContext)}
          />
          <Button size="small" display="inline" onPress={handleMakePress}>
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

SuggestionsPreview.Loading = function Loading({ className }: SuggestionsPreviewProps) {
  return (
    <VStack gap={8} className={className}>
      <HStack justify="between" align="center">
        <TextSkeleton size="b3" className="w-32" />
        <TextSkeleton size="e1" className="w-16" />
      </HStack>
      <ScallopedContainer>
        <Box className="px-4 py-2">
          {range(PREVIEW_SUGGESTION_COUNT).map((index) => (
            <Box key={index} className="py-2">
              <VStack gap={8}>
                <TextSkeleton size="b2" className="w-32" />
                <HStack justify="between" align="center">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-8 w-24 rounded-xl" />
                </HStack>
              </VStack>
              {index < PREVIEW_SUGGESTION_COUNT - 1 && (
                <>
                  <Spacing size={12} />
                  <DashedDivider />
                </>
              )}
            </Box>
          ))}
        </Box>
      </ScallopedContainer>
    </VStack>
  );
};

SuggestionsPreview.Error = function ErrorFallback(_props: QueryErrorFallbackProps) {
  return null;
};
