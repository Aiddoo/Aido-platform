import type { AddTodoFormInput } from '../schemas/add-todo-form.schema';
import { toMemoConversionInput } from './to-memo-conversion-input';

const createFormData = (overrides: Partial<AddTodoFormInput> = {}): AddTodoFormInput => ({
  title: '수정한 메모 제목',
  startDate: new Date(2026, 9, 2),
  endDate: null,
  scheduledTime: null,
  isAllDay: true,
  visibility: 'PUBLIC',
  categoryId: 7,
  isRecurring: false,
  repeatEndDate: null,
  daysOfWeek: [],
  source: 'manual',
  ...overrides,
});

describe('toMemoConversionInput', () => {
  it('편집한 제목과 카테고리, 공개 범위를 기존 batch 계약의 한 항목으로 보낸다', () => {
    const input = toMemoConversionInput(createFormData({ visibility: 'PRIVATE' }));

    expect(input.todos).toHaveLength(1);
    expect(input.todos[0]).toMatchObject({
      title: '수정한 메모 제목',
      categoryId: 7,
      visibility: 'PRIVATE',
      startDate: '2026-10-02',
      isRecurring: false,
    });
  });

  it('반복 기간과 요일을 유지하고 종일 일정의 남은 시간을 보내지 않는다', () => {
    const input = toMemoConversionInput(
      createFormData({
        isRecurring: true,
        repeatEndDate: new Date(2026, 9, 30),
        daysOfWeek: ['MON', 'FRI'],
        scheduledTime: '13:30',
      }),
    );

    expect(input.todos[0]).toMatchObject({
      isAllDay: true,
      isRecurring: true,
      recurrence: { daysOfWeek: ['MON', 'FRI'], endDate: '2026-10-30' },
    });
    expect(input.todos[0]?.scheduledTime).toBeUndefined();
  });

  it('비반복 일정의 시간과 종료 날짜를 보존하고 이전 반복 초안은 보내지 않는다', () => {
    const input = toMemoConversionInput(
      createFormData({
        isAllDay: false,
        scheduledTime: '13:30',
        endDate: new Date(2026, 9, 3),
        daysOfWeek: ['MON'],
        repeatEndDate: new Date(2026, 9, 30),
      }),
    );

    expect(input.todos[0]).toMatchObject({ scheduledTime: '13:30', endDate: '2026-10-03' });
    expect(input.todos[0]?.recurrence).toBeUndefined();
  });

  it('공유 계약을 넘는 제목은 전송 전에 거부한다', () => {
    expect(() => toMemoConversionInput(createFormData({ title: 'a'.repeat(201) }))).toThrow();
  });
});
