import { formatUserHashtag } from '@src/features/user/utils/user-hashtag';
import { useDebouncedValue } from '@src/shared/hooks/use-debounced-value';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  CheckIcon,
  Result,
  SearchIcon,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { match } from 'ts-pattern';

import { FriendPolicy } from '../domains/friend.model';
import { useFriendSearchTracking } from '../hooks/use-friend-search-tracking';
import { useGetUserSearchQueryOptions } from '../queries/get-user-search-query-options';
import { useCancelRequestMutationOptions } from '../queries/use-cancel-request-mutation-options';
import { useSendRequestByTagMutationOptions } from '../queries/use-send-request-by-tag-mutation-options';
import type { SearchedUserViewModel } from '../utils/view-models/searched-user.view-model';
import { UserList } from './user-list';

export function FriendSearchList({ query }: { query: string }) {
  const { t } = useTranslation('common');
  const normalizedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(normalizedQuery);
  const isSettled = normalizedQuery === debouncedQuery;
  const options = useGetUserSearchQueryOptions({ query: normalizedQuery });
  const search = useInfiniteQuery({
    ...options,
    enabled: options.enabled && isSettled,
    throwOnError: (_error, query) => query.state.data == null,
  });
  useFriendSearchTracking(debouncedQuery);

  if (!FriendPolicy.isValidSearchQuery({ query: normalizedQuery })) {
    return <FriendSearchList.Prompt />;
  }
  if (!isSettled || search.isPending) {
    return <FriendSearchList.Loading />;
  }

  return (
    <UserList
      data={search.data?.pages.flatMap((page) => page.items) ?? []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <FriendSearchList.Item user={item} />}
      ListEmptyComponent={<FriendSearchList.Empty query={normalizedQuery} />}
      ListFooterComponent={
        search.isFetchNextPageError ? (
          <Box py={16}>
            <Button variant="weak" onPress={() => search.fetchNextPage()}>
              {t('actions.retry')}
            </Button>
          </Box>
        ) : undefined
      }
      hasNextPage={search.hasNextPage && !search.isFetchNextPageError}
      isFetchingNextPage={search.isFetchingNextPage}
      fetchNextPage={search.fetchNextPage}
    />
  );
}

FriendSearchList.Item = function Item({ user }: { user: SearchedUserViewModel }) {
  const { t } = useTranslation('friend');
  const sendRequest = useMutation(useSendRequestByTagMutationOptions());
  const cancelRequest = useMutation(useCancelRequestMutationOptions());
  const isProcessing = sendRequest.isPending || cancelRequest.isPending;

  return (
    <UserList.Item
      displayName={user.displayName}
      subtitle={formatUserHashtag(user.userTag)}
      profileImage={user.profileImage}
      right={match(user.actionState)
        .with('friend', () => <CheckIcon width={20} height={20} colorClassName="text-gray-4" />)
        .with('pending', () => (
          <Button
            variant="weak"
            color="danger"
            size="small"
            display="inline"
            isDisabled={isProcessing}
            onPress={() => cancelRequest.mutate(user.id)}
          >
            {t('search.action.cancel')}
          </Button>
        ))
        .with('add', () => (
          <Button
            variant="fill"
            color="primary"
            size="small"
            display="inline"
            isDisabled={isProcessing}
            onPress={() => sendRequest.mutate(user.userTag)}
          >
            {t('search.action.add')}
          </Button>
        ))
        .exhaustive()}
    />
  );
};

FriendSearchList.Loading = function Loading() {
  return <UserList.Loading hasSubtitle right={<Skeleton className="h-8 w-12 rounded-xl" />} />;
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

FriendSearchList.Empty = function Empty({ query }: { query: string }) {
  const { t } = useTranslation('friend');
  return (
    <UserList.Empty
      icon={<SearchIcon width={64} height={64} colorClassName="text-gray-4" />}
      title={t('search.empty.noResults', { query })}
    />
  );
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
