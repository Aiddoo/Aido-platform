import type { ParseTodoResponse } from '@aido/api';

const generateParseTodoResponseDto = (): ParseTodoResponse => ({
  success: true,
  data: {
    title: 'AI 파싱 결과',
    startDate: '2026-03-08',
    endDate: null,
    scheduledTime: '09:00',
    isAllDay: false,
    isRecurring: false,
    recurrence: null,
    categoryId: 1,
  },
  meta: {
    model: 'gpt-4',
    processingTimeMs: 150,
    tokenUsage: { input: 50, output: 30 },
  },
});

export const createParseTodoResponseDto = (
  overrides?: Partial<ParseTodoResponse>,
): ParseTodoResponse => ({
  ...generateParseTodoResponseDto(),
  ...overrides,
});
