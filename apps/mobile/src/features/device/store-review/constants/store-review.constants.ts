/**
 * 하루에 할 일이 한두 개뿐인 사용자도 닿도록 완료 횟수가 아니라 할 일을 끝낸 서로 다른 날로 본다.
 * 판정에는 서로 다른 날이 이 수만큼 있는지만 필요해 저장하는 날도 이 수까지다
 */
export const STORE_REVIEW_MIN_ACTIVE_DAYS = 3;
/** iOS는 365일에 최대 3번만 시스템 창을 띄운다. 그 몫을 한 해에 고르게 나눠 쓴다 */
export const STORE_REVIEW_REQUEST_COOLDOWN_DAYS = 120;
export const STORE_REVIEW_MAX_REQUESTS_PER_WINDOW = 3;
export const STORE_REVIEW_REQUEST_WINDOW_DAYS = 365;

/** 시스템 리뷰 창을 요청할 수 있는 긍정적인 순간 */
export const STORE_REVIEW_MOMENTS = ['all_todos_done', 'paw_print_celebration'] as const;
