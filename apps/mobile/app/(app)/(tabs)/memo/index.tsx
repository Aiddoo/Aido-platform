import { MemoList } from '@src/features/memo/presentations/components/MemoList';
import { MEMO_QUERY_KEYS } from '@src/features/memo/presentations/constants/memo-query-keys.constant';
import { useGetMemoResourceLimitQueryOptions } from '@src/features/memo/presentations/queries/use-get-memo-resource-limit-query-options';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { useTabBarHeight } from '@src/shared/hooks/useTabBarHeight';
import { Box, HStack, PlusIcon, QueryErrorBoundary, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { Suspense } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MemoScreen() {
  const { top: safeTop } = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const queryClient = useQueryClient();

  const [refreshing, onRefresh] = useRefresh(() =>
    Promise.all([queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.all })]),
  );

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: safeTop,
        paddingBottom: tabBarHeight,
      }}
      showsVerticalScrollIndicator={false}
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
    </ScrollView>
  );
}

function Header() {
  const router = useRouter();
  const toast = useAppToast();
  const { data: resourceLimit } = useSuspenseQuery(useGetMemoResourceLimitQueryOptions());
  const canCreate = resourceLimit.currentCount < resourceLimit.maxPerUser;

  const handleCreate = () => {
    if (!canCreate) {
      toast.error('메모 개수가 한도에 도달했어요');
      return;
    }
    router.push('/memo/create' as Href);
  };

  return (
    <HStack align="center" px={16} mb={16}>
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
