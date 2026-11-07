import { NOTIFICATION_CATEGORY } from '@aido/api/vocabulary';
import { NotificationList } from '@src/features/notification/components/notification-list';
import { SentNudgeList } from '@src/features/notification/components/sent-nudge-list';
import { UnreadNotificationCard } from '@src/features/notification/components/unread-notification-card';
import { NotificationPolicy } from '@src/features/notification/domains/notification.model';
import { useNotificationCategoryParam } from '@src/features/notification/hooks/use-notification-category-param';
import { useNotificationDirectionParam } from '@src/features/notification/hooks/use-notification-direction-param';
import { useGetNudgeInteractionAvailabilityQueryOptions } from '@src/features/social/nudge/queries/nudge.queries';
import type { NudgeDirection } from '@src/features/social/nudge/schemas/nudge-interaction.schema';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  LineTabTrigger,
  QueryErrorBoundary,
  ReadableContent,
  SegmentTabTrigger,
  StyledSafeAreaView,
} from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'heroui-native';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

export default function NotificationsScreen() {
  const { t } = useTranslation('notification');
  const [category, setCategory] = useNotificationCategoryParam();
  const [direction, setDirection] = useNotificationDirectionParam();
  const { data: isNudgeInteractionAvailable = false } = useQuery(
    useGetNudgeInteractionAvailabilityQueryOptions(),
  );
  const isDirectionSelectable = NotificationPolicy.canSelectDirection(
    category,
    isNudgeInteractionAvailable,
  );
  const visibleDirection: NudgeDirection = isDirectionSelectable ? direction : 'received';

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['left', 'right', 'bottom']}>
      <ReadableContent flex={1}>
        <Tabs value={category} onValueChange={setCategory} variant="secondary" className="flex-1">
          <Tabs.List className="border-b border-gray-2 w-full">
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

          {isDirectionSelectable && (
            <DirectionTabs value={visibleDirection} onValueChange={setDirection} />
          )}

          {match(visibleDirection)
            .with('received', () => (
              <>
                <QueryErrorBoundary fallback={() => null}>
                  <Suspense fallback={<UnreadNotificationCard.Loading className="mx-4 my-2" />}>
                    <UnreadNotificationCard className="mx-4 my-2" />
                  </Suspense>
                </QueryErrorBoundary>

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
        </Tabs>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}

function DirectionTabs({
  value,
  onValueChange,
}: {
  value: NudgeDirection;
  onValueChange: (direction: string) => void;
}) {
  const { t } = useTranslation('notification');

  return (
    <Box px={16} pt={12} pb={4}>
      <Tabs value={value} onValueChange={onValueChange} variant="primary">
        <Tabs.List className="self-start">
          <Tabs.Indicator />
          <SegmentTabTrigger value="received">{t('directions.received')}</SegmentTabTrigger>
          <SegmentTabTrigger value="sent">{t('directions.sent')}</SegmentTabTrigger>
        </Tabs.List>
      </Tabs>
    </Box>
  );
}
