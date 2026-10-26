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
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatDateLabel } from '@src/shared/utils/date-format';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { PressableFeedback, Skeleton } from 'heroui-native';
import type { ComponentProps } from 'react';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { useSelectedMemo } from '../hooks/use-selected-memo';
import { useGetMemosInfiniteQueryOptions } from '../queries/get-memos-infinite-query-options';
import { distributeMemosIntoColumns, getMemoColumnCount } from '../utils/memo-list-layout';

export function MemoList() {
  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isFetchNextPageError } =
    useSuspenseInfiniteQuery(useGetMemosInfiniteQueryOptions());
  const windowSizeClass = useWindowSizeClass();
  const dateFormatContext = useDateFormatContext();
  const memos = data.pages.flatMap((page) => page.items);

  if (memos.length === 0) {
    return <MemoList.Empty />;
  }

  const columns = distributeMemosIntoColumns(memos, getMemoColumnCount(windowSizeClass));

  return (
    <VStack gap={20}>
      <HStack gap={12} align="start">
        {columns.map((column, colIndex) => (
          <VStack key={column.key} flex={1} gap={12}>
            {column.items.map((item, rowIndex) => (
              <Animated.View
                key={item.id}
                layout={LinearTransition.springify().damping(18).stiffness(120)}
                entering={FadeInDown.delay(Math.min(rowIndex * 2 + colIndex, 8) * 40)
                  .duration(400)
                  .damping(15)}
              >
                <MemoList.Item
                  id={item.id}
                  content={item.content}
                  isPinned={item.isPinned}
                  date={formatDateLabel(item.createdAt, 'monthDay', dateFormatContext)}
                />
              </Animated.View>
            ))}
          </VStack>
        ))}
      </HStack>
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

MemoList.Item = function Item({
  id,
  content,
  isPinned,
  date,
}: {
  id: number;
  content: string;
  isPinned: boolean;
  date: string;
}) {
  const [selectedMemoId, setSelectedMemoId] = useSelectedMemo();
  const selectMemo = useSingleTap(setSelectedMemoId);

  return (
    <PressableFeedback onPress={() => selectMemo(id)}>
      <VStack
        gap={8}
        p={16}
        className={cn('rounded-xl', selectedMemoId === id ? 'bg-gray-3' : 'bg-gray-1')}
      >
        <HStack align="start">
          <Text className="flex-1" size="b3" shade={8} weight="semibold" numberOfLines={4}>
            {content}
          </Text>
          {isPinned && <PinFilledIcon width={14} height={14} colorClassName="text-main" />}
        </HStack>

        <Text size="e1" shade={5}>
          {date}
        </Text>
      </VStack>
    </PressableFeedback>
  );
};

MemoList.Loading = function Loading() {
  return (
    <HStack gap={12} className="flex-wrap">
      {range(4).map((i) => (
        <VStack
          key={`memo-skeleton-${i}`}
          gap={8}
          className="flex-1 min-w-[45%] rounded-xl bg-gray-1 p-4"
        >
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded mt-2" />
        </VStack>
      ))}
    </HStack>
  );
};

MemoList.Empty = function Empty() {
  const { t } = useTranslation('memo');
  return (
    <Flex flex={1} justify="center" align="center">
      <Result
        icon={<DocsIcon width={72} height={72} colorClassName="text-gray-4" />}
        title={t('list.emptyTitle')}
        description={t('list.emptyDescription')}
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
