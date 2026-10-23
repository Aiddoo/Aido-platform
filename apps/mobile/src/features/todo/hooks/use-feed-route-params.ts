import { usePathname, useGlobalSearchParams, type UnknownOutputParams } from 'expo-router';
import { useState } from 'react';

import { isFeedPathname } from '../utils/feed-route';

const NO_FEED_PARAMS: UnknownOutputParams = {};

/** global params는 피드가 가려져도 앞 화면을 따라 바뀌므로, 가려진 동안에는 마지막 피드 params를 유지한다. */
export function useFeedRouteParams(): UnknownOutputParams {
  const isFeedInFront = isFeedPathname(usePathname());
  const globalParams = useGlobalSearchParams();
  const [lastFeedParams, setLastFeedParams] = useState(
    isFeedInFront ? globalParams : NO_FEED_PARAMS,
  );

  if (isFeedInFront && lastFeedParams !== globalParams) {
    setLastFeedParams(globalParams);
  }

  return isFeedInFront ? globalParams : lastFeedParams;
}
