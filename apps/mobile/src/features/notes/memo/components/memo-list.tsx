import { useGetMeQueryOptions } from '@src/features/identity/user/queries/get-me-query-options';
import { useVoiceNoteStart } from '@src/features/voice/hooks/use-voice-note-start';
import { useVoiceNotes } from '@src/features/voice/hooks/use-voice-notes';
import { formatDateLabel } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  DocsIcon,
  Flex,
  HStack,
  PinFilledIcon,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Result,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { WindowSizeClass } from '@src/shared/utils/window-size-class';
import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import { clamp, range } from 'es-toolkit';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { match, P } from 'ts-pattern';

import { MemoPolicy } from '../domains/memo.model';
import { useSelectedMemo } from '../hooks/use-memo-params';
import { useGetMemosInfiniteQueryOptions } from '../queries/memo.queries';
import type { Memo } from '../schemas/memo.schema';

const LOADING_ITEMS_PER_COLUMN = 2;
const MAX_ENTERING_STAGGER_STEP = 8;

/** 펼친 화면에서는 목록 pane이 좁아 한 열로 보여준다. */
function getColumnCount(windowSizeClass: WindowSizeClass) {
  return match(windowSizeClass)
    .with('compact', () => 2)
    .with(P.union('medium', 'expanded'), () => 1)
    .exhaustive();
}

export function MemoList() {
  const { t } = useTranslation('memo');
  const {
    data: memos,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useSuspenseInfiniteQuery(useGetMemosInfiniteQueryOptions());
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const hasVoiceNotes = useVoiceNotes(me.id).length > 0;
  const windowSizeClass = useWindowSizeClass();

  if (memos.length === 0) {
    return hasVoiceNotes ? null : <MemoList.Empty />;
  }

  // 메모가 하나면 옆 칸이 비지 않게 한 열로 보여 준다
  const columnCount = Math.min(getColumnCount(windowSizeClass), memos.length);

  return (
    <VStack gap={20}>
      <VStack gap={8}>
        {hasVoiceNotes && (
          <Text size="b4" weight="semibold" shade={6}>
            {t('list.savedTitle')}
          </Text>
        )}

        <HStack gap={12} align="start">
          {range(columnCount).map((columnIndex) => (
            <VStack key={columnIndex} flex={1} gap={12}>
              {memos
                .filter((_, memoIndex) => memoIndex % columnCount === columnIndex)
                .map((memo, rowIndex) => (
                  <Animated.View
                    key={memo.id}
                    layout={LinearTransition.springify().damping(18).stiffness(120)}
                    entering={FadeInDown.delay(
                      clamp(rowIndex * 2 + columnIndex, MAX_ENTERING_STAGGER_STEP) * 40,
                    )
                      .duration(400)
                      .damping(15)}
                  >
                    <MemoList.Item memo={memo} />
                  </Animated.View>
                ))}
            </VStack>
          ))}
        </HStack>
      </VStack>

      {hasNextPage && (
        <MemoList.More
          onPress={() => fetchNextPage({ cancelRefetch: false })}
          isLoading={isFetchingNextPage}
          isDisabled={isFetching}
          hasError={isFetchNextPageError}
        />
      )}
    </VStack>
  );
}

MemoList.Item = function Item({ memo }: { memo: Memo }) {
  const [selectedMemoId, setSelectedMemoId] = useSelectedMemo();
  const selectMemo = useSingleTap(setSelectedMemoId);
  const dateFormatContext = useDateFormatContext();
  const { title, body } = MemoPolicy.getMemoPreview(memo);

  return (
    <PressableFeedback onPress={() => selectMemo(memo.id)} className="rounded-2xl">
      <VStack
        gap={8}
        p={16}
        className={cn(
          'rounded-2xl border bg-gray-1',
          selectedMemoId === memo.id ? 'border-main' : 'border-transparent',
        )}
      >
        <HStack align="start" gap={8}>
          <Text
            className="flex-1"
            size="b3"
            weight="semibold"
            maxLines={body.length > 0 ? 2 : 4}
            lineBreakStrategyIOS="hangul-word"
          >
            {title}
          </Text>
          {memo.isPinned && <PinFilledIcon width={14} height={14} colorClassName="text-main" />}
        </HStack>
        {body.length > 0 && (
          <Text size="b4" shade={6} maxLines={3} lineBreakStrategyIOS="hangul-word">
            {body}
          </Text>
        )}
        <Text size="e1" shade={5}>
          {formatDateLabel(memo.createdAt, 'monthDay', dateFormatContext)}
        </Text>
      </VStack>
    </PressableFeedback>
  );
};

MemoList.Loading = function Loading() {
  const columnCount = getColumnCount(useWindowSizeClass());

  return (
    <HStack gap={12} align="start">
      {range(columnCount).map((column) => (
        <VStack key={column} flex={1} gap={12}>
          {range(LOADING_ITEMS_PER_COLUMN).map((row) => (
            <VStack key={row} gap={8} p={16} className="rounded-2xl bg-gray-1">
              <TextSkeleton size="b3" className="w-full" />
              <TextSkeleton size="b3" className="w-3/4" />
              <TextSkeleton size="e1" className="w-1/2" />
            </VStack>
          ))}
        </VStack>
      ))}
    </HStack>
  );
};

MemoList.Empty = function Empty() {
  const { t } = useTranslation('memo');
  const { t: tVoiceNote } = useTranslation('voiceNote');
  const startVoiceNote = useVoiceNoteStart();
  return (
    <Flex flex={1} justify="center" align="center">
      <Result
        icon={<DocsIcon width={72} height={72} colorClassName="text-gray-4" />}
        title={t('list.emptyTitle')}
        description={t('list.emptyDescription')}
        button={
          <Result.Button onPress={() => startVoiceNote()}>
            {tVoiceNote('start.label')}
          </Result.Button>
        }
      />
    </Flex>
  );
};

MemoList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['memo', 'common']);
  return (
    <Flex flex={1} justify="center" align="center">
      <Result title={t('memo:list.loadFailed')} button={<QueryErrorActions onRetry={reset} />} />
    </Flex>
  );
};

MemoList.More = function More({
  hasError,
  ...props
}: Omit<ComponentProps<typeof Button>, 'children'> & { hasError: boolean }) {
  const { t } = useTranslation(['memo', 'common']);
  return (
    <VStack align="center" gap={8} pb={12}>
      {hasError && (
        <Text size="b4" shade={6} align="center">
          {t('memo:list.nextPageFailed')}
        </Text>
      )}
      <Button variant="weak" display="inline" {...props}>
        {t(hasError ? 'common:actions.retry' : 'memo:list.loadMore')}
      </Button>
    </VStack>
  );
};
