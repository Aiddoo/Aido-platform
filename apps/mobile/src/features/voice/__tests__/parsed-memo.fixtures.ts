import type { ParseMemoResponse } from '@aido/api';

const generateParseMemoResponseDto = (): ParseMemoResponse => ({
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
        categoryId: 1,
        items: [{ title: '슬라이드' }],
      },
    ],
  },
  meta: {
    model: 'gemini',
    processingTimeMs: 150,
    tokenUsage: { input: 50, output: 30 },
  },
});

export const createParseMemoResponseDto = (
  overrides?: Partial<ParseMemoResponse>,
): ParseMemoResponse => ({
  ...generateParseMemoResponseDto(),
  ...overrides,
});
