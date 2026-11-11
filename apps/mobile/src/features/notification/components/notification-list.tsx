import { useLogger } from '@src/bootstrap/providers/di-context';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { createCheerMessageReportTarget } from '@src/features/social/moderation/domains/user-report.model';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage } from '@src/shared/errors';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import {
  Box,
  InfiniteList,
  NotificationIllustration,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Result,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useQueryClient, useSuspenseInfiniteQuery, useMutation } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { type Href, router } from 'expo-router';
import { Separator } from 'heroui-native';
import { Fragment } from 'react';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NotificationPolicy } from '../domains/notification.model';
import type { Notification } from '../domains/notification.model';
import {
  useOpenNotificationDestination,
  useResolveNotificationDestination,
} from '../hooks/use-notification-destination';
import { useNotificationCategory } from '../hooks/use-notification-params';
import { refreshNotifications } from '../queries/notification-cache';
import { useMarkAsReadMutationOptions } from '../queries/notification.mutations';
import { useGetNotificationsInfiniteQueryOptions } from '../queries/notification.queries';
import type { DateSectionKey } from '../utils/date-section';
import {
  findRootStackDetailHref,
  type NotificationDestination,
} from '../utils/notification-destination';
import { getNotificationLabelKey } from '../utils/notification.view-model';
import { NotificationListRow } from './notification-list-row';

const NOTIFICATION_PAGE_SIZE = 10;
const LOADING_ROW_COUNT = 5;

interface NotificationItemProps {
  notification: Notification;
  /** 길게 눌러 미리보기·메뉴를 열 목적지. 없으면 탭으로만 연다 */
  href: Href | null;
  onOpen: (notification: Notification) => void;
}

export function NotificationList() {
  const [category] = useNotificationCategory();
  const { currentLocalDateKey, currentTimeZone } = useLocalDate();
  const {
    data: listItems,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useSuspenseInfiniteQuery(
    useGetNotificationsInfiniteQueryOptions({
      category,
      limit: NOTIFICATION_PAGE_SIZE,
      todayDateKey: currentLocalDateKey,
      timeZone: currentTimeZone,
    }),
  );
  const queryClient = useQueryClient();
  const [isRefreshing, handleRefresh] = useRefresh(() => refreshNotifications(queryClient));
  const openNotification = useOpenNotification();
  const findNotificationHref = useFindNotificationHref();

  return (
    <InfiniteList
      data={listItems}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      isFetchNextPageError={isFetchNextPageError}
      fetchNextPage={fetchNextPage}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      renderItem={({ item }) =>
        match(item)
          .with({ type: 'header' }, ({ section }) => (
            <NotificationList.SectionHeader section={section} />
          ))
          .with({ type: 'item' }, ({ entry }) => (
            <NotificationList.Item
              notification={entry}
              href={findNotificationHref(entry)}
              onOpen={openNotification}
            />
          ))
          .exhaustive()
      }
      getItemType={(item) => item.type}
      keyExtractor={(item) =>
        match(item)
          .with({ type: 'header' }, ({ section }) => `header-${section}`)
          .with({ type: 'item' }, ({ entry }) => String(entry.id))
          .exhaustive()
      }
      ListEmptyComponent={<NotificationList.Empty />}
      ItemSeparatorComponent={() => <Separator className="mx-4" />}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
    />
  );
}

NotificationList.Item = function Item({ notification, href, onOpen }: NotificationItemProps) {
  const { t } = useTranslation(['notification', 'moderation']);
  const reportCheer = useReportCheer(notification);
  const handlePress = useSingleTap(() => onOpen(notification));

  return (
    <NotificationListRow.Link href={href}>
      <NotificationListRow
        label={t(`categories.${getNotificationLabelKey(notification.type)}`)}
        title={notification.title}
        body={notification.body}
        createdAt={notification.createdAt}
        isUnread={NotificationPolicy.isUnread(notification)}
        testID={`notification-item-${notification.type}`}
        onPress={handlePress}
        // 받은 응원은 길게 눌러(스크린리더는 동작 메뉴로) 신고한다. 응원은 피드 탭으로 가 Link 행이 아니다
        onLongPress={reportCheer ?? undefined}
        accessibilityActions={
          reportCheer == null
            ? undefined
            : [{ name: 'report', label: t('moderation:menu.reportCheer') }]
        }
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'report') {
            reportCheer?.();
          }
        }}
      />
    </NotificationListRow.Link>
  );
};

