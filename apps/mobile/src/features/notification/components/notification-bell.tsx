import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { BellIcon, QueryErrorBoundary, type QueryErrorFallbackProps, Box } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Suspense } from 'react';
import { Pressable } from 'react-native';

import { useGetUnreadCountQueryOptions } from '../queries/get-unread-count-query-options';

export function NotificationBell() {
  const navigate = useSingleTap(router.navigate);

  const { data: unreadCount } = useSuspenseQuery(useGetUnreadCountQueryOptions());
  const hasUnread = (unreadCount ?? 0) > 0;

  return (
    <Pressable onPress={() => navigate('/notifications')} hitSlop={8} className="p-2">
      <BellIcon width={24} height={24} colorClassName="text-gray-9" />
      {hasUnread && <Box className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-main" />}
    </Pressable>
  );
}

NotificationBell.Loading = function Loading() {
  return (
    <Box className="p-2">
      <BellIcon width={24} height={24} colorClassName="text-gray-4" />
    </Box>
  );
};

NotificationBell.Error = function ErrorState({ reset }: QueryErrorFallbackProps) {
  return (
    <Pressable onPress={reset} hitSlop={8} className="p-2">
      <BellIcon width={24} height={24} colorClassName="text-gray-4" />
      <Box className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger" />
    </Pressable>
  );
};

NotificationBell.Header = function Header() {
  return (
    <QueryErrorBoundary fallback={NotificationBell.Error}>
      <Suspense fallback={<NotificationBell.Loading />}>
        <NotificationBell />
      </Suspense>
    </QueryErrorBoundary>
  );
};
