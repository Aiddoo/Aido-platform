import { useClipboard } from '@src/bootstrap/providers/di-context';
import type { ClipboardGateway } from '@src/core/ports/clipboard';
import { queryOptions } from '@tanstack/react-query';

import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';

// 화면에 들어올 때마다 다시 확인하고, 떠나면 남기지 않는다
export function getClipboardPresenceQueryOptions(clipboard: ClipboardGateway) {
  return queryOptions({
    queryKey: INVITE_QUERY_KEYS.clipboardPresence(),
    queryFn: () => clipboard.hasString(),
    staleTime: 0,
    gcTime: 0,
  });
}

export function useGetClipboardPresenceQueryOptions() {
  return getClipboardPresenceQueryOptions(useClipboard());
}
