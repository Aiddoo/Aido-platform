import { PLAN_CATALOG } from "@aido/api/vocabulary";

/** 겹침 판정에 주는 다가오는 할 일(진행 중 반복 할 일 포함) 최대 수 */
export const PLANNING_UPCOMING_TODO_LIMIT = 30;

/** 맥락에 넣는 저장된 제목 길이. 겹침·고유명사 판정에는 앞부분으로 충분하다. */
export const PLANNING_CONTEXT_TITLE_MAX_LENGTH = 80;

/** 맥락에 넣는 카테고리 최대 수. 프리미엄 개수 상한과 같고, 상한이 없는 ADMIN도 입력 상한 안에 들게 자른다. */
export const PLANNING_CATEGORY_LIMIT = PLAN_CATALOG.TODO_CATEGORY.premium;
