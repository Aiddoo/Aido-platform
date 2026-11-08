export const STORE_REVIEW_MIN_ACTIVE_DAYS = 3;
/** iOS는 365일에 최대 3번만 시스템 창을 띄운다. 그 몫을 한 해에 고르게 나눠 쓴다 */
export const STORE_REVIEW_REQUEST_COOLDOWN_DAYS = 120;
export const STORE_REVIEW_MAX_REQUESTS_PER_WINDOW = 3;
export const STORE_REVIEW_REQUEST_WINDOW_DAYS = 365;

export const STORE_REVIEW_MOMENTS = ['all_todos_done', 'paw_print_celebration'] as const;
