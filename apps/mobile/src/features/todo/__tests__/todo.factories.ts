import type {
  AiUsageResponse,
  DailyCompletionsRangeResponse,
  ParseTodoResponse,
  Todo,
  TodoItemResponse,
  TodoListResponse,
} from '@aido/validators';
import { ApiError } from '@src/shared/errors/api-error';

const generateTodoDto = (): Todo => ({
  id: 1,
  userId: 'clz7x5p8k0010qz0z8z8z8z8z',
  title: '테스트 할일',
  sortOrder: 0,
  startDate: '2026-03-08',
  endDate: null,
  category: { id: 1, name: '기본', color: '#3B82F6', sortOrder: 0 },
  completed: false,
  completedAt: null,
  scheduledTime: '2026-03-08T09:00:00.000Z',
  isAllDay: false,
  visibility: 'PUBLIC',
  recurrenceGroupId: null,
  items: [],
  itemStats: { total: 0, completed: 0 },
  commentCount: 0,
  createdAt: '2026-03-08T00:00:00.000Z',
  updatedAt: '2026-03-08T00:00:00.000Z',
});

export const createTodoDto = (overrides?: Partial<Todo>): Todo => ({
  ...generateTodoDto(),
  ...overrides,
});

const generateTodoListResponseDto = (): TodoListResponse => ({
  items: [generateTodoDto()],
  pagination: {
    hasNext: false,
    nextCursor: null,
    size: 20,
  },
});

export const createTodoListResponseDto = (
  overrides?: Partial<TodoListResponse>,
): TodoListResponse => ({
  ...generateTodoListResponseDto(),
  ...overrides,
});

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

const generateAiUsageResponseDto = (): AiUsageResponse => ({
  success: true,
  data: {
    used: 3,
    limit: 10,
    resetsAt: '2026-03-09T00:00:00.000Z',
  },
});

export const createAiUsageResponseDto = (
  overrides?: Partial<AiUsageResponse>,
): AiUsageResponse => ({
  ...generateAiUsageResponseDto(),
  ...overrides,
});

const generateDailyCompletionsDto = (): DailyCompletionsRangeResponse => ({
  completions: [
    {
      date: '2026-03-01',
      totalTodos: 5,
      completedTodos: 3,
      isComplete: false,
      completionRate: 60,
      categoryColors: ['#FF6B43'],
    },
  ],
  totalCompleteDays: 1,
  dateRange: {
    startDate: '2026-03-01',
    endDate: '2026-03-31',
  },
});

export const createDailyCompletionsDto = (
  overrides?: Partial<DailyCompletionsRangeResponse>,
): DailyCompletionsRangeResponse => ({
  ...generateDailyCompletionsDto(),
  ...overrides,
});

const generateTodoItemResponseDto = (): TodoItemResponse => ({
  id: 1,
  title: '테스트 항목',
  completed: false,
  sortOrder: 0,
  createdAt: '2026-03-08T00:00:00.000Z',
  updatedAt: '2026-03-08T00:00:00.000Z',
});

export const createTodoItemResponseDto = (
  overrides?: Partial<TodoItemResponse>,
): TodoItemResponse => ({
  ...generateTodoItemResponseDto(),
  ...overrides,
});

export const createTodoApiError = (
  overrides?: Partial<{ code: string; message: string; status: number }>,
) =>
  new ApiError(
    overrides?.code ?? 'TODO_0801',
    overrides?.message ?? '할일을 찾을 수 없어요',
    overrides?.status ?? 400,
  );

export const INVALID_DTO = { invalid: 'data' };
