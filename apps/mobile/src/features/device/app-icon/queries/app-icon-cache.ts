import type { QueryClient } from '@tanstack/react-query';

import type { AppIconKey } from '../domains/app-icon.model';
import { APP_ICON_QUERY_KEYS } from './app-icon-query-keys';

export function cancelAppIcon(queryClient: QueryClient) {
  return queryClient.cancelQueries({ queryKey: APP_ICON_QUERY_KEYS.current() });
}

/** OS가 바꿨다고 확정한 아이콘을 쓴다 */
export function setAppIconInCache(queryClient: QueryClient, key: AppIconKey) {
  queryClient.setQueryData(APP_ICON_QUERY_KEYS.current(), key);
}
