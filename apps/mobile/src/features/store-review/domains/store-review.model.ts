import { dateSchema } from '@aido/api';
import { match } from 'ts-pattern';
import { z } from 'zod';

const DAY_MS = 86_400_000;

/** 하루에 할 일이 한두 개뿐인 사용자도 닿도록 완료 횟수가 아니라 할 일을 끝낸 서로 다른 날로 본다 */
export const STORE_REVIEW_MIN_ACTIVE_DAYS = 3;
/** iOS는 365일에 최대 3번만 시스템 창을 띄운다. 그 몫을 한 해에 고르게 나눠 쓴다 */
export const STORE_REVIEW_REQUEST_COOLDOWN_DAYS = 120;
export const STORE_REVIEW_MAX_REQUESTS_PER_WINDOW = 3;
export const STORE_REVIEW_REQUEST_WINDOW_DAYS = 365;

/** 판정에는 서로 다른 날이 기준 수만큼 있는지만 필요하므로 그만큼만 저장한다 */
export const STORE_REVIEW_MAX_ACTIVE_DAY_RECORDS = STORE_REVIEW_MIN_ACTIVE_DAYS;

/** 시스템 리뷰 창을 요청할 수 있는 긍정적인 순간 */
export const STORE_REVIEW_MOMENTS = ['all_todos_done', 'paw_print_celebration'] as const;
export type StoreReviewMoment = (typeof STORE_REVIEW_MOMENTS)[number];

export const storeReviewStateSchema = z.object({
  activeDays: z.array(dateSchema).max(STORE_REVIEW_MAX_ACTIVE_DAY_RECORDS),
  requestedAt: z.array(z.date()).max(STORE_REVIEW_MAX_REQUESTS_PER_WINDOW),
});
export type StoreReviewState = z.infer<typeof storeReviewStateSchema>;

export const createEmptyStoreReviewState = (): StoreReviewState => ({
  activeDays: [],
  requestedAt: [],
});

const isWithinRequestWindow = (requestedAt: Date, now: Date): boolean =>
  now.getTime() - requestedAt.getTime() < STORE_REVIEW_REQUEST_WINDOW_DAYS * DAY_MS;

const recordActiveDay = (state: StoreReviewState, localDate: string): StoreReviewState =>
  state.activeDays.includes(localDate)
    ? state
    : {
        ...state,
        activeDays: [...state.activeDays, localDate].slice(-STORE_REVIEW_MAX_ACTIVE_DAY_RECORDS),
      };

/** 창 밖으로 나간 요청은 한도 계산에 쓰이지 않으므로 지운다 */
const recordRequest = (state: StoreReviewState, at: Date): StoreReviewState => ({
  ...state,
  requestedAt: [
    ...state.requestedAt.filter((requestedAt) => isWithinRequestWindow(requestedAt, at)),
    new Date(at.getTime()),
  ].slice(-STORE_REVIEW_MAX_REQUESTS_PER_WINDOW),
});

export const StoreReviewTransitions = { recordActiveDay, recordRequest } as const;

export type StoreReviewEligibility =
  | 'eligible'
  | 'not_engaged'
  | 'cooling_down'
  | 'window_limit_reached';

const hasEnoughActiveDays = (state: StoreReviewState): boolean =>
  new Set(state.activeDays).size >= STORE_REVIEW_MIN_ACTIVE_DAYS;

const lastRequestedAt = (state: StoreReviewState): Date | undefined =>
  state.requestedAt.reduce<Date | undefined>(
    (latest, requestedAt) =>
      latest == null || requestedAt.getTime() > latest.getTime() ? requestedAt : latest,
    undefined,
  );

const isCoolingDown = (state: StoreReviewState, now: Date): boolean => {
  const latest = lastRequestedAt(state);
  return (
    latest != null && now.getTime() - latest.getTime() < STORE_REVIEW_REQUEST_COOLDOWN_DAYS * DAY_MS
  );
};

const hasReachedWindowLimit = (state: StoreReviewState, now: Date): boolean =>
  state.requestedAt.filter((requestedAt) => isWithinRequestWindow(requestedAt, now)).length >=
  STORE_REVIEW_MAX_REQUESTS_PER_WINDOW;

const evaluate = (state: StoreReviewState, now: Date): StoreReviewEligibility => {
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
};

/** 축하 화면의 애니메이션이 끝난 뒤 시스템 창이 뜨도록 순간마다 기다릴 시간 */
const settleDelayMs = (moment: StoreReviewMoment): number =>
  match(moment)
    .with('all_todos_done', () => 1_200)
    .with('paw_print_celebration', () => 1_500)
    .exhaustive();

export const StoreReviewPolicy = { evaluate, settleDelayMs } as const;
