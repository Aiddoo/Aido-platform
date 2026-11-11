import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
} from '@src/features/planning/category/constants/todo-category.constants';
import type { TodoRepeat } from '@src/features/planning/todo/domains/todo-repeat.model';

export const DEMO_CATEGORIES = [
  { id: 'exercise', color: CATEGORY_COLORS[6] },
  { id: 'daily', color: DEFAULT_CATEGORY_COLOR },
  { id: 'work', color: CATEGORY_COLORS[9] },
] as const;

const WORKOUT_REPEAT: TodoRepeat = {
  frequency: 'WEEKLY',
  interval: 1,
  weekdays: ['MON', 'WED', 'FRI'],
  end: { type: 'NEVER' },
};
const DAILY_REPEAT: TodoRepeat = { frequency: 'DAILY', end: { type: 'NEVER' } };

/** 받아쓰기 문장 하나에서 나온 할 일이다. 날짜는 오늘부터 며칠 뒤인지, 시각이 없으면 종일이다 */
export const DEMO_PLANNED_TODOS = [
  {
    id: 'workout',
    categoryId: 'exercise',
    daysFromToday: 0,
    scheduledTime: '07:00',
    repeat: WORKOUT_REPEAT,
    visibility: 'PUBLIC',
    itemIds: [],
  },
  {
    id: 'dentist',
    categoryId: 'daily',
    daysFromToday: 1,
    scheduledTime: '15:00',
    repeat: null,
    visibility: 'PRIVATE',
    itemIds: [],
  },
  {
    id: 'report',
    categoryId: 'work',
    daysFromToday: 7,
    scheduledTime: null,
    repeat: null,
    visibility: 'PUBLIC',
    itemIds: ['research', 'draft'],
  },
] as const;

/** 목록 장면에 원래 있던 할 일 */
export const DEMO_EXISTING_TODO = {
  id: 'water',
  categoryId: 'daily',
  daysFromToday: 0,
  scheduledTime: null,
  repeat: DAILY_REPEAT,
  visibility: 'PUBLIC',
  itemIds: [],
} as const;

export const DEMO_WAVEFORM_LEVELS = [
  0.2, 0.5, 0.8, 0.6, 0.9, 0.4, 0.15, 0.3, 0.7, 1, 0.75, 0.5, 0.25, 0.1, 0.45, 0.85, 0.6, 0.35, 0.7,
  0.55, 0.2, 0.4, 0.9, 0.65, 0.3, 0.15, 0.5, 0.8,
] as const;

/** 글자는 실제 말보다 빠르게 보여 주고 시계는 말 속도로 센다 */
export const DEMO_SCRIPT = {
  startDelayMs: 400,
  wordMs: 140,
  spokenMsPerWord: 450,
  rowMs: 320,
  sentenceMs: 900,
  digestStepMs: 700,
} as const;
