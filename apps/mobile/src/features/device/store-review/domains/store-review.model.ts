import { DAY_MS } from '@src/shared/constants/time-units';
import { type Instant, diffMs, toEpochMs } from '@src/shared/date/instant';
import { maxBy } from 'es-toolkit';

import {
  STORE_REVIEW_MAX_REQUESTS_PER_WINDOW,
  STORE_REVIEW_MIN_ACTIVE_DAYS,
  STORE_REVIEW_REQUEST_COOLDOWN_DAYS,
  STORE_REVIEW_REQUEST_WINDOW_DAYS,
} from '../constants/store-review.constants';
import type { StoreReviewState } from '../schemas/store-review.schema';

export type StoreReviewEligibility =
  | 'eligible'
  | 'not_engaged'
  | 'cooling_down'
  | 'window_limit_reached';

function createEmptyState(): StoreReviewState {
  return { activeDays: [], requestedAt: [] };
}

function isWithinRequestWindow(requestedAt: Instant, now: Instant) {
  return diffMs(now, requestedAt) < STORE_REVIEW_REQUEST_WINDOW_DAYS * DAY_MS;
}

/** 할 일을 하나라도 끝낸 날을 남긴다. 같은 날은 한 번만 센다 */
function withActiveDay(state: StoreReviewState, localDate: string): StoreReviewState {
  return state.activeDays.includes(localDate)
    ? state
    : {
        ...state,
        activeDays: [...state.activeDays, localDate].slice(-STORE_REVIEW_MIN_ACTIVE_DAYS),
      };
}

/** 창 밖으로 나간 요청은 한도 계산에 쓰이지 않으므로 지운다 */
function withRequest(state: StoreReviewState, at: Instant): StoreReviewState {
  return {
    ...state,
    requestedAt: [
      ...state.requestedAt.filter((requestedAt) => isWithinRequestWindow(requestedAt, at)),
      at,
    ].slice(-STORE_REVIEW_MAX_REQUESTS_PER_WINDOW),
  };
}

function hasEnoughActiveDays(state: Pick<StoreReviewState, 'activeDays'>) {
  return new Set(state.activeDays).size >= STORE_REVIEW_MIN_ACTIVE_DAYS;
}

function getLastRequestedAt(state: Pick<StoreReviewState, 'requestedAt'>) {
  return maxBy(state.requestedAt, toEpochMs);
}

function isCoolingDown(state: Pick<StoreReviewState, 'requestedAt'>, now: Instant) {
  const latest = getLastRequestedAt(state);

  return latest != null && diffMs(now, latest) < STORE_REVIEW_REQUEST_COOLDOWN_DAYS * DAY_MS;
}

function hasReachedWindowLimit(state: Pick<StoreReviewState, 'requestedAt'>, now: Instant) {
  return (
    state.requestedAt.filter((requestedAt) => isWithinRequestWindow(requestedAt, now)).length >=
    STORE_REVIEW_MAX_REQUESTS_PER_WINDOW
  );
}

/** 지금 OS 리뷰 창을 요청해도 되는지. 끝낸 날, 365일 한도, 120일 쿨다운 순으로 막는다 */
function getEligibility(state: StoreReviewState, now: Instant): StoreReviewEligibility {
  if (!hasEnoughActiveDays(state)) {
    return 'not_engaged';
  }
  if (hasReachedWindowLimit(state, now)) {
    return 'window_limit_reached';
  }
  if (isCoolingDown(state, now)) {
    return 'cooling_down';
  }
  return 'eligible';
}

export const StoreReviewPolicy = {
  createEmptyState,
  withActiveDay,
  withRequest,
  getEligibility,
} as const;
