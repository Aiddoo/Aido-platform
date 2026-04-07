import MasonryList from '@react-native-seoul/masonry-list';
import { Box, HStack, PinIcon, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatMonthDay } from '@src/shared/utils/date';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import type { MemoItem } from '../../models/memo.model';
import { useGetMemosQueryOptions } from '../queries/use-get-memos-query-options';

export function MemoList() {
  const router = useRouter();
  const { data } = useSuspenseInfiniteQuery(useGetMemosQueryOptions());
  const memos = data.pages.flatMap((page) => page.items);

  if (memos.length === 0) {
    return <MemoList.Empty />;
  }

  const gap = 12;

  return (
    <MasonryList
      data={memos}
      numColumns={2}
      keyExtractor={(item) => String(item.id)}
      showsVerticalScrollIndicator={false}
      renderItem={({ item: rawItem, i: index }) => {
        const item = rawItem as MemoItem;
        return (
          <Animated.View
            layout={LinearTransition}
            entering={FadeInDown.delay(index * 80).springify()}
          >
            <MemoCard
              content={item.content}
              isPinned={item.isPinned}
              date={item.createdAt}
              onPress={() => router.push(`/memo/${item.id}` as Href)}
              style={{
                marginLeft: gap,
                marginRight: index % 2 !== 0 ? gap : 0,
                marginBottom: gap,
              }}
            />
          </Animated.View>
        );
      }}
    />
  );
}

// ─── Loading ────────────────────────────────────────────────

const SKELETON_KEYS = ['skeleton-a', 'skeleton-b', 'skeleton-c', 'skeleton-d'] as const;

MemoList.Loading = function Loading() {
  return (
    <HStack px={12} gap={12} className="flex-wrap">
      {SKELETON_KEYS.map((key) => (
        <VStack key={key} gap={8} className="flex-1 min-w-[45%] rounded-xl bg-gray-1 p-4">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded mt-2" />
        </VStack>
      ))}
    </HStack>
  );
};

// ─── Empty ──────────────────────────────────────────────────

MemoList.Empty = function Empty() {
  return (
    <Box className="flex-1 items-center justify-center" py={64}>
      <Text size="b3" shade={6}>
        메모가 없어요
      </Text>
      <Text size="b4" shade={5} className="mt-1">
        + 버튼을 눌러 메모를 추가해보세요
      </Text>
    </Box>
  );
};

// ─── Error ──────────────────────────────────────────────────

MemoList.Error = function ErrorFallback({ reset }: { error: unknown; reset: () => void }) {
  return (
    <Box className="items-center" px={16} py={24} gap={8}>
      <Text size="b3" shade={8}>
        메모를 불러오지 못했어요
      </Text>
      <PressableFeedback onPress={reset}>
        <Text size="b4" tone="brand">
          재시도
        </Text>
      </PressableFeedback>
    </Box>
  );
};

// ─── MemoCard (지역 컴포넌트) ───────────────────────────────

interface MemoCardProps {
  content: string;
  isPinned: boolean;
  date: Date;
  onPress: () => void;
  style?: object;
}

function MemoCard({ content, isPinned, date, onPress, style }: MemoCardProps) {
  return (
    <PressableFeedback onPress={onPress} style={style}>
      <VStack gap={8} className={cn('rounded-xl bg-gray-1 p-4', 'shadow-sm shadow-black/5')}>
        {isPinned && (
          <HStack align="center" gap={4}>
            <PinIcon width={12} height={12} colorClassName="text-main" />
            <Text size="e1" tone="brand" weight="medium">
              고정됨
            </Text>
          </HStack>
        )}

        <Text size="b3" shade={10} numberOfLines={6}>
          {content}
        </Text>

        <Text size="e1" shade={5}>
          {formatMonthDay(date)}
        </Text>
      </VStack>
    </PressableFeedback>
  );
}
