import { RouteSearchParamsProvider } from '@src/shared/providers/route-search-params-provider';
import type { PropsWithChildren } from 'react';

import { useFeedRouteParams } from '../../hooks/use-feed-route-params';

export function FeedRouteParamsProvider({ children }: PropsWithChildren) {
  return (
    <RouteSearchParamsProvider params={useFeedRouteParams()}>{children}</RouteSearchParamsProvider>
  );
}
