import { createSuggestionDto } from '../__tests__/suggestion.fixtures';
import { toAiSuggestion } from '../apis/suggestion.mapper';
import { AiSuggestionPolicy } from './suggestion.model';

describe('AiSuggestionPolicy', () => {
  describe('getTodoRepeat', () => {
    it.each([
      { daysOfWeek: ['MON', 'WED'] },
      { daysOfWeek: ['SUN'] },
      { daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] },
    ] as const)('$daysOfWeek 제안은 그 요일마다 끝없이 매주 반복한다', ({ daysOfWeek }) => {
      // Given
      const suggestion = toAiSuggestion(createSuggestionDto({ daysOfWeek: [...daysOfWeek] }));

      // When
      const repeat = AiSuggestionPolicy.getTodoRepeat(suggestion);

      // Then
      expect(repeat).toEqual({
        frequency: 'WEEKLY',
        interval: 1,
        weekdays: daysOfWeek,
        end: { type: 'NEVER' },
      });
    });
  });
});
