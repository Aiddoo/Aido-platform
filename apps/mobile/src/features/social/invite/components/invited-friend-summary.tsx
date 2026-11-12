import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  FriendIllustration,
  H4,
  HStack,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Result,
  TextButton,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { router } from 'expo-router';

import { isInviteDisabledError } from '../domains/invite.error';
import { useGetInvitedFriendSummaryInfiniteQueryOptions } from '../queries/invite.queries';
import type { InvitedFriendsView } from '../schemas/invite-params.schema';
import { InvitedFriendRow } from './invited-friend-row';

/**
 * 내 초대 화면의 초대한 친구 요약. 기다리는 친구를 먼저 몇 명만 보여 주고,
 * 더 있으면 전체 보기로 넘긴다. 화면 스크롤 안에 있어 가상화 목록을 쓰지 않는다.
 */
export function InvitedFriendSummary() {
  const { t } = useTranslation('invite');
  const { data } = useSuspenseInfiniteQuery(useGetInvitedFriendSummaryInfiniteQueryOptions());
  const openInvitedFriends = useSingleTap(() =>
    router.push({
      pathname: '/friends/invite/invitees',
      params: { view: 'all' satisfies InvitedFriendsView },
    }),
  );

  return (
    <VStack gap={8}>
      <HStack align="center" justify="between" className="min-h-8">
        <H4>{t('friendList.title')}</H4>
        {data.hasMore && (
          <TextButton
            testID="invitees-see-all"
            variant="arrow"
            size="small"
            onPress={openInvitedFriends}
          >
            {t('friendList.seeAll', { count: data.totalCount })}
          </TextButton>
        )}
      </HStack>

      {data.invitedFriends.length === 0 ? (
        <InvitedFriendSummary.Empty />
      ) : (
        <VStack accessibilityRole="list">
          {data.invitedFriends.map((friend) => (
            <InvitedFriendRow key={friend.userId} friend={friend} horizontalPadding="none" />
          ))}
        </VStack>
      )}
    </VStack>
  );
}

InvitedFriendSummary.Loading = function Loading() {
  return (
    <VStack gap={8} accessibilityState={{ busy: true }}>
      <Box className="min-h-8 justify-center">
        <TextSkeleton size="t3" className="w-28" />
      </Box>
      {range(3).map((index) => (
        <InvitedFriendRow.Loading key={index} horizontalPadding="none" />
      ))}
    </VStack>
  );
};

/** 초대가 꺼졌으면 쓸 수 없음 안내를, 그 밖의 실패는 이 블록 안에서 다시 시도를 보인다 */
InvitedFriendSummary.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('invite');

  if (isInviteDisabledError(error)) {
    return <InvitedFriendSummary.Unavailable />;
  }

  return (
    <QueryErrorFallback title={t('friendList.loadFailed')} reset={reset} illustrationSize="block" />
  );
};

InvitedFriendSummary.Unavailable = function Unavailable() {
  const { t } = useTranslation('invite');

  return (
    <VStack gap={8} className="min-h-[200px] justify-center">
      <Result title={t('friendList.unavailable')} />
    </VStack>
  );
};

InvitedFriendSummary.Empty = function Empty() {
  const { t } = useTranslation('invite');

  return (
    <Box className="rounded-[20px] border border-dashed border-gray-3 bg-gray-1 px-5 py-7">
      <Result
        icon={<FriendIllustration size="block" />}
        title={t('friendList.emptyTitle')}
        description={t('friendList.emptyDescription')}
      />
    </Box>
  );
};
