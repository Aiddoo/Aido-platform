import { InvitedFriendList } from '@src/features/invite/components/invited-friend-list';
import {
  type InvitedFriendsView,
  InvitedFriendsViewSchema,
  useInvitedFriendsViewParam,
} from '@src/features/invite/hooks/use-invited-friends-view-param';
import { useGetInviteQueryOptions } from '@src/features/invite/queries/get-invite-query-options';
import { useGetInvitedFriendCountInfiniteQueryOptions } from '@src/features/invite/queries/get-invited-friends-infinite-query-options';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  QueryErrorBoundary,
  ReadableContent,
  StyledSafeAreaView,
  TextSkeleton,
} from '@src/shared/ui';
import {
  usePrefetchInfiniteQuery,
  usePrefetchQuery,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { Tabs } from 'heroui-native';
import { type ComponentProps, Suspense } from 'react';
import { match } from 'ts-pattern';

export default function InvitedFriendsScreen() {
  const { t } = useTranslation('invite');
  const [view, setView] = useInvitedFriendsViewParam();
  // 탭 숫자와 목록이 같은 두 쿼리를 읽으므로 화면에서 함께 시작해 차례로 기다리지 않게 한다
  usePrefetchQuery(useGetInviteQueryOptions());
  usePrefetchInfiniteQuery(useGetInvitedFriendCountInfiniteQueryOptions());

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
      <ReadableContent flex={1}>
        <QueryErrorBoundary resetKeys={[view]} fallback={InvitedFriendList.Error}>
          <Box px={16} pt={8} pb={8}>
            <Suspense fallback={<InvitedFriendFilterTabs.Loading />}>
              <InvitedFriendFilterTabs value={view} onValueChange={setView} />
            </Suspense>
          </Box>

          <Suspense fallback={<InvitedFriendList.Loading />}>
            {match(view)
              .with('all', () => <InvitedFriendList />)
              .with('waiting', () => (
                <InvitedFriendList
                  status="JOINED"
                  ListEmptyComponent={
                    <InvitedFriendList.Empty
                      title={t('friendList.emptyWaitingTitle')}
                      description={t('friendList.emptyWaitingDescription')}
                    />
                  }
                />
              ))
              .exhaustive()}
          </Suspense>
        </QueryErrorBoundary>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}

interface InvitedFriendFilterTabsProps extends Omit<
  ComponentProps<typeof Tabs>,
  'value' | 'onValueChange' | 'children'
> {
  value: InvitedFriendsView;
  /** 원본 Tabs와 같은 이름. 아는 보기 값만 넘긴다 */
  onValueChange?: (value: InvitedFriendsView) => void;
}

/** 전체 수는 전체 목록 첫 페이지, 기다리는 수는 초대 요약에서 읽는다(목록은 걸러서 세면 페이지마다 달라진다) */
function InvitedFriendFilterTabs({
  value,
  onValueChange = noop,
  ...props
}: InvitedFriendFilterTabsProps) {
  const { t } = useTranslation('invite');
  const { data: myInvite } = useSuspenseQuery(useGetInviteQueryOptions());
  const { data: totalCount } = useSuspenseInfiniteQuery(
    useGetInvitedFriendCountInfiniteQueryOptions(),
  );

  const handleValueChange = (next: string) => {
    const parsed = InvitedFriendsViewSchema.safeParse(next);
    if (parsed.success) {
      onValueChange(parsed.data);
    }
  };

  return (
    <Tabs value={value} onValueChange={handleValueChange} variant="primary" {...props}>
      <Tabs.List>
        <Tabs.Indicator />
        <Tabs.Trigger value="all" testID="invitees-tab-all">
          <Tabs.Label>{t('friendList.tab.all', { count: totalCount })}</Tabs.Label>
        </Tabs.Trigger>
        <Tabs.Trigger value="waiting" testID="invitees-tab-waiting">
          <Tabs.Label>{t('friendList.tab.waiting', { count: myInvite.waitingCount })}</Tabs.Label>
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs>
  );
}

/** 숫자를 받기 전에도 같은 탭 모양·선택을 두고 라벨 자리만 비워 둔다 */
InvitedFriendFilterTabs.Loading = function Loading() {
  const [view] = useInvitedFriendsViewParam();

  return (
    <Tabs value={view} onValueChange={noop} variant="primary" accessibilityState={{ busy: true }}>
      <Tabs.List>
        <Tabs.Indicator />
        <Tabs.Trigger value="all">
          <TextSkeleton size="b3" className="w-14" />
        </Tabs.Trigger>
        <Tabs.Trigger value="waiting">
          <TextSkeleton size="b3" className="w-20" />
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs>
  );
};
