import Notifications from '@expo/material-symbols/notifications.xml';
import NotificationsUnread from '@expo/material-symbols/notifications_unread.xml';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { BellIcon, QueryErrorBoundary, type QueryErrorFallbackProps, Box } from '@src/shared/ui';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { Suspense } from 'react';
import { Pressable } from 'react-native';
import { useResolveClassNames } from 'uniwind';

import { useGetUnreadCountQueryOptions } from '../queries/get-unread-count-query-options';

const BELL_ICON = process.env.EXPO_OS === 'ios' ? 'bell' : Notifications;
const UNREAD_BELL_ICON = process.env.EXPO_OS === 'ios' ? 'bell.badge' : NotificationsUnread;

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

/** pane 꼭대기처럼 Stack 헤더가 없는 자리에 두는 JS 벨이다. */
NotificationBell.Header = function Header() {
  return (
    <QueryErrorBoundary fallback={NotificationBell.Error}>
      <Suspense fallback={<NotificationBell.Loading />}>
        <NotificationBell />
      </Suspense>
    </QueryErrorBoundary>
  );
};

/** Stack 화면의 오른쪽 네이티브 헤더 버튼. 화면 컴포넌트 안에서 렌더해 그 화면 헤더에 붙인다. */
NotificationBell.Toolbar = function Toolbar() {
  const navigate = useSingleTap(router.navigate);
  const { t } = useTranslation('notification');
  const { color: errorTint } = useResolveClassNames('text-danger');
  const {
    data: unreadCount,
    isPending,
    isError,
    refetch,
  } = useQuery(useGetUnreadCountQueryOptions());
  const hasUnread = (unreadCount ?? 0) > 0;

  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        icon={hasUnread ? UNREAD_BELL_ICON : BELL_ICON}
        accessibilityLabel={t('titles.notifications')}
        disabled={isPending}
        tintColor={isError ? errorTint : undefined}
        onPress={isError ? () => refetch() : () => navigate('/notifications')}
      />
    </Stack.Toolbar>
  );
};
