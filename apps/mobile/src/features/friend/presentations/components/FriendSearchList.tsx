import { formatUserHashtag } from '@src/features/user/utils/user-hashtag';
import { useTranslation } from '@src/shared/i18n';
import type { Page } from '@src/shared/types/page.type';
import { Button, CheckIcon, Result, SearchIcon } from '@src/shared/ui';
import {
  type InfiniteData,
  useMutation,
  useQueryClient,
  useSuspenseInfiniteQuery,
} from '@tanstack/react-query';
import type { SearchedUser } from '../../models/friend.model';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';
import { useCancelRequestMutationOptions } from '../queries/use-cancel-request-mutation-options';
import { useSearchUsersQueryOptions } from '../queries/use-search-users-query-options';
import { useSendRequestByTagMutationOptions } from '../queries/use-send-request-by-tag-mutation-options';
import type { SearchedUserViewModel } from '../view-models/searched-user.view-model';
import { UserList } from './UserList';

interface FriendSearchListProps {
  /** 검색어 (2자 이상, 상위 화면에서 유효성 보장 후 마운트) */
  query: string;
}

/**
 * 사용자 검색 결과 리스트.
 * Suspense 쿼리로 데이터를 받아 각 행에 추가/요청취소/친구 액션을 노출한다.
 * 추가·취소는 낙관적으로 해당 행만 전환하고(전체 refetch 없음), 실패 시 뮤테이션이 롤백/토스트를 담당한다.
 */
export function FriendSearchList({ query }: FriendSearchListProps) {
  const { t } = useTranslation('friend');
  const queryClient = useQueryClient();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    useSearchUsersQueryOptions(query),
  );
  const sendRequest = useMutation(useSendRequestByTagMutationOptions());
  const cancelRequest = useMutation(useCancelRequestMutationOptions());

  const items = data.pages.flatMap((page) => page.items);

  // 검색 캐시에서 해당 사용자 한 명의 관계 flag만 낙관적으로 전환 (버튼 즉시 반영)
  const patchUser = (userTag: string, patch: Partial<SearchedUser>) => {
    queryClient.setQueryData<InfiniteData<Page<SearchedUser>>>(
      FRIEND_QUERY_KEYS.search(query),
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

  const renderAction = (user: SearchedUserViewModel) => {
    if (user.actionState === 'friend') {
      // 이미 친구: 액션 버튼 대신 은은한 연결 표시 (인스타처럼 버튼을 노출하지 않음)
      return <CheckIcon width={20} height={20} colorClassName="text-gray-4" />;
    }

    if (user.actionState === 'pending') {
      // 요청 대기: 취소 가능한 danger 버튼
      return (
        <Button
          variant="weak"
          color="danger"
          size="small"
          display="inline"
          disabled={cancelRequest.isPending && cancelRequest.variables === user.id}
          onPress={() => handleCancel(user)}
        >
          {t('search.action.cancel')}
        </Button>
      );
    }

    // 미연결: 주 CTA로 추가
    return (
      <Button
        variant="fill"
        color="primary"
        size="small"
        display="inline"
        disabled={sendRequest.isPending && sendRequest.variables === user.userTag}
        onPress={() => handleAdd(user)}
      >
        {t('search.action.add')}
      </Button>
    );
  };

  return (
    <UserList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={(item: SearchedUserViewModel) => (
        <UserList.Item
          displayName={item.displayName}
          subtitle={formatUserHashtag(item.userTag)}
          profileImage={item.profileImage}
          action={renderAction(item)}
        />
      )}
      emptyContent={
        <Result
          icon={<SearchIcon width={64} height={64} colorClassName="text-gray-4" />}
          title={t('search.empty.noResults', { query })}
        />
      }
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onEndReached={fetchNextPage}
    />
  );
}

FriendSearchList.Loading = function Loading() {
  return <UserList.Loading />;
};
