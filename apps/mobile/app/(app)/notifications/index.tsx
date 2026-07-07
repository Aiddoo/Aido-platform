import { NOTIFICATION_CATEGORY, type NotificationCategory } from '@aido/validators';
import { NotificationList } from '@src/features/notification/presentations/components/notification-list';
import { UnreadNotificationHeader } from '@src/features/notification/presentations/components/unread-notification-header';
import { CATEGORY_TABS } from '@src/features/notification/presentations/constants/notification';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, StyledSafeAreaView, Text } from '@src/shared/ui';
import { useNavigation, useRoute } from 'expo-router';
import type { NavigationProp, RouteProp } from 'expo-router/react-navigation';
import { Tabs } from 'heroui-native';
import { Suspense, useCallback } from 'react';

type RouteParams = {
  category?: NotificationCategory;
};

type NotificationsRouteParams = {
  notifications: RouteParams;
};

const useView = () => {
  const route = useRoute<RouteProp<NotificationsRouteParams, 'notifications'>>();
  const navigation = useNavigation<NavigationProp<NotificationsRouteParams>>();

  const category = route.params?.category ?? NOTIFICATION_CATEGORY.ALL;

  const setCategory = useCallback(
    (newCategory: NotificationCategory) => {
      navigation.setParams({ category: newCategory });
    },
    [navigation],
  );

  return [category, setCategory] as const;
};

export default function NotificationsScreen() {
  const [category, setCategory] = useView();
  const { t } = useTranslation('notification');

  return (
    <StyledSafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Tabs
        value={category}
        onValueChange={(value) => setCategory(value as NotificationCategory)}
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
          <QueryErrorBoundary>
            <Suspense fallback={<NotificationList.Loading />}>
              <NotificationList category={category} limit={10} />
            </Suspense>
          </QueryErrorBoundary>
        </Tabs.Content>
      </Tabs>
    </StyledSafeAreaView>
  );
}
