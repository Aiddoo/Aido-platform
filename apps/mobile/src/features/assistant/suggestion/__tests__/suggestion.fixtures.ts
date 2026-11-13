import { recurringSuggestionSchema } from '@aido/api';
import { defineFixture } from '@src/testing/fixture';

export const createSuggestionDto = defineFixture(recurringSuggestionSchema, {
  id: 1,
  title: '아침 스트레칭',
  daysOfWeek: ['MON', 'WED'],
  scheduledTime: '07:30',
  confidence: 0.82,
  reason: '최근 3주 동안 월·수 아침에 스트레칭을 했어요',
  status: 'PENDING',
  expiresAt: '2026-11-20T00:00:00.000Z',
  createdAt: '2026-11-12T00:00:00.000Z',
  suggestedCategoryId: null,
});
