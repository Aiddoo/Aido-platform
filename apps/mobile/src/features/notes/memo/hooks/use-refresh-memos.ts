import { useQueryClient } from '@tanstack/react-query';

import { refreshMemos } from '../queries/memo-cache';

export function useRefreshMemos() {
  const queryClient = useQueryClient();

  return () => refreshMemos(queryClient);
}
