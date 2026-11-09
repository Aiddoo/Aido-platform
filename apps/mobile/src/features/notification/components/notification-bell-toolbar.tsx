import NotificationsUnreadFill from '@assets/icons/material/notifications_unread_fill.xml';
import Notifications from '@expo/material-symbols/notifications.xml';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { useQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import { NotificationBadgePolicy } from '../domains/notification-badge.model';
import { useGetUnreadCountQueryOptions } from '../queries/notification.queries';

// 읽지 않은 알림은 종을 채워 main으로 칠한다. 채운 기호에 점 자리가 뚫려 있어 같은 색이어도 점이 보인다
const BELL_ICON = process.env.EXPO_OS === 'ios' ? 'bell' : Notifications;
const UNREAD_BELL_ICON =
  process.env.EXPO_OS === 'ios' ? 'bell.badge.fill' : NotificationsUnreadFill;

/** Stack 화면의 오른쪽 네이티브 헤더 버튼. 화면 컴포넌트 안에서 렌더해 그 화면 헤더에 붙인다. */
export function NotificationBellToolbar() {
  const navigate = useSingleTap(router.navigate);
  const { t } = useTranslation('notification');
  const { color: errorTint } = useResolveClassNames('text-danger');
  const { color: unreadTint } = useResolveClassNames('text-main');
  const {
    data: unreadCount,
    isPending,
    isLoadingError,
    refetch,
  } = useQuery(useGetUnreadCountQueryOptions());
  const hasUnread = unreadCount != null && NotificationBadgePolicy.hasUnread(unreadCount);
  const { tintColor, accessibilityLabel } = match({ isLoadingError, hasUnread })
    .with({ isLoadingError: true }, () => ({
      tintColor: errorTint,
      accessibilityLabel: t('bell.retryLabel'),
    }))
    .with({ hasUnread: true }, () => ({
      tintColor: unreadTint,
      accessibilityLabel: t('bell.unreadLabel'),
    }))
    .otherwise(() => ({ tintColor: undefined, accessibilityLabel: t('titles.notifications') }));

  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        icon={hasUnread ? UNREAD_BELL_ICON : BELL_ICON}
        accessibilityLabel={accessibilityLabel}
        disabled={isPending}
        tintColor={tintColor}
        onPress={isLoadingError ? () => refetch() : () => navigate('/notifications')}
      />
    </Stack.Toolbar>
  );
}
