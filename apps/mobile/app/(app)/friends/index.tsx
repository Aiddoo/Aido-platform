import Check from '@expo/material-symbols/check.xml';
import Edit from '@expo/material-symbols/edit.xml';
import Search from '@expo/material-symbols/search.xml';
import { FriendList } from '@src/features/friend/components/friend-list';
import { ReceivedRequestList } from '@src/features/friend/components/received-request-list';
import { SentRequestList } from '@src/features/friend/components/sent-request-list';
import { useFriendListEditMode } from '@src/features/friend/hooks/use-friend-list-edit-mode';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Box, QueryErrorBoundary, StyledSafeAreaView, Text } from '@src/shared/ui';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Tabs } from 'heroui-native';
import { type ReactNode, Suspense, useCallback } from 'react';
import { match } from 'ts-pattern';
import { z } from 'zod';

const TabView = {
  friends: 'friends',
  receiver: 'receiver',
  sender: 'sender',
} as const;

const SEARCH_ICON = process.env.EXPO_OS === 'ios' ? 'magnifyingglass' : Search;
/** iOS는 글자 버튼(편집/완료), Android 툴바는 글자를 그리지 않아 아이콘을 쓴다. */
const EDIT_ICON = process.env.EXPO_OS === 'ios' ? undefined : Edit;
const DONE_ICON = process.env.EXPO_OS === 'ios' ? undefined : Check;

const friendTabSchema = z.enum(TabView);
type TabValue = z.infer<typeof friendTabSchema>;

export default function FriendsScreen() {
  const push = useSingleTap(router.push);

  const { t } = useTranslation(['friend', 'common']);
  const [view, setView] = useView();
  const [isEditMode, setIsEditMode] = useFriendListEditMode();

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

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={SEARCH_ICON}
          accessibilityLabel={t('search.title')}
          onPress={() => push('/friends/search')}
        />
        <Stack.Toolbar.Button
          hidden={view !== TabView.friends}
          icon={isEditMode ? DONE_ICON : EDIT_ICON}
          accessibilityLabel={isEditMode ? t('common:actions.done') : t('list.edit')}
          onPress={() => setIsEditMode(!isEditMode)}
        >
          {isEditMode ? t('common:actions.done') : t('list.edit')}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
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
