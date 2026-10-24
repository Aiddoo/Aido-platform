import { FriendList } from '@src/features/friend/components/friend-list';
import { ReceivedRequestList } from '@src/features/friend/components/received-request-list';
import { SentRequestList } from '@src/features/friend/components/sent-request-list';
import { useFriendListEditMode } from '@src/features/friend/hooks/use-friend-list-edit-mode';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  QueryErrorBoundary,
  SearchIcon,
  StyledSafeAreaView,
  Text,
} from '@src/shared/ui';
import { router, useNavigation, useLocalSearchParams } from 'expo-router';
import { Tabs } from 'heroui-native';
import { type ReactNode, Suspense, useCallback, useLayoutEffect } from 'react';
import { Pressable } from 'react-native';
import { match } from 'ts-pattern';
import { z } from 'zod';

const TabView = {
  friends: 'friends',
  receiver: 'receiver',
  sender: 'sender',
} as const;

const friendTabSchema = z.enum(TabView);
type TabValue = z.infer<typeof friendTabSchema>;

export default function FriendsScreen() {
  const push = useSingleTap(router.push);

  const { t } = useTranslation(['friend', 'common']);
  const [view, setView] = useView();
  const [isEditMode, setIsEditMode] = useFriendListEditMode();
  const navigation = useNavigation();

  const handleTabChange = useCallback(
    (value: string) => {
      const parsed = friendTabSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      setView(parsed.data);
      if (parsed.data !== TabView.friends) {
        setIsEditMode(false);
      }
    },
    [setView, setIsEditMode],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HStack align="center" gap={4}>
          <Pressable onPress={() => push('/friends/search')} hitSlop={8} className="p-2">
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
  }, [navigation, view, isEditMode, setIsEditMode, t, push]);

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
      <Tabs value={view} onValueChange={handleTabChange} variant="secondary" className="flex-1">
        <Tabs.List className="border-b border-gray-2 w-full">
          <Tabs.Indicator className="h-[2px]" />

          <FriendTab value={TabView.friends}>{t('tabs.friends')}</FriendTab>
          <FriendTab value={TabView.receiver}>{t('tabs.received')}</FriendTab>
          <FriendTab value={TabView.sender}>{t('tabs.sent')}</FriendTab>
        </Tabs.List>
        {match(view)
          .with(TabView.friends, () => (
            <FriendTabContent value={TabView.friends}>
              <QueryErrorBoundary resetKeys={[view]} fallback={FriendList.Error}>
                <Suspense fallback={<FriendList.Loading />}>
                  <FriendList />
                </Suspense>
              </QueryErrorBoundary>
            </FriendTabContent>
          ))
          .with(TabView.receiver, () => (
            <FriendTabContent value={TabView.receiver}>
              <QueryErrorBoundary resetKeys={[view]} fallback={ReceivedRequestList.Error}>
                <Suspense fallback={<ReceivedRequestList.Loading />}>
                  <ReceivedRequestList />
                </Suspense>
              </QueryErrorBoundary>
            </FriendTabContent>
          ))
          .with(TabView.sender, () => (
            <FriendTabContent value={TabView.sender}>
              <QueryErrorBoundary resetKeys={[view]} fallback={SentRequestList.Error}>
                <Suspense fallback={<SentRequestList.Loading />}>
                  <SentRequestList />
                </Suspense>
              </QueryErrorBoundary>
            </FriendTabContent>
          ))
          .exhaustive()}
      </Tabs>
    </StyledSafeAreaView>
  );
}

function FriendTab({ value, children }: { value: TabValue; children: string }) {
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

function FriendTabContent({ value, children }: { value: TabValue; children: ReactNode }) {
  return (
    <Tabs.Content value={value} className="flex-1">
      <Box flex={1} px={16}>
        {children}
      </Box>
    </Tabs.Content>
  );
}

function useView() {
  const params = useLocalSearchParams();
  const view = friendTabSchema.catch(TabView.friends).parse(params.view);
  const setView = useCallback((view: TabValue) => router.setParams({ view }), []);
  return [view, setView] as const;
}
