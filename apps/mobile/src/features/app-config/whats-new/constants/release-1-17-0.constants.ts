import { CATEGORY_COLORS } from '@src/features/planning/category/constants/todo-category.constants';
import type { ImportCollection } from '@src/features/planning/todo-import/domains/todo-import-collection.model';

/** 소개 단계 순서. 이름은 지표 값(whats_new_step_viewed.step)이라 바꾸지 않는다 */
export const RELEASE_1_17_0_STEPS = [
  'intro',
  'chooseCalendars',
  'mapCategories',
  'importing',
  'plans',
  'finish',
] as const;

/** 휴대폰에 있는 캘린더다. 이름은 카탈로그 `v1_17_0.demo.calendars`에 있고, 공휴일은 처음에 꺼진 구독 캘린더다 */
export const DEMO_CALENDARS = [
  { id: 'personal', color: CATEGORY_COLORS[6], accountKind: 'cloud', itemCount: 12 },
  { id: 'school', color: CATEGORY_COLORS[9], accountKind: 'cloud', itemCount: 18 },
  { id: 'holidays', color: CATEGORY_COLORS[14], accountKind: 'holidays', itemCount: 9 },
] as const satisfies readonly (Pick<ImportCollection, 'color' | 'accountKind' | 'itemCount'> & {
  id: string;
})[];

/** 원래 있던 카테고리. 처음에는 고른 캘린더가 모두 여기로 간다 */
export const DEMO_EXISTING_CATEGORY = { id: 1, color: CATEGORY_COLORS[0] } as const;

/** 대본이 캘린더 이름 그대로의 새 카테고리로 바꾸는 캘린더 */
export const DEMO_NEW_CATEGORY_CALENDAR_ID =
  'school' satisfies (typeof DEMO_CALENDARS)[number]['id'];

/** 가져와 만든 할 일이다. 제목은 카탈로그 `v1_17_0.demo.todos`에 있고, 가져온 할 일은 처음에 나만 본다 */
export const DEMO_IMPORTED_TODOS = [
  { id: 'lecture', localTime: '09:30' },
  { id: 'groupMeeting', localTime: '15:00' },
  { id: 'clubDinner', localTime: '19:00' },
] as const;

export const DEMO_SCRIPT_MS = {
  calendarCheck: 600,
  categoryChange: 1_200,
  importStart: 1_400,
  importRow: 700,
} as const;
