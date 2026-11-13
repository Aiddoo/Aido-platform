import { DAY_MS } from '@src/shared/constants/time-units';
import { dateKeySchema, type DateKey } from '@src/shared/date/date-key';
import { type Instant, diffMs, instantSchema, toEpochMs } from '@src/shared/date/instant';
import { maxBy, uniq } from 'es-toolkit';
import { z } from 'zod';

/** 하루 한두 개만 끝내는 사용자도 닿도록 완료 횟수가 아니라 서로 다른 날을 세고, 저장도 이 수까지만 한다 */
const STORE_REVIEW_MIN_ACTIVE_DAYS = 3;
/** iOS는 365일에 최대 3번만 시스템 창을 띄운다. 그 몫을 한 해에 고르게 나눠 쓴다 */
const STORE_REVIEW_REQUEST_COOLDOWN_DAYS = 120;
const STORE_REVIEW_MAX_REQUESTS_PER_WINDOW = 3;
const STORE_REVIEW_REQUEST_WINDOW_DAYS = 365;

const storeReviewMomentSchema = z.enum(['all_todos_done', 'paw_print_celebration']);
export type StoreReviewMoment = z.infer<typeof storeReviewMomentSchema>;

export const storeReviewStateSchema = z.object({
  activeDays: z.array(dateKeySchema).max(STORE_REVIEW_MIN_ACTIVE_DAYS),
  requestedAt: z.array(instantSchema).max(STORE_REVIEW_MAX_REQUESTS_PER_WINDOW),
});
export type StoreReviewState = z.infer<typeof storeReviewStateSchema>;

export type StoreReviewEligibility =
  | 'eligible'
  | 'not_engaged'
  | 'cooling_down'
  | 'window_limit_reached';

export function createEmptyStoreReviewState(): StoreReviewState {
  return { activeDays: [], requestedAt: [] };
}

function isWithinRequestWindow(requestedAt: Instant, now: Instant) {
  return diffMs(now, requestedAt) < STORE_REVIEW_REQUEST_WINDOW_DAYS * DAY_MS;
}

/** 할 일을 끝낸 날들을 차례로 더한다. 같은 날은 한 번만 세고 마지막 날들만 남긴다 */
function withActiveDays(state: StoreReviewState, localDates: readonly DateKey[]): StoreReviewState {
  return {
    ...state,
    activeDays: uniq([...state.activeDays, ...localDates]).slice(-STORE_REVIEW_MIN_ACTIVE_DAYS),
  };
}

/** 할 일을 하나라도 끝낸 날을 남긴다. 같은 날은 한 번만 센다 */
function withActiveDay(state: StoreReviewState, localDate: DateKey): StoreReviewState {
  return state.activeDays.includes(localDate) ? state : withActiveDays(state, [localDate]);
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
  return uniq(state.activeDays).length >= STORE_REVIEW_MIN_ACTIVE_DAYS;
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
  withActiveDays,
  withActiveDay,
  withRequest,
  getEligibility,
} as const;
