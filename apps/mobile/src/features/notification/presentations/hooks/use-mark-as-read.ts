import { useMutation } from '@tanstack/react-query';

import { markAsReadMutationOptions } from '../queries/mark-as-read-mutation-options';

/**
 * Hook to mark a single notification as read
 */
export const useMarkAsRead = () => {
  const options = markAsReadMutationOptions();
  const mutation = useMutation(options);

  return {
    markAsRead: mutation.mutate,
    markAsReadAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
};
