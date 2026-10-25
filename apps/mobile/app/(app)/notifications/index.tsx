import {
  NOTIFICATION_CATEGORY,
  type NotificationCategory,
  getNotificationsQuerySchema,
} from '@aido/api';
import { NotificationList } from '@src/features/notification/components/notification-list';
import { SentNudgeList } from '@src/features/notification/components/sent-nudge-list';
import { UnreadNotificationCard } from '@src/features/notification/components/unread-notification-card';
import { useNotificationCategoryParam } from '@src/features/notification/hooks/use-notification-category-param';
import { useNotificationDirectionParam } from '@src/features/notification/hooks/use-notification-direction-param';
import {
  nudgeDirectionSchema,
  type NudgeDirection,
} from '@src/features/nudge/domains/nudge-interaction.model';
import { useGetNudgeInteractionAvailabilityQueryOptions } from '@src/features/nudge/queries/get-nudge-interaction-availability-query-options';
import { useTranslation } from '@src/shared/i18n';
import { Box, QueryErrorBoundary, StyledSafeAreaView, Text } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'heroui-native';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

const notificationCategorySchema = getNotificationsQuerySchema.shape.category;

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
    <StyledSafeAreaView className="flex-1 bg-background" edges={['left', 'right', 'bottom']}>
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

          <CategoryTab value={NOTIFICATION_CATEGORY.ALL}>{t('categories.all')}</CategoryTab>
          <CategoryTab value={NOTIFICATION_CATEGORY.NOTICE}>{t('categories.notice')}</CategoryTab>
          <CategoryTab value={NOTIFICATION_CATEGORY.TODO}>{t('categories.todo')}</CategoryTab>
          <CategoryTab value={NOTIFICATION_CATEGORY.SOCIAL}>{t('categories.social')}</CategoryTab>
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
                    <NotificationList category={category} limit={10} />
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
    </StyledSafeAreaView>
  );
}

function CategoryTab({ value, children }: { value: NotificationCategory; children: string }) {
  return (
    <Tabs.Trigger value={value} className="py-3">
      {({ isSelected }) => (
        <Tabs.Label>
          <Text size="b3" className={isSelected ? 'text-main font-semibold' : 'text-gray-5'}>
            {children}
          </Text>
        </Tabs.Label>
      )}
    </Tabs.Trigger>
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
          <DirectionTab value="received">{t('directions.received')}</DirectionTab>
          <DirectionTab value="sent">{t('directions.sent')}</DirectionTab>
        </Tabs.List>
      </Tabs>
    </Box>
  );
}

function DirectionTab({ value, children }: { value: NudgeDirection; children: string }) {
  return (
    <Tabs.Trigger value={value}>
      {({ isSelected }) => (
        <Tabs.Label>
          <Text size="b4" weight={isSelected ? 'bold' : 'medium'} shade={isSelected ? 8 : 6}>
            {children}
          </Text>
        </Tabs.Label>
      )}
    </Tabs.Trigger>
  );
}
