import { RECURRING_TODO_LIMITS } from "@aido/api/vocabulary";

// 남은 회차는 커서에 남아 다음 회차 채우기가 이어서 만든다. 먼 과거에서 시작한 규칙이 한 트랜잭션에 몰리지 않게 한다
export const MAX_OCCURRENCES_PER_RUN = 400;

// 출시 앱의 /recurring은 366일 안의 날짜만 보내므로 새 규칙이 만드는 지난 회차가 이 상한에 닿지 않는다
export const MAX_PAST_OCCURRENCES_ON_START = RECURRING_TODO_LIMITS.MAX_DAYS_RANGE;
