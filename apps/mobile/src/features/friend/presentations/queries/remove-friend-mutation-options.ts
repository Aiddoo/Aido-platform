import { useFriendService } from '@src/bootstrap/providers/di-provider';
import type { FriendUser } from '@src/features/friend/models/friend.model';
import { unwrap } from '@src/shared/errors/result';
import type { Page } from '@src/shared/types/page.type';
import type { InfiniteData } from '@tanstack/react-query';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { partition } from 'es-toolkit';
import * as Haptics from 'expo-haptics';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';

export const removeFriendMutationOptions = () => {
  const friendService = useFriendService();
  const queryClient = useQueryClient();
  const friendsQueryKey = FRIEND_QUERY_KEYS.friends();

  type FriendsInfiniteData = InfiniteData<Page<FriendUser>, string | undefined>;

  return mutationOptions({
    mutationFn: async (userId: string) => {
      const result = await friendService.removeFriend(userId);
      return unwrap(result);
    },
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: friendsQueryKey });

      const previousData = queryClient.getQueryData<FriendsInfiniteData>(friendsQueryKey);

      queryClient.setQueryData<FriendsInfiniteData>(friendsQueryKey, (old) => {
        if (!old) return old;

        let hasRemoved = false;
        const nextPages = old.pages.map((page) => {
          const [nextItems, removedItems] = partition(page.items, (item) => item.id !== userId);

          if (removedItems.length === 0) {
            return page;
          }

          hasRemoved = true;

          return {
            ...page,
            items: nextItems,
          };
        });

        if (!hasRemoved) return old;

        return {
          ...old,
          pages: nextPages.map((page) => ({
            ...page,
            totalCount: Math.max(0, page.totalCount - 1),
          })),
        };
      });

      return { previousData };
    },
    onError: (_error, _userId, context) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (context?.previousData) {
        queryClient.setQueryData(friendsQueryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: friendsQueryKey });
    },
  });
};
