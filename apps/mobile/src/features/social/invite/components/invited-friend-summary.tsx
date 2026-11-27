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
  SettingsListGroup,
  TextButton,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { useRouter } from 'expo-router';

import { isInviteDisabledError } from '../domains/invite.error';
import { useGetInvitedFriendSummaryInfiniteQueryOptions } from '../queries/invite.queries';
import type { InvitedFriendsView } from '../schemas/invite-params.schema';
import { InvitedFriendRow } from './invited-friend-row';

/** 화면 스크롤 안에 있어 가상화 목록을 쓰지 않는다 */
export function InvitedFriendSummary() {
  const { t } = useTranslation('invite');
  const { data: invitedFriendSummary } = useSuspenseInfiniteQuery(
    useGetInvitedFriendSummaryInfiniteQueryOptions(),
  );
  const router = useRouter();
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
        {invitedFriendSummary.hasMore && (
          <TextButton
            testID="invitees-see-all"
            variant="arrow"
            size="small"
            onPress={openInvitedFriends}
          >
            {t('friendList.seeAll', { count: invitedFriendSummary.totalCount })}
          </TextButton>
        )}
      </HStack>

      {invitedFriendSummary.invitedFriends.length === 0 ? (
        <InvitedFriendSummary.Empty />
      ) : (
        <VStack accessibilityRole="list">
          {invitedFriendSummary.invitedFriends.map((friend) => (
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
    <SettingsListGroup.Empty
      icon={<FriendIllustration size="block" />}
      title={t('friendList.emptyTitle')}
      description={t('friendList.emptyDescription')}
    />
  );
};
