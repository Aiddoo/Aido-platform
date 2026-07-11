import { FriendList } from '@src/features/friend/presentations/components/FriendList';
import { ReceivedRequestList } from '@src/features/friend/presentations/components/ReceivedRequestList';
import { SentRequestList } from '@src/features/friend/presentations/components/SentRequestList';
import { useFriendListEditMode } from '@src/features/friend/presentations/hooks/use-friend-list-edit-mode';
import { useTranslation } from '@src/shared/i18n';
import { HStack, QueryErrorBoundary, SearchIcon, Text } from '@src/shared/ui';
import { router, useNavigation, useRoute } from 'expo-router';
import type { NavigationProp, RouteProp } from 'expo-router/react-navigation';
import { Tabs } from 'heroui-native';
import { Suspense, useCallback, useLayoutEffect } from 'react';
import { Pressable, View } from 'react-native';
import { match } from 'ts-pattern';

const TabView = {
  friends: 'friends',
  receiver: 'receiver',
  sender: 'sender',
} as const;

type TabValue = (typeof TabView)[keyof typeof TabView];

type RouteParams = {
  view?: TabValue;
};

type FriendsRouteParams = {
  friends: RouteParams;
};

const useView = () => {
  const route = useRoute<RouteProp<FriendsRouteParams, 'friends'>>();
  const navigation = useNavigation<NavigationProp<FriendsRouteParams>>();

  const view = route.params?.view ?? TabView.friends;

  const setView = useCallback(
    (newView: TabValue) => {
      navigation.setParams({ view: newView });
    },
    [navigation],
  );

  return [view, setView] as const;
};

export default function FriendsScreen() {
  const { t } = useTranslation(['friend', 'common']);
  const [view, setView] = useView();
  const [isEditMode, setIsEditMode] = useFriendListEditMode();
  const navigation = useNavigation();

  const handleTabChange = useCallback(
    (value: string) => {
      setView(value as TabValue);
      if (value !== TabView.friends) {
        setIsEditMode(false);
      }
    },
    [setView, setIsEditMode],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HStack align="center" gap={4}>
          <Pressable onPress={() => router.push('/friends/search')} hitSlop={8} className="p-2">
            <SearchIcon width={20} height={20} colorClassName="text-gray-9" />
          </Pressable>
          {view === TabView.friends && (
            <Pressable onPress={() => setIsEditMode(!isEditMode)} hitSlop={8} className="p-2">
              <Text size="b3" weight="medium" shade={9}>
                {isEditMode ? t('common:actions.done') : t('list.edit')}
              </Text>
            </Pressable>
          )}
        </HStack>
      ),
    });
  }, [navigation, view, isEditMode, setIsEditMode, t]);

  return (
    <View className="flex-1 bg-white">
      <Tabs value={view} onValueChange={handleTabChange} variant="secondary" className="flex-1">
        <Tabs.List className="border-b border-gray-2 w-full">
          <Tabs.Indicator className="h-[2px]" />

          <Tabs.Trigger value={TabView.friends} className="py-3">
            {({ isSelected }) => (
              <Tabs.Label>
                <Text size="b3" className={isSelected ? 'text-main font-semibold' : 'text-gray-5'}>
                  {t('tabs.friends')}
                </Text>
              </Tabs.Label>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger value={TabView.receiver} className="py-3">
            {({ isSelected }) => (
              <Tabs.Label>
                <Text size="b3" className={isSelected ? 'text-main font-semibold' : 'text-gray-5'}>
                  {t('tabs.received')}
                </Text>
              </Tabs.Label>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger value={TabView.sender} className="py-3">
            {({ isSelected }) => (
              <Tabs.Label>
                <Text size="b3" className={isSelected ? 'text-main font-semibold' : 'text-gray-5'}>
                  {t('tabs.sent')}
                </Text>
              </Tabs.Label>
            )}
          </Tabs.Trigger>
        </Tabs.List>
        {match(view)
          .with(TabView.friends, () => (
            <Tabs.Content value={TabView.friends} className="flex-1">
              <QueryErrorBoundary>
                <Suspense fallback={<FriendList.Loading />}>
                  <FriendList />
                </Suspense>
              </QueryErrorBoundary>
            </Tabs.Content>
          ))
          .with(TabView.receiver, () => (
            <Tabs.Content value={TabView.receiver} className="flex-1">
              <QueryErrorBoundary>
                <Suspense fallback={<ReceivedRequestList.Loading />}>
                  <ReceivedRequestList />
                </Suspense>
              </QueryErrorBoundary>
            </Tabs.Content>
          ))
          .with(TabView.sender, () => (
            <Tabs.Content value={TabView.sender} className="flex-1">
              <QueryErrorBoundary>
                <Suspense fallback={<SentRequestList.Loading />}>
                  <SentRequestList />
                </Suspense>
              </QueryErrorBoundary>
            </Tabs.Content>
          ))
          .exhaustive()}
      </Tabs>
    </View>
  );
}
