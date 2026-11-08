import { recurringSuggestionSchema } from '@aido/api';

import { aiSuggestionSchema } from '../domains/suggestion.model';
import { toAiSuggestion } from './suggestion.mapper';

describe('toAiSuggestion', () => {
  it('계약 응답을 앱의 제안 모델로 바꾼다', () => {
    // Given
    const dto = recurringSuggestionSchema.parse({
      id: 3,
      title: '아침 운동',
      daysOfWeek: ['MON', 'WED'],
      scheduledTime: '07:00',
      confidence: 0.82,
      reason: '지난 2주 동안 월·수 아침에 했어요',
      status: 'PENDING',
      expiresAt: '2026-03-15T00:00:00.000Z',
      createdAt: '2026-03-08T00:00:00.000Z',
      suggestedCategoryId: 2,
    });

    // When
    const suggestion = toAiSuggestion(dto);

    // Then
    expect(aiSuggestionSchema.parse(suggestion)).toEqual(suggestion);
    expect(suggestion).toEqual({
      id: 3,
      title: '아침 운동',
      daysOfWeek: ['MON', 'WED'],
      scheduledTime: '07:00',
      confidence: 0.82,
      reason: '지난 2주 동안 월·수 아침에 했어요',
      expiresAt: '2026-03-15T00:00:00.000Z',
      suggestedCategoryId: 2,
    });
  });
});
