import { NOTIFICATION_CATEGORY, getNotificationsQuerySchema } from '@aido/validators';
import { NotificationList } from '@src/features/notification/presentations/components/notification-list';
import { UnreadNotificationHeader } from '@src/features/notification/presentations/components/unread-notification-header';
import { CATEGORY_TABS } from '@src/features/notification/presentations/constants/notification';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, StyledSafeAreaView, Text } from '@src/shared/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { Tabs } from 'heroui-native';
import { Suspense } from 'react';
import { z } from 'zod';

const notificationCategorySchema = getNotificationsQuerySchema.shape.category;

const NotificationSearchSchema = z.object({
  category: notificationCategorySchema.catch(NOTIFICATION_CATEGORY.ALL),
});

export default function NotificationsScreen() {
  const { category } = NotificationSearchSchema.parse(useLocalSearchParams());
  const { t } = useTranslation('notification');

  return (
    <StyledSafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Tabs
        value={category}
        onValueChange={(value) => {
          const parsed = notificationCategorySchema.safeParse(value);
          if (parsed.success) router.setParams({ category: parsed.data });
        }}
        variant="secondary"
        className="flex-1"
      >
        <Tabs.List className="border-b border-gray-2 w-full">
          <Tabs.Indicator className="h-[2px]" />

          {CATEGORY_TABS.map((tab) => (
            <Tabs.Trigger key={tab.value} value={tab.value} className="py-3">
              {({ isSelected }) => (
                <Tabs.Label>
                  <Text
                    size="b3"
                    className={isSelected ? 'text-main font-semibold' : 'text-gray-5'}
                  >
                    {t(tab.labelKey)}
                  </Text>
                </Tabs.Label>
              )}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <QueryErrorBoundary>
          <Suspense fallback={<UnreadNotificationHeader.Loading />}>
            <UnreadNotificationHeader />
          </Suspense>
        </QueryErrorBoundary>

        <Tabs.Content value={category} className="flex-1">
          <QueryErrorBoundary resetKeys={[category]} fallback={NotificationList.Error}>
            <Suspense fallback={<NotificationList.Loading />}>
              <NotificationList category={category} limit={10} />
            </Suspense>
          </QueryErrorBoundary>
        </Tabs.Content>
      </Tabs>
    </StyledSafeAreaView>
  );
}
