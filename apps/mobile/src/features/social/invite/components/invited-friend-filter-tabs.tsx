import { useTranslation } from '@src/shared/i18n';
import { SegmentTabTrigger, TextSkeleton, ViewTabs } from '@src/shared/ui';
import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { Tabs } from 'heroui-native';

import { useInvitedFriendsView } from '../hooks/use-invited-friends-view';
import {
  useGetInviteQueryOptions,
  useGetInvitedFriendCountInfiniteQueryOptions,
} from '../queries/invite.queries';
import { invitedFriendsViewSchema } from '../schemas/invite-params.schema';

/** 전체 수는 전체 목록 첫 페이지, 기다리는 수는 초대 요약에서 읽는다(목록은 걸러서 세면 페이지마다 달라진다) */
export function InvitedFriendFilterTabs() {
  const { t } = useTranslation('invite');
  const [view, setView] = useInvitedFriendsView();
  const { data: myInvite } = useSuspenseQuery(useGetInviteQueryOptions());
  const { data: totalCount } = useSuspenseInfiniteQuery(
    useGetInvitedFriendCountInfiniteQueryOptions(),
  );

  return (
    <ViewTabs
      schema={invitedFriendsViewSchema}
      value={view}
      onValueChange={setView}
      variant="primary"
    >
      <Tabs.List>
        <Tabs.Indicator />
        <SegmentTabTrigger value="all" testID="invitees-tab-all" size="b2">
          {t('friendList.tab.all', { count: totalCount })}
        </SegmentTabTrigger>
        <SegmentTabTrigger value="waiting" testID="invitees-tab-waiting" size="b2">
          {t('friendList.tab.waiting', { count: myInvite.waitingCount })}
        </SegmentTabTrigger>
      </Tabs.List>
    </ViewTabs>
  );
}

/** 수를 받지 못해도 탭은 그대로 바꿀 수 있게 수 없는 라벨로 그린다 */
InvitedFriendFilterTabs.Error = function ErrorFallback() {
  const { t } = useTranslation('invite');
  const [view, setView] = useInvitedFriendsView();

  return (
    <ViewTabs
      schema={invitedFriendsViewSchema}
      value={view}
      onValueChange={setView}
      variant="primary"
    >
      <Tabs.List>
        <Tabs.Indicator />
        <SegmentTabTrigger value="all" testID="invitees-tab-all" size="b2">
          {t('friendList.tab.allLabel')}
        </SegmentTabTrigger>
        <SegmentTabTrigger value="waiting" testID="invitees-tab-waiting" size="b2">
          {t('friendList.tab.waitingLabel')}
        </SegmentTabTrigger>
      </Tabs.List>
    </ViewTabs>
  );
};

/** 숫자를 받기 전에도 같은 탭 모양·선택을 두고 라벨 자리만 비워 둔다 */
InvitedFriendFilterTabs.Loading = function Loading() {
  const [view] = useInvitedFriendsView();

  return (
    <Tabs value={view} onValueChange={noop} variant="primary" accessibilityState={{ busy: true }}>
      <Tabs.List>
        <Tabs.Indicator />
        <Tabs.Trigger value="all">
          <TextSkeleton size="b2" className="w-14" />
        </Tabs.Trigger>
        <Tabs.Trigger value="waiting">
          <TextSkeleton size="b2" className="w-20" />
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs>
  );
};
