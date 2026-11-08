import NotificationsUnreadFill from '@assets/icons/material/notifications_unread_fill.xml';
import Notifications from '@expo/material-symbols/notifications.xml';
import { ANIMATION } from '@src/shared/constants/animation';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { BellFilledIcon, BellIcon, Box, type QueryErrorFallbackProps } from '@src/shared/ui';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useState } from 'react';
import Animated, { css } from 'react-native-reanimated';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import { NotificationBadgePolicy, type UnreadCount } from '../domains/notification-badge.model';
import { useGetUnreadCountQueryOptions } from '../queries/notification.queries';

const BELL_ICON = process.env.EXPO_OS === 'ios' ? 'bell' : Notifications;
const UNREAD_BELL_ICON =
  process.env.EXPO_OS === 'ios' ? 'bell.badge.fill' : NotificationsUnreadFill;

const BELL_SWING = css.keyframes({
  '0%': { transform: [{ rotate: '0deg' }] },
  '20%': { transform: [{ rotate: '14deg' }] },
  '40%': { transform: [{ rotate: '-10deg' }] },
  '60%': { transform: [{ rotate: '6deg' }] },
  '80%': { transform: [{ rotate: '-3deg' }] },
  '100%': { transform: [{ rotate: '0deg' }] },
});

const BELL_SWING_STYLE = {
  animationName: BELL_SWING,
  animationDuration: ANIMATION.duration.emphasis,
  animationTimingFunction: 'ease-out',
  transformOrigin: 'top',
} as const;

export function NotificationBell() {
  const navigate = useSingleTap(router.navigate);
  const { t } = useTranslation('notification');
  const isReducedMotion = useIsReduceMotionEnabled();
  const { data: unreadCount } = useSuspenseQuery(useGetUnreadCountQueryOptions());
  const hasUnread = NotificationBadgePolicy.hasUnread(unreadCount);
  const swingCount = useSwingCountOnNewUnread(unreadCount);

  return (
    <PressableFeedback
      onPress={() => navigate('/notifications')}
      hitSlop={8}
      className="rounded-xl p-2"
      accessibilityRole="button"
      accessibilityLabel={hasUnread ? t('bell.unreadLabel') : t('titles.notifications')}
    >
      {/* 새 알림마다 key를 바꿔 흔들기를 한 번 다시 튼다. 모션 줄이기에서는 색만 바뀐다 */}
      <Animated.View
        key={swingCount}
        style={swingCount > 0 && !isReducedMotion ? BELL_SWING_STYLE : undefined}
      >
        {hasUnread ? (
          <BellFilledIcon width={24} height={24} colorClassName="text-main" />
        ) : (
          <BellIcon width={24} height={24} colorClassName="text-gray-9" />
        )}
      </Animated.View>
      {hasUnread && (
        <Box className="absolute top-1 right-1 size-3 rounded-full border-2 border-background bg-main" />
      )}
    </PressableFeedback>
  );
}

/** 읽지 않은 수가 늘 때마다 1씩 오른다. 이전 값은 렌더 중에 맞춘다(effect로 한 번 더 그리지 않는다) */
function useSwingCountOnNewUnread(unreadCount: UnreadCount) {
  const [previousCount, setPreviousCount] = useState<UnreadCount | null>(null);
  const [swingCount, setSwingCount] = useState(0);

  if (unreadCount !== previousCount) {
    setPreviousCount(unreadCount);
    if (NotificationBadgePolicy.hasNewUnread(unreadCount, previousCount)) {
      setSwingCount((count) => count + 1);
    }
  }

  return swingCount;
}

NotificationBell.Loading = function Loading() {
  return (
    <Box className="p-2">
      <BellIcon width={24} height={24} colorClassName="text-gray-4" />
    </Box>
  );
};

NotificationBell.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('notification');

  return (
    <PressableFeedback
      onPress={reset}
      hitSlop={8}
      className="rounded-xl p-2"
      accessibilityRole="button"
      accessibilityLabel={t('bell.retryLabel')}
    >
      <BellIcon width={24} height={24} colorClassName="text-gray-4" />
      <Box className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger" />
    </PressableFeedback>
  );
};

/** Stack 화면의 오른쪽 네이티브 헤더 버튼. 화면 컴포넌트 안에서 렌더해 그 화면 헤더에 붙인다. */
NotificationBell.Toolbar = function Toolbar() {
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
  const tintColor = match({ isLoadingError, hasUnread })
    .with({ isLoadingError: true }, () => errorTint)
    .with({ hasUnread: true }, () => unreadTint)
    .otherwise(() => undefined);

  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        icon={hasUnread ? UNREAD_BELL_ICON : BELL_ICON}
        accessibilityLabel={hasUnread ? t('bell.unreadLabel') : t('titles.notifications')}
        disabled={isPending}
        tintColor={tintColor}
        onPress={isLoadingError ? () => refetch() : () => navigate('/notifications')}
      />
    </Stack.Toolbar>
  );
};
