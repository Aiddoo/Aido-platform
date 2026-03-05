import { useFriendService } from '@src/bootstrap/providers/di-provider';
import type { FriendUser } from '@src/features/friend/models/friend.model';
import { unwrap } from '@src/shared/errors/result';
import type { Page } from '@src/shared/types/page.type';
import type { InfiniteData } from '@tanstack/react-query';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
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

        const exists = old.pages.some((page) => page.items.some((item) => item.id === userId));
        if (!exists) return old;

        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((item) => item.id !== userId),
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
