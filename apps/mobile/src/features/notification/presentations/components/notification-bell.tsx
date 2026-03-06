import { BellIcon } from '@src/shared/ui/Icon';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { Suspense } from 'react';
import { Pressable, View } from 'react-native';
import { useGetUnreadCountQueryOptions } from '../queries/use-get-unread-count-query-options';

export const NotificationBell = () => {
  const router = useRouter();
  const { data: unreadCount } = useSuspenseQuery(useGetUnreadCountQueryOptions());
  const hasUnread = (unreadCount ?? 0) > 0;

  return (
    <Pressable onPress={() => router.push('/notifications')} hitSlop={8} className="p-2">
      <BellIcon width={24} height={24} colorClassName="text-gray-9" />
      {hasUnread && <View className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-main" />}
    </Pressable>
  );
};

NotificationBell.Loading = function Loading() {
  return (
    <View className="p-2">
      <Skeleton className="w-6 h-6 rounded-full" />
    </View>
  );
};

NotificationBell.Error = function ErrorFallback() {
  return (
    <Pressable hitSlop={8} className="p-2">
      <BellIcon width={24} height={24} colorClassName="text-gray-4" />
      <View className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger" />
    </Pressable>
  );
};

NotificationBell.Header = function Header() {
  return (
    <QueryErrorBoundary
      fallback={({ reset }) => (
        <Pressable onPress={reset} hitSlop={8} className="p-2">
          <BellIcon width={24} height={24} colorClassName="text-gray-4" />
          <View className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger" />
        </Pressable>
      )}
    >
      <Suspense fallback={<NotificationBell.Loading />}>
        <NotificationBell />
      </Suspense>
    </QueryErrorBoundary>
  );
};
