import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Box, H4, HStack, PawIcon, Result, TextButton, TextSkeleton, VStack } from '@src/shared/ui';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';

import { useGetInvitedFriendSummaryInfiniteQueryOptions } from '../queries/get-invited-friends-infinite-query-options';
import { invitedFriendsHref } from '../utils/navigation/invite-href';
import { InvitedFriendRow } from './invited-friend-row';

/**
 * 내 초대 화면의 초대한 친구 요약. 기다리는 친구를 먼저 몇 명만 보여 주고,
 * 더 있으면 전체 보기로 넘긴다. 화면 스크롤 안에 있어 가상화 목록을 쓰지 않는다.
 */
export function InvitedFriendSummary({ className, ...props }: ComponentProps<typeof VStack>) {
  const { t } = useTranslation('invite');
  const { data } = useSuspenseInfiniteQuery(useGetInvitedFriendSummaryInfiniteQueryOptions());
  const openInvitedFriends = useSingleTap(() => router.push(invitedFriendsHref()));

  return (
    <InvitedFriendSummaryFrame className={className} {...props}>
      <HStack align="center" justify="between" className="min-h-8 px-4">
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
            <InvitedFriendRow key={friend.userId} friend={friend} />
          ))}
        </VStack>
      )}
    </InvitedFriendSummaryFrame>
  );
}

InvitedFriendSummary.Loading = function Loading() {
  return (
    <InvitedFriendSummaryFrame accessibilityState={{ busy: true }}>
      <Box className="min-h-8 justify-center px-4">
        <TextSkeleton size="t3" className="w-28" />
      </Box>
      {times(3, (index) => (
        <InvitedFriendRow.Loading key={index} />
      ))}
    </InvitedFriendSummaryFrame>
  );
};

InvitedFriendSummary.Unavailable = function Unavailable() {
  const { t } = useTranslation('invite');

  return (
    <InvitedFriendSummaryFrame className="min-h-[200px] justify-center">
      <Result title={t('friendList.unavailable')} />
    </InvitedFriendSummaryFrame>
  );
};

InvitedFriendSummary.Empty = function Empty() {
  const { t } = useTranslation('invite');

  return (
    <Box className="mx-4 rounded-[20px] border border-dashed border-gray-3 bg-white px-5 py-7">
      <Result
        icon={<PawIcon width={36} height={36} colorClassName="text-gray-3" />}
        title={t('friendList.emptyTitle')}
        description={t('friendList.emptyDescription')}
      />
    </Box>
  );
};

/** 친구 행이 화면 끝까지 닿도록 Screen이 바깥 여백을 걷어 내고 둔다. 제목·빈 상태는 행과 같은 안쪽 여백을 쓴다 */
function InvitedFriendSummaryFrame(props: ComponentProps<typeof VStack>) {
  return <VStack gap={8} {...props} />;
}
