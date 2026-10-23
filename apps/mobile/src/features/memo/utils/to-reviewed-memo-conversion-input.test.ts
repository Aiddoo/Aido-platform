import { convertMemoToTodosSchema } from '@aido/api';
import type { ParsedMemoTodo } from '@src/features/ai/domains/ai.model';

import { toReviewedMemoConversionInput } from './to-reviewed-memo-conversion-input';

const createTodo = (overrides: Partial<ParsedMemoTodo> = {}): ParsedMemoTodo => ({
  title: '검토한 할 일',
  categoryId: 7,
  startDate: '2026-10-13',
  endDate: null,
  scheduledTime: null,
  isAllDay: true,
  isRecurring: false,
  recurrence: null,
  items: [],
  ...overrides,
});

describe('검토한 메모의 할 일 변환 요청', () => {
  it('편집용 키를 전송하지 않고 nullable 초안을 공유 API 계약에 맞춘다', () => {
    const draft = { ...createTodo(), _key: 'todo-1' };

    const input = toReviewedMemoConversionInput([draft]);

    expect(convertMemoToTodosSchema.safeParse(input).success).toBe(true);
    expect(input.todos[0]).not.toHaveProperty('_key');
    expect(input.todos[0]?.endDate).toBeUndefined();
    expect(input.todos[0]?.scheduledTime).toBeUndefined();
    expect(input.todos[0]?.recurrence).toBeUndefined();
    expect(draft).toMatchObject({ _key: 'todo-1', endDate: null, scheduledTime: null });
  });

  it('검토한 순서와 날짜·시간·반복·하위 할 일을 보존한다', () => {
    const recurring = createTodo({
      title: '운동하기',
      isAllDay: false,
      scheduledTime: '18:30',
      isRecurring: true,
      recurrence: { daysOfWeek: ['TUE', 'THU'], endDate: '2026-10-31' },
      items: [{ title: '준비 운동' }],
    });
    const period = createTodo({ title: '여행 준비', endDate: '2026-10-15' });

    const input = toReviewedMemoConversionInput([recurring, period]);

    expect(convertMemoToTodosSchema.safeParse(input).success).toBe(true);
    expect(input.todos.map((todo) => todo.title)).toEqual(['운동하기', '여행 준비']);
    expect(input.todos[0]).toMatchObject({
      scheduledTime: '18:30',
      isAllDay: false,
      isRecurring: true,
      recurrence: recurring.recurrence,
      items: recurring.items,
      visibility: 'PUBLIC',
    });
    expect(input.todos[1]?.endDate).toBe('2026-10-15');
  });
});
