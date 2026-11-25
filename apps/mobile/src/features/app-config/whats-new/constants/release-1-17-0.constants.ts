import { CATEGORY_COLORS } from '@src/features/planning/category/constants/todo-category.constants';
import type { TodoImportCollection } from '@src/features/planning/todo-import/domains/todo-import-collection.model';

/** 소개 단계 순서. 이름은 지표 값(whats_new_step_viewed.step)이라 바꾸지 않는다 */
export const RELEASE_1_17_0_STEPS = [
  'intro',
  'chooseCalendars',
  'mapCategories',
  'importing',
  'plans',
  'finish',
] as const;

/** 이름은 카탈로그 `v1_17_0.demo.calendars`에 있다. 공휴일은 기본 선택에서 빠진다 */
export const DEMO_CALENDARS = [
  { id: 'personal', color: CATEGORY_COLORS[6], accountKind: 'cloud', itemCount: 12 },
  { id: 'school', color: CATEGORY_COLORS[9], accountKind: 'cloud', itemCount: 18 },
  { id: 'holidays', color: CATEGORY_COLORS[14], accountKind: 'holidays', itemCount: 9 },
] as const satisfies readonly (Pick<TodoImportCollection, 'color' | 'accountKind' | 'itemCount'> & {
  id: string;
})[];

/** 이름은 카탈로그 `v1_17_0.demo.categories`에 있다. 첫 카테고리가 처음 넣을 곳이고 잠시 뒤 둘째로 바뀐다 */
export const DEMO_CATEGORIES = [
  { id: 1, key: 'daily', color: CATEGORY_COLORS[0], activeCount: 48 },
  { id: 2, key: 'study', color: CATEGORY_COLORS[9], activeCount: 12 },
] as const;

/** 제목은 카탈로그 `v1_17_0.demo.todos`에 있다 */
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
