import { type NavigationProp, type RouteProp, useRoute } from '@react-navigation/native';
import { ReceivedRequestList } from '@src/features/friend-request/presentations/components/ReceivedRequestList';
import { SentRequestList } from '@src/features/friend-request/presentations/components/SentRequestList';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { Text } from '@src/shared/ui/Text/Text';
import { useNavigation } from 'expo-router';
import { Tabs } from 'heroui-native';
import { Suspense, useCallback } from 'react';
import { View } from 'react-native';
import { match } from 'ts-pattern';

const TabView = {
  sender: 'sender',
  receiver: 'receiver',
} as const;

type TabValue = (typeof TabView)[keyof typeof TabView];

type RouteParams = {
  view?: TabValue;
};

type FriendManagementRouteParams = {
  'friend-management': RouteParams;
};

type UseViewReturn<T> = readonly [T, (newValue: T) => void];

const useView = (): UseViewReturn<TabValue> => {
  const route = useRoute<RouteProp<FriendManagementRouteParams, 'friend-management'>>();
  const navigation = useNavigation<NavigationProp<FriendManagementRouteParams>>();

  const view = route.params?.view ?? TabView.sender;

  const setView = useCallback(
    (newView: TabValue) => {
      navigation.setParams({ view: newView });
    },
    [navigation],
  );

  return [view, setView];
};

export default function FriendManagementScreen() {
  const [view, setView] = useView();

  return (
    <View className="flex-1 bg-white">
      <Tabs
        value={view}
        onValueChange={(value) => setView(value as TabValue)}
        variant="line"
        className="flex-1"
      >
        <Tabs.List>
          <Tabs.Indicator className="h-[2px]" />

          <Tabs.Trigger value={TabView.receiver} className="flex-1 py-3">
            {({ isSelected }) => (
              <Tabs.Label>
                <Text size="b3" className={isSelected ? 'text-main font-semibold' : 'text-gray-5'}>
                  받은 요청
                </Text>
              </Tabs.Label>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger value={TabView.sender} className="flex-1 py-3">
            {({ isSelected }) => (
              <Tabs.Label>
                <Text size="b3" className={isSelected ? 'text-main font-semibold' : 'text-gray-5'}>
                  보낸 요청
                </Text>
              </Tabs.Label>
            )}
          </Tabs.Trigger>
        </Tabs.List>
        {match(view)
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
