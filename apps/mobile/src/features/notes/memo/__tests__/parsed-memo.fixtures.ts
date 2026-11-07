import type { ParseMemoPlanResponse } from '../schemas/memo.schema';

const generateParseMemoResponseDto = (): ParseMemoPlanResponse => ({
  success: true,
  data: {
    todos: [
      {
        title: '발표 준비',
        startDate: '2026-03-08',
        endDate: null,
        scheduledTime: null,
        isAllDay: true,
        isRecurring: false,
        recurrence: null,
        repeat: null,
        duplicateOfTodoId: null,
        categoryId: 1,
        items: [{ title: '슬라이드' }],
      },
    ],
  },
  meta: {
    model: 'gemini',
    processingTimeMs: 150,
    tokenUsage: { input: 50, output: 30 },
    omittedTodoCount: 0,
  },
});

export const createParseMemoResponseDto = (
  overrides?: Partial<ParseMemoPlanResponse>,
): ParseMemoPlanResponse => ({
  ...generateParseMemoResponseDto(),
  ...overrides,
});
