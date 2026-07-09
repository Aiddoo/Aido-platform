import { MemoPolicy } from '@src/features/memo/models/memo.model';
import { MemoList } from '@src/features/memo/presentations/components/MemoList';
import { MEMO_QUERY_KEYS } from '@src/features/memo/presentations/constants/memo-query-keys.constant';
import { useGetMemoResourceLimitQueryOptions } from '@src/features/memo/presentations/queries/use-get-memo-resource-limit-query-options';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { useTabBarHeight } from '@src/shared/hooks/useTabBarHeight';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  H3,
  HStack,
  PlusIcon,
  QueryErrorBoundary,
  ScrollProgressWidget,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { Suspense, useCallback, useRef } from 'react';
import { RefreshControl } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MemoScreen() {
  const { bottom: safeBottom } = useSafeAreaInsets();
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
    <Box className="flex-1">
      <QueryErrorBoundary fallback={(props) => <Header.Error {...props} />}>
        <Suspense fallback={<Header.Loading />}>
          <Header />
        </Suspense>
      </QueryErrorBoundary>

      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: bottomPadding,
        }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
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
    </Box>
  );
}

function Header() {
  const router = useRouter();
  const toast = useAppToast();
  const { t } = useTranslation('memo');
  const { data: resourceLimit } = useSuspenseQuery(useGetMemoResourceLimitQueryOptions());
  const canCreate = MemoPolicy.canCreate(resourceLimit);

  const handleCreate = () => {
    if (!canCreate) {
      toast.error(t('toasts.limitReached'));
      return;
    }
    router.push('/memo/create');
  };

  return (
    <HStack align="center" px={16} mb={16}>
      <Box flex={1}>
        <H3 shade={7}>{t('tab.addMemo')}</H3>
      </Box>
      <PressableFeedback
        onPress={handleCreate}
        style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
        className={cn(
          'items-center justify-center rounded-full',
          canCreate ? 'bg-main' : 'bg-gray-4',
        )}
      >
        <PlusIcon width={24} height={24} color="white" />
      </PressableFeedback>
    </HStack>
  );
}

Header.Loading = function Loading() {
  return <Box px={16} mb={16} style={{ height: 44 }} />;
};

// 살아있는 세션의 일시적 401 등으로 Header 쿼리가 실패해도 앱 레벨로 새지 않게 로컬에 담는다.
// 제목은 유지하고 생성 버튼 자리를 재시도(reset)로 바꿔 레이아웃을 흔들지 않는다.
Header.Error = function ErrorFallback({ reset }: { error: unknown; reset: () => void }) {
  const { t } = useTranslation('memo');
  return (
    <HStack align="center" px={16} mb={16}>
      <Box flex={1}>
        <H3 shade={7}>{t('tab.addMemo')}</H3>
      </Box>
      <PressableFeedback
        onPress={reset}
        style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
        className="items-center justify-center rounded-full bg-gray-4"
      >
        <PlusIcon width={24} height={24} color="white" />
      </PressableFeedback>
    </HStack>
  );
};