NotificationList.SectionHeader = function SectionHeader({ section }: { section: DateSectionKey }) {
  const { t } = useTranslation('common');

  return (
    <Box className="bg-white px-4 py-2">
      <Text size="b3" shade={5} weight="semibold">
        {t(`dateSections.${section}`)}
      </Text>
    </Box>
  );
};

/** 받은 뒤와 같은 자리에 날짜 머리 한 줄과 행을 그린다. 머리·행 여백은 SectionHeader·행과 같다 */
NotificationList.Loading = function Loading() {
  return (
    <ScrollView className="flex-1">
      <Box className="px-4 py-2">
        <TextSkeleton size="b3" className="w-32" />
      </Box>
      {range(LOADING_ROW_COUNT).map((index) => (
        <Fragment key={index}>
          {index > 0 && <Separator className="mx-4" />}
          <NotificationListRow.Loading />
        </Fragment>
      ))}
    </ScrollView>
  );
};

NotificationList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['notification', 'common']);

  return (
    <VStack flex={1} p={24}>
      <QueryErrorFallback title={t('notification:list.loadError')} reset={reset} />
    </VStack>
  );
};

NotificationList.Empty = function Empty() {
  const { t } = useTranslation('notification');

  return (
    <VStack flex={1} p={24}>
      <Result icon={<NotificationIllustration />} title={t('list.empty')} />
    </VStack>
  );
};

// 목록이 한 번 부르고 행에 넘겨 행마다 게이트·mutation을 만들지 않는다
function useOpenNotification() {
  const { t } = useTranslation('notification');
  const resolveInboxDestination = useResolveInboxDestination();
  const openDestination = useOpenNotificationDestination();
  const logger = useLogger();
  const { mutate: markAsRead } = useMutation(useMarkAsReadMutationOptions());
  const { trackEvent } = useTrack();
  const gate = useEntitlementGate('AI_REPORT', { surface: 'notification_center' });

  return (notification: Notification) => {
    if (NotificationPolicy.isUnread(notification)) {
      markAsRead(notification.id);
    }

    if (
      NotificationPolicy.isAiFeature(notification) &&
      gate.promptIfBlocked({ description: t('list.premiumDescription') })
    ) {
      return;
    }

    const destination = resolveInboxDestination(notification);
    trackEvent('notification_center_opened', {
      type: notification.type,
      destination: destination.kind,
    });
    openDestination(destination).catch((error) =>
      logger.warn(NOTIFICATION_LOG_EVENT.CENTER_NAVIGATION_FAILED, {
        error: getErrorMessage(error),
      }),
    );
  };
}

/** 좁은 화면에서 읽은 알림이 같은 루트 Stack의 상세로 갈 때만 길게 눌러 미리본다. 미리보기 이동은 행 onPress를 거치지 않아 읽음과 AI 프리미엄 안내를 건너뛴다 */
function useFindNotificationHref() {
  const windowSizeClass = useWindowSizeClass();
  const resolveInboxDestination = useResolveInboxDestination();

  return (notification: Notification): Href | null => {
    const isTapOnly =
      windowSizeClass !== 'compact' ||
      NotificationPolicy.isUnread(notification) ||
      NotificationPolicy.isAiFeature(notification);
    if (isTapOnly) {
      return null;
    }
    return findRootStackDetailHref(resolveInboxDestination(notification));
  };
}

// 목록은 알림함 화면에만 있어, 알림함을 여는 알림은 같은 화면을 다시 열지 않고 머문다
function useResolveInboxDestination() {
  const resolveDestination = useResolveNotificationDestination();

  return (notification: Notification): NotificationDestination =>
    notification.target.kind === 'NOTIFICATIONS'
      ? { kind: 'none' }
      : resolveDestination(notification.target);
}

/** 받은 응원이면 그 메시지를 신고하는 화면을 연다. 응원이 아니면 없다 */
function useReportCheer({ receivedCheer }: Notification) {
  const { t } = useTranslation('moderation');
  const push = useSingleTap(router.push);

  if (receivedCheer == null) {
    return null;
  }

  return () => {
    const target = createCheerMessageReportTarget(receivedCheer);
    push({
      pathname: '/users/[userId]/report',
      params: {
        userId: target.targetUserId,
        name: receivedCheer.senderName ?? t('fallbackName'),
        targetType: target.targetType,
        targetId: target.targetId,
      },
    });
  };
}
