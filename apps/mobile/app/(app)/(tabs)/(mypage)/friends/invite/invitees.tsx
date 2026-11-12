import { REDEMPTION_STATUS } from '@aido/api/vocabulary';
import { InvitedFriendFilterTabs } from '@src/features/social/invite/components/invited-friend-filter-tabs';
import { InvitedFriendList } from '@src/features/social/invite/components/invited-friend-list';
import { useInvitedFriendsView } from '@src/features/social/invite/hooks/use-invited-friends-view';
import {
  useGetInviteQueryOptions,
  useGetInvitedFriendCountInfiniteQueryOptions,
} from '@src/features/social/invite/queries/invite.queries';
import { useTranslation } from '@src/shared/i18n';
import { Box, QueryErrorBoundary, ReadableContent, StyledSafeAreaView } from '@src/shared/ui';
import { usePrefetchInfiniteQuery, usePrefetchQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

export default function InvitedFriendsScreen() {
  const { t } = useTranslation('invite');
  const [view] = useInvitedFriendsView();
  // 탭 숫자와 목록이 같은 두 쿼리를 읽으므로 화면에서 함께 시작해 차례로 기다리지 않게 한다
  usePrefetchQuery(useGetInviteQueryOptions());
  usePrefetchInfiniteQuery(useGetInvitedFriendCountInfiniteQueryOptions());

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
      <ReadableContent flex={1}>
        {/* 탭의 수와 목록은 다른 조회라 수를 못 받아도 목록은 그대로 보인다 */}
        <Box px={16} pt={8} pb={8}>
          <QueryErrorBoundary fallback={InvitedFriendFilterTabs.Error}>
            <Suspense fallback={<InvitedFriendFilterTabs.Loading />}>
              <InvitedFriendFilterTabs />
            </Suspense>
          </QueryErrorBoundary>
        </Box>

        <QueryErrorBoundary resetKeys={[view]} fallback={InvitedFriendList.Error}>
          <Suspense fallback={<InvitedFriendList.Loading />}>
            {match(view)
              .with('all', () => <InvitedFriendList />)
              .with('waiting', () => (
                <InvitedFriendList
                  status={REDEMPTION_STATUS.JOINED}
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
