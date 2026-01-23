import { ReceivedRequestList } from '@src/features/friend-request/presentations/components/ReceivedRequestList';
import { SentRequestList } from '@src/features/friend-request/presentations/components/SentRequestList';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { Text } from '@src/shared/ui/Text/Text';
import { Tabs } from 'heroui-native';
import { Suspense, useState } from 'react';
import { View } from 'react-native';

type TabValue = 'received' | 'sent';

export default function FriendManagementScreen() {
  const [activeTab, setActiveTab] = useState<TabValue>('received');

  return (
    <View className="flex-1 bg-white">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
        variant="line"
        className="flex-1"
      >
        <Tabs.List>
          <Tabs.Indicator className="h-[2px]" />
          <Tabs.Trigger value="received" className="flex-1 py-3">
            {({ isSelected }) => (
              <Tabs.Label>
                <Text size="b3" className={isSelected ? 'text-main font-semibold' : 'text-gray-5'}>
                  받은 요청
                </Text>
              </Tabs.Label>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger value="sent" className="flex-1 py-3">
            {({ isSelected }) => (
              <Tabs.Label>
                <Text size="b3" className={isSelected ? 'text-main font-semibold' : 'text-gray-5'}>
                  보낸 요청
                </Text>
              </Tabs.Label>
            )}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="received" className="flex-1">
          <QueryErrorBoundary>
            <Suspense fallback={<ReceivedRequestList.Loading />}>
              <ReceivedRequestList />
            </Suspense>
          </QueryErrorBoundary>
        </Tabs.Content>

        <Tabs.Content value="sent" className="flex-1">
          <QueryErrorBoundary>
            <Suspense fallback={<SentRequestList.Loading />}>
              <SentRequestList />
            </Suspense>
          </QueryErrorBoundary>
        </Tabs.Content>
      </Tabs>
    </View>
  );
}
