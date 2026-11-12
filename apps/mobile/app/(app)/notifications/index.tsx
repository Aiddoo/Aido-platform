import { NOTIFICATION_CATEGORY } from '@aido/api/vocabulary';
import { NotificationList } from '@src/features/notification/components/notification-list';
import { SentNudgeList } from '@src/features/notification/components/sent-nudge-list';
import { UnreadNotificationCard } from '@src/features/notification/components/unread-notification-card';
import { useIsNudgeDirectionSelectable } from '@src/features/notification/hooks/use-is-nudge-direction-selectable';
import {
  useNotificationCategory,
  useNotificationDirection,
} from '@src/features/notification/hooks/use-notification-params';
import {
  notificationCategoryViewSchema,
  notificationDirectionViewSchema,
} from '@src/features/notification/schemas/notification-params.schema';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  LineTabTrigger,
  QueryErrorBoundary,
  ReadableContent,
  SegmentTabTrigger,
  StyledSafeAreaView,
  ViewTabs,
} from '@src/shared/ui';
import { Tabs } from 'heroui-native';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

export default function NotificationsScreen() {
  const { t } = useTranslation('notification');

  const [category, setCategory] = useNotificationCategory();
  const [direction, setDirection] = useNotificationDirection();
  const isDirectionSelectable = useIsNudgeDirectionSelectable(category);
  // 나눠 볼 수 없는 분류에서는 주소에 sent가 남아 있어도 받은 알림을 보인다
  const visibleDirection = isDirectionSelectable ? direction : 'received';

  return (
    <StyledSafeAreaView
      className="flex-1 bg-white"
      edges={['left', 'right', 'bottom']}
      testID="notification-inbox"
    >
      <ReadableContent flex={1}>
        <ViewTabs
          schema={notificationCategoryViewSchema}
          value={category}
          onValueChange={setCategory}
          variant="secondary"
          className="flex-1"
        >
          <Tabs.List className="w-full border-b border-gray-2">
            <Tabs.Indicator className="h-[2px]" />

            <LineTabTrigger value={NOTIFICATION_CATEGORY.ALL}>{t('categories.all')}</LineTabTrigger>
            <LineTabTrigger value={NOTIFICATION_CATEGORY.NOTICE}>
              {t('categories.notice')}
            </LineTabTrigger>
            <LineTabTrigger value={NOTIFICATION_CATEGORY.TODO}>
              {t('categories.todo')}
            </LineTabTrigger>
            <LineTabTrigger value={NOTIFICATION_CATEGORY.SOCIAL}>
              {t('categories.social')}
            </LineTabTrigger>
          </Tabs.List>

          {/* 콕 상호작용을 쓰는 사용자에게만 보이는 줄이라 응답 전에는 자리를 잡지 않는다. 자리를 잡으면 대부분의 사용자에게서 나타났다 사라진다 */}
          {isDirectionSelectable && (
            <Box px={16} pt={12} pb={4}>
              <ViewTabs
                schema={notificationDirectionViewSchema}
                value={direction}
                onValueChange={setDirection}
                variant="primary"
              >
                <Tabs.List className="self-start">
                  <Tabs.Indicator />
                  <SegmentTabTrigger value="received">{t('directions.received')}</SegmentTabTrigger>
                  <SegmentTabTrigger value="sent">{t('directions.sent')}</SegmentTabTrigger>
                </Tabs.List>
              </ViewTabs>
            </Box>
          )}

          {match(visibleDirection)
            .with('received', () => (
              <>
                {/* 안 읽은 수와 모두 읽음은 모든 분류를 합친 값이라 전체 탭에만 둔다. 벨과 같은 수를 읽어 벨을 거쳐 오면 값이 이미 있고, 0이면 줄 자체가 없으니 자리를 잡지 않는다 */}
                {category === NOTIFICATION_CATEGORY.ALL && (
                  <QueryErrorBoundary fallback={() => null}>
                    <Suspense fallback={null}>
                      <UnreadNotificationCard className="mx-4 my-2" />
                    </Suspense>
                  </QueryErrorBoundary>
                )}

                <Tabs.Content value={category} className="flex-1">
                  <QueryErrorBoundary resetKeys={[category]} fallback={NotificationList.Error}>
                    <Suspense fallback={<NotificationList.Loading />}>
                      <NotificationList />
                    </Suspense>
                  </QueryErrorBoundary>
                </Tabs.Content>
              </>
            ))
            .with('sent', () => (
              <Tabs.Content value={category} className="flex-1">
                <QueryErrorBoundary fallback={SentNudgeList.Error}>
                  <Suspense fallback={<SentNudgeList.Loading />}>
                    <SentNudgeList />
                  </Suspense>
                </QueryErrorBoundary>
              </Tabs.Content>
            ))
            .exhaustive()}
        </ViewTabs>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}
