import { formatUserHashtag } from '@src/features/user/utils/user-hashtag';
import { useDebouncedValue } from '@src/shared/hooks/useDebouncedValue';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import type { Page } from '@src/shared/types/page.type';
import {
  Box,
  Button,
  CheckIcon,
  Result,
  SearchIcon,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import {
  type InfiniteData,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

import { FriendPolicy, type SearchedUser } from '../../models/friend.model';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';
import { useFriendSearchTracking } from '../hooks/use-friend-search-tracking';
import { useSearchUsersQueryOptions } from '../queries/search-users-query-options';
import { useCancelRequestMutationOptions } from '../queries/use-cancel-request-mutation-options';
import { useSendRequestByTagMutationOptions } from '../queries/use-send-request-by-tag-mutation-options';
import type { SearchedUserViewModel } from '../view-models/searched-user.view-model';
import { UserList } from './UserList';

export function FriendSearchList({ query }: { query: string }) {
  const { t } = useTranslation(['friend', 'common']);
  const queryClient = useQueryClient();
  const normalizedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(normalizedQuery);
  const isSettled = normalizedQuery === debouncedQuery;
  const options = useSearchUsersQueryOptions(normalizedQuery);
  const search = useInfiniteQuery({
    ...options,
    enabled: options.enabled && isSettled,
    throwOnError: (_error, query) => query.state.data === undefined,
  });
  useFriendSearchTracking(debouncedQuery);
  const sendRequest = useMutation(useSendRequestByTagMutationOptions());
  const cancelRequest = useMutation(useCancelRequestMutationOptions());

  const items = search.data?.pages.flatMap((page) => page.items) ?? [];

  const patchUser = (userTag: string, patch: Partial<SearchedUser>) => {
    queryClient.setQueryData<InfiniteData<Page<SearchedUser>>>(
      FRIEND_QUERY_KEYS.search(normalizedQuery),
      (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((user) =>
              user.userTag === userTag ? { ...user, ...patch } : user,
            ),
          })),
        };
      },
    );
  };

  const handleAdd = (user: SearchedUserViewModel) => {
    sendRequest.mutate(user.userTag, {
      onSuccess: (result) =>
        patchUser(
          user.userTag,
          result.autoAccepted
            ? { isFriend: true, isFollowing: true, isFollower: true, requestPending: false }
            : { requestPending: true },
        ),
    });
  };

  const handleCancel = (user: SearchedUserViewModel) => {
    cancelRequest.mutate(user.id, {
      onSuccess: () => patchUser(user.userTag, { requestPending: false }),
    });
  };

  if (!FriendPolicy.isValidSearchQuery({ query: normalizedQuery }))
    return <FriendSearchList.Prompt />;
  if (!isSettled || search.isPending) return <FriendSearchList.Loading />;

  const renderAction = (user: SearchedUserViewModel) =>
    match(user.actionState)
      .with('friend', () => <CheckIcon width={20} height={20} colorClassName="text-gray-4" />)
      .with('pending', () => (
        <Button
          variant="weak"
          color="danger"
          size="small"
          display="inline"
          isDisabled={sendRequest.isPending || cancelRequest.isPending}
          onPress={() => handleCancel(user)}
        >
          {t('friend:search.action.cancel')}
        </Button>
      ))
      .with('add', () => (
        <Button
          variant="fill"
          color="primary"
          size="small"
          display="inline"
          isDisabled={sendRequest.isPending || cancelRequest.isPending}
          onPress={() => handleAdd(user)}
        >
          {t('friend:search.action.add')}
        </Button>
      ))
      .exhaustive();

  return (
    <UserList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={(item: SearchedUserViewModel) => (
        <FriendSearchList.Item
          displayName={item.displayName}
          subtitle={formatUserHashtag(item.userTag)}
          profileImage={item.profileImage}
          action={renderAction(item)}
        />
      )}
      emptyContent={<FriendSearchList.Empty query={normalizedQuery} />}
      footer={
        search.isFetchNextPageError ? (
          <Box py={16}>
            <Button variant="weak" onPress={() => void search.fetchNextPage()}>
              {t('common:actions.retry')}
            </Button>
          </Box>
        ) : undefined
      }
      hasNextPage={search.hasNextPage && !search.isFetchNextPageError}
      isFetching={search.isFetching}
      isFetchingNextPage={search.isFetchingNextPage}
      onEndReached={() => void search.fetchNextPage({ cancelRefetch: false })}
    />
  );
}

FriendSearchList.Loading = function Loading() {
  return <UserList.Loading />;
};

FriendSearchList.Item = function Item(props: ComponentProps<typeof UserList.Item>) {
  return <UserList.Item {...props} />;
};

FriendSearchList.Prompt = function Prompt() {
  const { t } = useTranslation('friend');
  const openAddFriend = useSingleTap(() => router.navigate('/friends/add'));
  return (
    <VStack flex={1} p={24}>
      <Result
        icon={<SearchIcon width={64} height={64} colorClassName="text-gray-4" />}
        title={t('search.empty.prompt')}
        description={t('search.empty.tagHint')}
        button={<Result.Button onPress={openAddFriend}>{t('search.empty.addByTag')}</Result.Button>}
      />
    </VStack>
  );
};

FriendSearchList.Empty = function Empty({ query }: { query: string }) {
  const { t } = useTranslation('friend');
  return (
    <Result
      icon={<SearchIcon width={64} height={64} colorClassName="text-gray-4" />}
      title={t('search.empty.noResults', { query })}
    />
  );
};

FriendSearchList.Error = function ErrorState({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['friend', 'common']);
  return (
    <VStack flex={1} p={24}>
      <Result
        title={t('friend:search.loadError')}
        button={<Result.Button onPress={reset}>{t('common:actions.retry')}</Result.Button>}
      />
    </VStack>
  );
};
