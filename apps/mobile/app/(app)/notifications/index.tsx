import { NOTIFICATION_CATEGORY } from '@aido/api/vocabulary';
import { NotificationList } from '@src/features/notification/components/notification-list';
import { SentNudgeList } from '@src/features/notification/components/sent-nudge-list';
import { UnreadNotificationCard } from '@src/features/notification/components/unread-notification-card';
import { useNotificationCategoryParam } from '@src/features/notification/hooks/use-notification-category-param';
import { useNotificationDirectionParam } from '@src/features/notification/hooks/use-notification-direction-param';
import { notificationCategorySchema } from '@src/features/notification/schemas/notification.schema';
import { useGetNudgeInteractionAvailabilityQueryOptions } from '@src/features/social/nudge/queries/nudge.queries';
import {
  nudgeDirectionSchema,
  type NudgeDirection,
} from '@src/features/social/nudge/schemas/nudge-interaction.schema';
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
  const isDirectionSelectable =
    category === NOTIFICATION_CATEGORY.SOCIAL && isNudgeInteractionAvailable;
  const visibleDirection: NudgeDirection = isDirectionSelectable ? direction : 'received';

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['left', 'right', 'bottom']}>
      <ReadableContent flex={1}>
        <Tabs
          value={category}
          onValueChange={(value) => {
            const parsed = notificationCategorySchema.safeParse(value);
            if (parsed.success) {
              setCategory(parsed.data);
            }
          }}
          variant="secondary"
          className="flex-1"
        >
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
                <QueryErrorBoundary>
                  <Suspense fallback={<UnreadNotificationCard.Loading />}>
                    <UnreadNotificationCard />
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
  onValueChange: (direction: NudgeDirection) => void;
}) {
  const { t } = useTranslation('notification');

  return (
    <Box px={16} pt={12} pb={4}>
      <Tabs
        value={value}
        onValueChange={(nextValue) => {
          const parsed = nudgeDirectionSchema.safeParse(nextValue);
          if (parsed.success) {
            onValueChange(parsed.data);
          }
        }}
        variant="primary"
      >
        <Tabs.List className="self-start">
          <Tabs.Indicator />
          <SegmentTabTrigger value="received">{t('directions.received')}</SegmentTabTrigger>
          <SegmentTabTrigger value="sent">{t('directions.sent')}</SegmentTabTrigger>
        </Tabs.List>
      </Tabs>
    </Box>
  );
}
