import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import {
  DocsIcon,
  HStack,
  PinFilledIcon,
  Result,
  Text,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { formatMonthDay } from '@src/shared/utils/date';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { router, type Href } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { useGetMemosQueryOptions } from '../queries/use-get-memos-query-options';

export function MemoList() {
  const { data } = useSuspenseInfiniteQuery(useGetMemosQueryOptions());
  const memos = data.pages.flatMap((page) => page.items);

  if (memos.length === 0) {
    return <MemoList.Empty />;
  }

  const columns = [
    { key: 'left', items: memos.filter((_, i) => i % 2 === 0) },
    { key: 'right', items: memos.filter((_, i) => i % 2 === 1) },
  ];

  return (
    <HStack px={12} gap={12} align="start">
      {columns.map((column, colIndex) => (
        <VStack key={column.key} flex={1} gap={12}>
          {column.items.map((item, rowIndex) => (
            <Animated.View
              key={item.id}
              layout={LinearTransition.springify().damping(18).stiffness(120)}
              entering={FadeInDown.delay((rowIndex * 2 + colIndex) * 60)
                .duration(400)
                .damping(15)}
            >
              <MemoList.Item
                id={item.id}
                content={item.content}
                isPinned={item.isPinned}
                date={formatMonthDay(item.createdAt)}
              />
            </Animated.View>
          ))}
        </VStack>
      ))}
    </HStack>
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
  const push = useSingleTap(router.push);

  return (
    <PressableFeedback onPress={() => push(`/memo/${id}` as Href)}>
      <VStack gap={8} p={16} className="rounded-xl bg-gray-1">
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
    <HStack px={12} gap={12} className="flex-wrap">
      {times(4, (i) => (
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
    <Result
      icon={<DocsIcon width={72} height={72} colorClassName="text-gray-4" />}
      title={t('list.emptyTitle')}
      description={t('list.emptyDescription')}
    />
  );
};

MemoList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['memo', 'common']);
  return (
    <Result
      title={t('memo:list.loadFailed')}
      button={<Result.Button onPress={reset}>{t('common:errorBoundary.retry')}</Result.Button>}
    />
  );
};
