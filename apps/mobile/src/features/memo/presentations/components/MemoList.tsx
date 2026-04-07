import { DocsIcon, HStack, PinIcon, Result, Text, VStack } from '@src/shared/ui';
import { formatMonthDay } from '@src/shared/utils/date';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { type Href, useRouter } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import type { ReactElement } from 'react';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { useGetMemosQueryOptions } from '../queries/use-get-memos-query-options';

interface MemoListProps {
  header?: ReactElement;
}

export function MemoList({ header }: MemoListProps) {
  const { data } = useSuspenseInfiniteQuery(useGetMemosQueryOptions());
  const memos = data.pages.flatMap((page) => page.items);

  if (memos.length === 0) {
    return (
      <>
        {header}
        <MemoList.Empty />
      </>
    );
  }

  const left = memos.filter((_, i) => i % 2 === 0);
  const right = memos.filter((_, i) => i % 2 === 1);

  return (
    <>
      {header}
      <HStack px={12} gap={12} align="start">
        <VStack flex={1} gap={12}>
          {left.map((item, index) => (
            <Animated.View
              key={item.id}
              layout={LinearTransition.springify().damping(18).stiffness(120)}
              entering={FadeInDown.delay(index * 2 * 60)
                .duration(400)
                .damping(15)}
            >
              <MemoList.Item
                id={item.id}
                content={item.content}
                badge={item.isPinned ? '고정됨' : undefined}
                date={formatMonthDay(item.createdAt)}
              />
            </Animated.View>
          ))}
        </VStack>
        <VStack flex={1} gap={12}>
          {right.map((item, index) => (
            <Animated.View
              key={item.id}
              layout={LinearTransition.springify().damping(18).stiffness(120)}
              entering={FadeInDown.delay((index * 2 + 1) * 60)
                .duration(400)
                .damping(15)}
            >
              <MemoList.Item
                id={item.id}
                content={item.content}
                badge={item.isPinned ? '고정됨' : undefined}
                date={formatMonthDay(item.createdAt)}
              />
            </Animated.View>
          ))}
        </VStack>
      </HStack>
    </>
  );
}

MemoList.Item = function Item({
  id,
  content,
  badge,
  date,
}: {
  id: number;
  content: string;
  badge?: string;
  date: string;
}) {
  const router = useRouter();

  return (
    <PressableFeedback onPress={() => router.push(`/memo/${id}` as Href)}>
      <VStack
        gap={8}
        p={16}
        className="rounded-xl bg-gray-2 border border-gray-3 shadow-sm shadow-black/5"
      >
        {badge && (
          <HStack align="center" gap={4}>
            <PinIcon width={12} height={12} colorClassName="text-main" />
            <Text size="e1" tone="brand" weight="medium">
              {badge}
            </Text>
          </HStack>
        )}

        <Text size="b3" shade={10} numberOfLines={4}>
          {content}
        </Text>

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
  return (
    <Result
      icon={<DocsIcon width={72} height={72} colorClassName="text-gray-4" />}
      title="아직 메모가 없어요"
      description={'애매한 할 일은 여기에 메모해두고\n나중에 할 일로 옮겨보세요'}
    />
  );
};

MemoList.Error = function ErrorFallback({ reset }: { error: unknown; reset: () => void }) {
  return (
    <Result
      title="메모를 불러오지 못했어요"
      button={<Result.Button onPress={reset}>재시도</Result.Button>}
    />
  );
};
