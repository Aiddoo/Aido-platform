import { dateKeySchema } from '@src/shared/date/date-key';

import { createTodoImportSelection } from '../__tests__/todo-import.fixtures';
import { TodoImportSelectionPolicy } from './todo-import-selection.model';

describe('TodoImportSelectionPolicy', () => {
  describe('findAdjustedToToday', () => {
    it('기기 오늘이 넘어갔으면 오늘부터 같은 마지막 날까지로 맞춘다', () => {
      // Given
      const selection = createTodoImportSelection();

      // When
      const adjusted = TodoImportSelectionPolicy.findAdjustedToToday(
        selection,
        dateKeySchema.parse('2026-11-25'),
      );

      // Then
      expect(adjusted).toMatchObject({ startDate: '2026-11-25', endDate: '2026-12-23' });
    });

    it('기기 오늘이 그대로면 맞출 수 없다', () => {
      // When
      const adjusted = TodoImportSelectionPolicy.findAdjustedToToday(
        createTodoImportSelection(),
        dateKeySchema.parse('2026-11-24'),
      );

      // Then
      expect(adjusted).toBeNull();
    });
  });
});
