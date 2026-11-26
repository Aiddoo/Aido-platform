import { USER_TAG_LENGTH } from '@aido/api/vocabulary';
import {
  USER_LIST_CONTENT_STYLE,
  UserList,
} from '@src/features/identity/user/components/user-list';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  CheckIcon,
  InfiniteList,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Result,
  SearchIllustration,
  VStack,
} from '@src/shared/ui';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { Fragment, type ReactNode } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';
import { match } from 'ts-pattern';

import { type SearchedUser, SearchedUserPolicy } from '../domains/searched-user.model';
import { useFriendLimitPrompt } from '../hooks/use-friend-limit-prompt';
import { useFriendSearchTracking } from '../hooks/use-friend-search-tracking';
import {
  useCancelRequestMutationOptions,
  useSendRequestByTagMutationOptions,
} from '../queries/friend.mutations';
import { useGetUserSearchInfiniteQueryOptions } from '../queries/friend.queries';
import { isValidSearchQuery } from '../schemas/friend-request.schema';

const SEARCH_CONTENT_STYLE = { ...USER_LIST_CONTENT_STYLE, paddingHorizontal: 16 };

// iPhone·Android는 검색창이 네이티브 헤더라 목록이 헤더 밑에 깔린다. 모든 상태가 같은 inset을 받아야 가려지지 않는다.
// 검색 중에는 키보드가 떠 있으므로 첫 탭이 키보드를 내리는 데 먹히지 않게 하고, 끌면 내리고, 가운데 안내가 키보드에 가려지지 않게 한다
const SEARCH_SCROLL_PROPS = {
  contentInsetAdjustmentBehavior: 'automatic',
  keyboardShouldPersistTaps: 'handled',
  keyboardDismissMode: 'on-drag',
  automaticallyAdjustKeyboardInsets: true,
} satisfies ScrollViewProps;

interface FriendSearchListProps {
  /** 입력칸의 지금 값 */
  query: string;
  /** 입력이 멈춘 뒤 검색에 쓰는 값. 두 값이 다르면 입력 중이다 */
  settledQuery: string;
  /** 행 오른쪽 버튼(`FriendSearchList.Action`). 한도 안내의 초대 길은 위층 기능이라 화면이 버튼에 바로 넘긴다 */
  renderAction: (user: SearchedUser) => ReactNode;
}

export function FriendSearchList({ query, settledQuery, renderAction }: FriendSearchListProps) {
  const normalizedQuery = query.trim();
  const debouncedQuery = settledQuery.trim();
  const isSettled = normalizedQuery === debouncedQuery;
  const options = useGetUserSearchInfiniteQueryOptions({ query: normalizedQuery });
  const search = useInfiniteQuery({
    ...options,
    enabled: options.enabled && isSettled,
    throwOnError: (_error, query) => query.state.data == null,
  });
  useFriendSearchTracking(debouncedQuery);

  if (!isValidSearchQuery(normalizedQuery)) {
    return <FriendSearchList.Prompt />;
  }
  if (!isSettled || search.isPending) {
    return <FriendSearchList.Loading />;
  }

  return (
    <InfiniteList
      {...SEARCH_SCROLL_PROPS}
      data={search.data ?? []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <FriendSearchList.Item user={item} action={renderAction(item)} />}
      ListEmptyComponent={<FriendSearchList.Empty query={normalizedQuery} />}
      contentContainerStyle={SEARCH_CONTENT_STYLE}
      hasNextPage={search.hasNextPage}
      isFetchingNextPage={search.isFetchingNextPage}
      isFetchNextPageError={search.isFetchNextPageError}
      fetchNextPage={search.fetchNextPage}
    />
  );
}

FriendSearchList.Item = function Item({ user, action }: { user: SearchedUser; action: ReactNode }) {
  const { t } = useTranslation('friend');

  return (
    <UserList.Item
      displayName={user.name ?? t('fallbackName')}
      userTag={user.userTag}
      profileImage={user.profileImage}
      // 목록이 행을 재활용해도 처리 중 상태가 다른 사용자로 넘어가지 않게 사용자마다 새로 만든다
      right={<Fragment key={user.id}>{action}</Fragment>}
    />
  );
};

FriendSearchList.Action = function Action({
  user,
  onFriendLimitInvite,
}: {
  user: SearchedUser;
  onFriendLimitInvite?: () => void;
}) {
  const { t } = useTranslation('friend');
  const fontScaledSize = useFontScaledSize();
  const promptFriendLimit = useFriendLimitPrompt({ onFriendLimitInvite });
  // 한도 안내는 mutation 단계에 걸어, 검색어를 바꿔 이 행이 내려간 뒤에 실패해도 뜬다
  const sendRequest = useMutation({
    ...useSendRequestByTagMutationOptions(),
    onError: promptFriendLimit,
  });
  const cancelRequest = useMutation(useCancelRequestMutationOptions());
  const isProcessing = sendRequest.isPending || cancelRequest.isPending;

  return match(SearchedUserPolicy.getRequestState(user))
    .with('friend', () => (
      <CheckIcon
        width={fontScaledSize(20)}
        height={fontScaledSize(20)}
        colorClassName="text-gray-4"
      />
    ))
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
    .with('none', () => (
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
    .exhaustive();
};

FriendSearchList.Loading = function Loading() {
  return (
    <UserList.Loading
      hasSubtitle
      right={<Skeleton className="h-8 w-12 rounded-xl" />}
      scrollProps={{ ...SEARCH_SCROLL_PROPS, contentContainerStyle: SEARCH_CONTENT_STYLE }}
    />
  );
};

FriendSearchList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['friend', 'common']);
  return (
    <SearchScroll>
      <VStack flex={1} p={24}>
        <QueryErrorFallback title={t('friend:search.loadError')} reset={reset} />
      </VStack>
    </SearchScroll>
  );
};

FriendSearchList.Empty = function Empty({ query }: { query: string }) {
  const { t } = useTranslation('friend');
  return (
    <UserList.Empty icon={<SearchIllustration />} title={t('search.empty.noResults', { query })} />
  );
};

FriendSearchList.Prompt = function Prompt() {
  const { t } = useTranslation('friend');
  const router = useRouter();
  const openAddFriend = useSingleTap(() => router.navigate('/friends/add'));
  return (
    <SearchScroll>
      <VStack flex={1} p={24}>
        <Result
          icon={<SearchIllustration />}
          title={t('search.empty.prompt')}
          description={t('search.empty.tagHint', { count: USER_TAG_LENGTH })}
          button={
            <Result.Button onPress={openAddFriend}>{t('search.empty.addByTag')}</Result.Button>
          }
        />
      </VStack>
    </SearchScroll>
  );
};

function SearchScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={SEARCH_CONTENT_STYLE}
      {...SEARCH_SCROLL_PROPS}
    >
      {children}
    </ScrollView>
  );
}
