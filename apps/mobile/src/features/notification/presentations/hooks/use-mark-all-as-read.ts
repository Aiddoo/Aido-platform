import { useMutation } from '@tanstack/react-query';

import { markAllAsReadMutationOptions } from '../queries/mark-all-as-read-mutation-options';

/**
 * Hook to mark all notifications as read
 */
export const useMarkAllAsRead = () => {
  const options = markAllAsReadMutationOptions();
  const mutation = useMutation(options);

  return {
    markAllAsRead: mutation.mutate,
    markAllAsReadAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
};
