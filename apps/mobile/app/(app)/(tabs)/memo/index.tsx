import { SelectedMemoDetailPane } from '@src/features/memo/components/memo-detail-pane/selected-memo-detail-pane';
import { MemoList } from '@src/features/memo/components/memo-list';
import { MemoPolicy } from '@src/features/memo/domains/memo.model';
import { useSelectedMemo } from '@src/features/memo/hooks/use-selected-memo';
import { useGetMemoResourceLimitQueryOptions } from '@src/features/memo/queries/get-memo-resource-limit-query-options';
import { invalidateMemos } from '@src/features/memo/queries/memo-cache';
import { memoDetailHref } from '@src/features/memo/utils/navigation/memo-href';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useCompactDetailHandoff } from '@src/shared/hooks/use-compact-detail-handoff';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  AdaptivePane,
  Box,
  H3,
  HStack,
  PlusIcon,
  QueryErrorBoundary,
  RefreshIcon,
  ScrollProgressWidget,
  StyledSafeAreaView,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { Suspense, useCallback, useRef } from 'react';
import { RefreshControl } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

export default function MemoScreen() {
  const { t } = useTranslation('memo');
  const queryClient = useQueryClient();
  const scrollRef = useRef<Animated.ScrollView>(null);

  const progress = useSharedValue(0);

  const [refreshing, onRefresh] = useRefresh(() => invalidateMemos(queryClient));

  const onScroll = useAnimatedScrollHandler({
    onScroll: ({ contentOffset: { y }, contentSize, layoutMeasurement }) => {
      const scrollable = contentSize.height - layoutMeasurement.height;
      progress.value = scrollable > 0 ? Math.min(Math.max(y / scrollable, 0), 1) : 0;
    },
  });

  const handleScrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const [selectedMemoId] = useSelectedMemo();

  useCompactDetailHandoff(selectedMemoId, (memoId) => {
    router.setParams({ memoId: undefined });
    router.push(memoDetailHref(memoId));
  });

  const memoListPane = (
    <Box className="flex-1">
      <StyledSafeAreaView edges={['left', 'right']}>
        <HStack align="center" px={16} mb={16}>
          <Box flex={1}>
            <H3 shade={7}>{t('tab.addMemo')}</H3>
          </Box>
          <QueryErrorBoundary fallback={(props) => <MemoCreateButton.Error {...props} />}>
            <Suspense fallback={<MemoCreateButton.Loading />}>
              <MemoCreateButton />
            </Suspense>
          </QueryErrorBoundary>
        </HStack>
      </StyledSafeAreaView>

      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <StyledSafeAreaView edges={['left', 'right']} className="grow">
          <Box px={12} style={{ flexGrow: 1 }}>
            <QueryErrorBoundary fallback={(props) => <MemoList.Error {...props} />}>
              <Suspense fallback={<MemoList.Loading />}>
                <MemoList />
              </Suspense>
            </QueryErrorBoundary>
          </Box>
        </StyledSafeAreaView>
      </Animated.ScrollView>

      <ScrollProgressWidget
        progress={progress}
        onScrollToTop={handleScrollToTop}
        bottomOffset={16}
      />
    </Box>
  );

  return <AdaptivePane primary={memoListPane} secondary={<SelectedMemoDetailPane />} />;
}

function MemoCreateButton() {
  const fontScaledSize = useFontScaledSize();
  const push = useSingleTap(router.push);

  const toast = useAppToast();
  const { t } = useTranslation('memo');
  const { data: resourceLimit } = useSuspenseQuery(useGetMemoResourceLimitQueryOptions());
  const canCreate = MemoPolicy.isCreatable(resourceLimit);

  const handleCreate = () => {
    if (!canCreate) {
      toast.error(t('toasts.limitReached'));
      return;
    }
    push('/memo/create');
  };

  return (
    <PressableFeedback
      onPress={handleCreate}
      accessibilityRole="button"
      accessibilityLabel={t('titles.create')}
      style={{ width: fontScaledSize(44), height: fontScaledSize(44) }}
      className={cn(
        'items-center justify-center rounded-full',
        canCreate ? 'bg-main' : 'bg-gray-4',
      )}
    >
      <PlusIcon width={24} height={24} colorClassName="text-white dark:text-gray-9" />
    </PressableFeedback>
  );
}

MemoCreateButton.Loading = function Loading() {
  const fontScaledSize = useFontScaledSize();
  return <Box style={{ width: fontScaledSize(44), height: fontScaledSize(44) }} />;
};

MemoCreateButton.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('common');
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={t('actions.retry')}
      onPress={reset}
      style={{ width: fontScaledSize(44), height: fontScaledSize(44) }}
      className="items-center justify-center rounded-full bg-gray-8"
    >
      <RefreshIcon width={20} height={20} colorClassName="text-white" />
    </PressableFeedback>
  );
};
