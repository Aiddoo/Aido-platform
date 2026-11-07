import Check from '@expo/material-symbols/check.xml';
import Edit from '@expo/material-symbols/edit.xml';
import Search from '@expo/material-symbols/search.xml';
import { FriendList } from '@src/features/social/friend/components/friend-list';
import { ReceivedRequestList } from '@src/features/social/friend/components/received-request-list';
import { SentRequestList } from '@src/features/social/friend/components/sent-request-list';
import { useFriendListEditMode } from '@src/features/social/friend/hooks/use-friend-list-edit-mode';
import { useFriendListViewParam } from '@src/features/social/friend/hooks/use-friend-list-view-param';
import {
  FRIEND_LIST_VIEW,
  type FriendListView,
  friendListViewSchema,
} from '@src/features/social/friend/schemas/friend-params.schema';
import { InviteRewardPolicy } from '@src/features/social/invite/domains/invite-reward.model';
import { useInviteAvailability } from '@src/features/social/invite/hooks/use-invite-availability';
import { useOpenMyInvite } from '@src/features/social/invite/hooks/use-open-my-invite';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Box, LineTabTrigger, QueryErrorBoundary, StyledSafeAreaView } from '@src/shared/ui';
import { Stack, router } from 'expo-router';
import { Tabs } from 'heroui-native';
import { type ReactNode, Suspense, useCallback } from 'react';
import { match } from 'ts-pattern';

const SEARCH_ICON = process.env.EXPO_OS === 'ios' ? 'magnifyingglass' : Search;
/** iOS는 글자 버튼(편집/완료), Android 툴바는 글자를 그리지 않아 아이콘을 쓴다. */
const EDIT_ICON = process.env.EXPO_OS === 'ios' ? undefined : Edit;
const DONE_ICON = process.env.EXPO_OS === 'ios' ? undefined : Check;

export default function FriendsScreen() {
  const push = useSingleTap(router.push);

  const { t } = useTranslation(['friend', 'common']);
  const [view, setView] = useFriendListViewParam();
  const [isEditMode, setIsEditMode] = useFriendListEditMode();
  const isInviteAvailable = useInviteAvailability();
  const openMyInvite = useOpenMyInvite();

  const handleTabChange = useCallback(
    (value: string) => {
      const parsed = friendListViewSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      setView(parsed.data);
      if (parsed.data !== FRIEND_LIST_VIEW.friends) {
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
        >
          {t('search.title')}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Button
          hidden={view !== FRIEND_LIST_VIEW.friends}
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

          <LineTabTrigger value={FRIEND_LIST_VIEW.friends}>{t('tabs.friends')}</LineTabTrigger>
          <LineTabTrigger value={FRIEND_LIST_VIEW.receiver}>{t('tabs.received')}</LineTabTrigger>
          <LineTabTrigger value={FRIEND_LIST_VIEW.sender}>{t('tabs.sent')}</LineTabTrigger>
        </Tabs.List>
        {match(view)
          .with(FRIEND_LIST_VIEW.friends, () => (
            <FriendTabContent value={FRIEND_LIST_VIEW.friends}>
              <QueryErrorBoundary resetKeys={[view]} fallback={FriendList.Error}>
                <Suspense fallback={<FriendList.Loading />}>
                  <FriendList
                    invite={
                      isInviteAvailable
                        ? {
                            welcomeDays: InviteRewardPolicy.getWelcomePremiumDays(),
                            open: () => openMyInvite('friends_empty'),
                          }
                        : undefined
                    }
                  />
                </Suspense>
              </QueryErrorBoundary>
            </FriendTabContent>
          ))
          .with(FRIEND_LIST_VIEW.receiver, () => (
            <FriendTabContent value={FRIEND_LIST_VIEW.receiver}>
              <QueryErrorBoundary resetKeys={[view]} fallback={ReceivedRequestList.Error}>
                <Suspense fallback={<ReceivedRequestList.Loading />}>
                  <ReceivedRequestList />
                </Suspense>
              </QueryErrorBoundary>
            </FriendTabContent>
          ))
          .with(FRIEND_LIST_VIEW.sender, () => (
            <FriendTabContent value={FRIEND_LIST_VIEW.sender}>
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

function FriendTabContent({ value, children }: { value: FriendListView; children: ReactNode }) {
  return (
    <Tabs.Content value={value} className="flex-1">
      <Box flex={1} px={16}>
        {children}
      </Box>
    </Tabs.Content>
  );
}
