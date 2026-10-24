import {
  NOTIFICATION_CATEGORY,
  type NotificationCategory,
  getNotificationsQuerySchema,
} from '@aido/api';
import { NotificationList } from '@src/features/notification/components/notification-list';
import { UnreadNotificationCard } from '@src/features/notification/components/unread-notification-card';
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
    <StyledSafeAreaView className="flex-1 bg-background" edges={['left', 'right', 'bottom']}>
      <Tabs
        value={category}
        onValueChange={(value) => {
          const parsed = notificationCategorySchema.safeParse(value);
          if (parsed.success) {
            router.setParams({ category: parsed.data });
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
