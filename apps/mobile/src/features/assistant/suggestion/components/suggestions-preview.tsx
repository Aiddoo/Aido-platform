import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { TodoRow } from '@src/features/planning/todo/components/todo-row';
import type { TimeFormat } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  DashedDivider,
  HStack,
  ScallopedContainer,
  Spacing,
  Text,
  TextButton,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { usePrefetchQuery, useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { useRouter, useIsFocused } from 'expo-router';
import { Skeleton } from 'heroui-native';

import { PREVIEW_SUGGESTION_COUNT } from '../constants/suggestion.constants';
import { type AiSuggestion, AiSuggestionPolicy } from '../domains/ai-suggestion.model';
import { SuggestionListSelect, useGetSuggestionsQueryOptions } from '../queries/suggestion.queries';
import { formatSuggestionTime } from '../utils/suggestion-schedule.view-model';

interface SuggestionsPreviewProps {
  /** 리포트 영수증과의 간격은 상세 화면이 정한다 */
  className?: string;
}

export function SuggestionsPreview({ className }: SuggestionsPreviewProps) {
  const { t } = useTranslation('ai');
  const router = useRouter();
  const push = useSingleTap(router.push);
  // 분석 중 polling이 다른 탭에서 돌지 않게 가려지면 구독을 끊는다. useSuspenseQueries는 subscribed를 받지 않아 따로 읽는다
  usePrefetchQuery(useGetPreferenceQueryOptions());
  const isFocused = useIsFocused();
  const { data: suggestions } = useSuspenseQuery({
    ...useGetSuggestionsQueryOptions(),
    select: SuggestionListSelect.preview,
    subscribed: isFocused,
  });
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());

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
              timeFormat={preference.timeFormat}
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
  timeFormat: TimeFormat;
  isLast: boolean;
}

SuggestionsPreview.Item = function Item({
  suggestion,
  timeFormat,
  isLast,
}: SuggestionsPreviewItemProps) {
  const { t } = useTranslation('ai');
  const dateFormatContext = useDateFormatContext();
  const router = useRouter();
  const push = useSingleTap(router.push);

  const handleMakePress = () =>
    push({
      pathname: '/suggestions/[suggestionId]/category',
      params: { suggestionId: suggestion.id, source: 'report_preview' },
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
        <TodoRow.ScheduleLine
          repeat={AiSuggestionPolicy.getTodoRepeat(suggestion)}
          isRepeating
          timeLabel={formatSuggestionTime(suggestion, timeFormat, dateFormatContext)}
        />
      </VStack>

      <Spacing size={12} />

      <HStack justify="end">
        <Button size="small" display="inline" onPress={handleMakePress}>
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
              <VStack gap={2}>
                <TextSkeleton size="b3" className="w-32" />
                <TextSkeleton size="e1" className="w-40" />
              </VStack>
              <Spacing size={12} />
              <HStack justify="end">
                <Skeleton className="h-8 w-24 rounded-xl" />
              </HStack>
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
