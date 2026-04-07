import { MemoPolicy } from '@src/features/memo/models/memo.model';
import { MemoList } from '@src/features/memo/presentations/components/MemoList';
import { MEMO_QUERY_KEYS } from '@src/features/memo/presentations/constants/memo-query-keys.constant';
import { useGetMemoResourceLimitQueryOptions } from '@src/features/memo/presentations/queries/use-get-memo-resource-limit-query-options';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { useTabBarHeight } from '@src/shared/hooks/useTabBarHeight';
import {
  Box,
  HStack,
  PlusIcon,
  QueryErrorBoundary,
  ScrollProgressWidget,
  Text,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { Suspense, useCallback, useRef } from 'react';
import { RefreshControl, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MemoScreen() {
  const { top: safeTop, bottom: safeBottom } = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const queryClient = useQueryClient();
  const scrollRef = useRef<Animated.ScrollView>(null);

  const progress = useSharedValue(0);

  const [refreshing, onRefresh] = useRefresh(() =>
    Promise.all([queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.all })]),
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: ({ contentOffset: { y }, contentSize, layoutMeasurement }) => {
      const scrollable = contentSize.height - layoutMeasurement.height;
      progress.value = scrollable > 0 ? Math.min(Math.max(y / scrollable, 0), 1) : 0;
    },
  });

  const handleScrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const bottomPadding = Math.max(tabBarHeight, safeBottom + 60);

  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: safeTop,
          paddingBottom: bottomPadding,
        }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Suspense fallback={<HeaderSkeleton />}>
          <Header />
        </Suspense>

        <QueryErrorBoundary fallback={(props) => <MemoList.Error {...props} />}>
          <Suspense fallback={<MemoList.Loading />}>
            <MemoList />
          </Suspense>
        </QueryErrorBoundary>
      </Animated.ScrollView>

      <ScrollProgressWidget
        progress={progress}
        onScrollToTop={handleScrollToTop}
        bottomOffset={tabBarHeight + safeBottom + 16}
      />
    </View>
  );
}

function Header() {
  const router = useRouter();
  const toast = useAppToast();
  const { data: resourceLimit } = useSuspenseQuery(useGetMemoResourceLimitQueryOptions());
  const canCreate = MemoPolicy.canCreate(resourceLimit);

  const handleCreate = () => {
    if (!canCreate) {
      toast.error('메모 개수가 한도에 도달했어요');
      return;
    }
    router.push('/memo/create');
  };

  return (
    <HStack align="center" px={16} mb={8}>
      <Box flex={1}>
        <Text size="h1" weight="semibold" tone="brand">
          메모 추가
        </Text>
      </Box>
      <PressableFeedback
        onPress={handleCreate}
        style={{ width: fontScaledSize(44), height: fontScaledSize(44) }}
        className={cn(
          'items-center justify-center rounded-full',
          canCreate ? 'bg-main' : 'bg-gray-4',
        )}
      >
        <PlusIcon width={22} height={22} color="white" />
      </PressableFeedback>
    </HStack>
  );
}

function HeaderSkeleton() {
  return <Box px={16} mb={16} style={{ height: 44 }} />;
}
