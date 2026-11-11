import { memoListResponseSchema, updateMemoSchema } from '@aido/api';
import type { TodoFormValues } from '@src/features/planning/todo/schemas/todo-form.schema';
import { ZodError } from 'zod';

import { createParseMemoResponseDto } from '../__tests__/parsed-memo.fixtures';
import { memoFormSchema } from '../schemas/memo-form.schema';
import {
  toConvertMemoToTodosRequest,
  toMemoPage,
  toMemoRequest,
  toMemoVoicePlan,
} from './memo.mapper';

describe('메모 페이지 응답 매핑', () => {
  it('날짜를 변환하고 다음 페이지 커서를 화면 모델로 분리한다', () => {
    // Given
    const dto = memoListResponseSchema.parse({
      items: [
        {
          id: 12,
          userId: 'clz7x5p8k0010qz0z8z8z8z8z',
          content: '장보기',
          isPinned: false,
          sortOrder: 0,
          createdAt: '2026-10-03T00:00:00Z',
          updatedAt: '2026-10-03T01:00:00Z',
        },
      ],
      pagination: { nextCursor: 12, hasNext: true, size: 20 },
    });
    // When
    const result = toMemoPage(dto);
    // Then
    expect(result.nextCursor).toBe(12);
    expect(result.items[0]?.createdAt).toBe('2026-10-03T00:00:00Z');
    expect(result.items[0]).not.toHaveProperty('userId');
  });

  it('빈 마지막 페이지는 추가 조회를 유발하는 커서를 만들지 않는다', () => {
    // Given
    const dto = memoListResponseSchema.parse({
      items: [],
      pagination: { nextCursor: 12, hasNext: false, size: 20 },
    });
    // When
    const result = toMemoPage(dto);
    // Then
    expect(result).toEqual({ items: [], nextCursor: null });
  });
});

describe('메모 작성·수정 요청', () => {
  it.each([
    ['한 글자', 'a'],
    ['최대 길이', 'a'.repeat(5000)],
  ])('폼을 통과한 %s은 서버 수정 계약도 통과한다', (_name, content) => {
    // Given
    const values = memoFormSchema.parse({ content });

    // When
    const result = updateMemoSchema.safeParse(toMemoRequest(values));

    // Then
    expect(result.success).toBe(true);
  });

  it('빈 글자와 최대 길이를 넘는 글자는 폼에서 막는다', () => {
    // Given
    const tooLong = 'a'.repeat(5001);

    // When
    const results = [
      memoFormSchema.safeParse({ content: '' }),
      memoFormSchema.safeParse({ content: tooLong }),
    ];

    // Then
    expect(results.map(({ success }) => success)).toEqual([false, false]);
  });
});

const createFormData = (overrides: Partial<TodoFormValues> = {}): TodoFormValues => ({
  title: '수정한 메모 제목',
  startDate: '2026-10-02',
  endDate: null,
  scheduledTime: null,
  isAllDay: true,
  visibility: 'PUBLIC',
  categoryId: 7,
  repeat: null,
  ...overrides,
});

describe('toConvertMemoToTodosRequest', () => {
  it('편집한 제목과 카테고리, 공개 범위를 기존 batch 계약의 한 항목으로 보낸다', () => {
    // Given
    const values = createFormData({ visibility: 'PRIVATE' });

    // When
    const input = toConvertMemoToTodosRequest(values);

    // Then
    expect(input.todos).toHaveLength(1);
    expect(input.todos[0]).toMatchObject({
      title: '수정한 메모 제목',
      categoryId: 7,
      visibility: 'PRIVATE',
      startDate: '2026-10-02',
      isRecurring: false,
    });
  });

  it('격주·매월도 빠지지 않고 repeat로 보낸다', () => {
    // Given
    const values = createFormData({
      repeat: { frequency: 'MONTHLY', monthDay: 15, end: { type: 'NEVER' } },
    });

    // When
    const input = toConvertMemoToTodosRequest(values);

    // Then
    expect(input.todos[0]?.repeat).toEqual({
      frequency: 'MONTHLY',
      monthDay: 15,
      end: { type: 'NEVER' },
    });
  });

  it('반복 기간과 요일을 유지하고 종일 일정의 남은 시간을 보내지 않는다', () => {
    // Given
    const values = createFormData({
      repeat: {
        frequency: 'WEEKLY',
        interval: 1,
        weekdays: ['MON', 'FRI'],
        end: { type: 'UNTIL', date: '2026-10-30' },
      },
      scheduledTime: '13:30',
    });

    // When
    const input = toConvertMemoToTodosRequest(values);

    // Then
    expect(input.todos[0]).toMatchObject({
      isAllDay: true,
      repeat: {
        frequency: 'WEEKLY',
        interval: 1,
        weekdays: ['MON', 'FRI'],
        end: { type: 'UNTIL', date: '2026-10-30' },
      },
    });
    expect(input.todos[0]?.scheduledTime).toBeUndefined();
  });

  it('비반복 일정의 시간과 종료 날짜를 보존하고 반복은 보내지 않는다', () => {
    // Given
    const values = createFormData({
      isAllDay: false,
      scheduledTime: '13:30',
      endDate: '2026-10-03',
    });

    // When
    const input = toConvertMemoToTodosRequest(values);

    // Then
    expect(input.todos[0]).toMatchObject({ scheduledTime: '13:30', endDate: '2026-10-03' });
    expect(input.todos[0]?.recurrence).toBeUndefined();
  });

  it('공유 계약을 넘는 제목은 전송 전에 거부한다', () => {
    // Given
    const values = createFormData({ title: 'a'.repeat(201) });

    // When
    const convert = () => toConvertMemoToTodosRequest(values);

    // Then
    expect(convert).toThrow(ZodError);
  });
});

describe('toMemoVoicePlan', () => {
  it('서버가 이번 주말을 repeat 없이 토요일 한 번으로 주면 그대로 쓴다', () => {
    // Given
    const dto = createParseMemoResponseDto();
    dto.data.todos = dto.data.todos.map((todo) => ({
      ...todo,
      startDate: '2026-11-07',
      endDate: null,
      isRecurring: false,
      repeat: null,
    }));

    // When
    const plan = toMemoVoicePlan('plan-1', dto);

    // Then
    expect(plan.actions[0]).toMatchObject({ startDate: '2026-11-07', endDate: null, repeat: null });
  });

  it('서버가 준 주말 반복은 끝이 달라도 그대로 쓴다', () => {
    // Given
    const dto = createParseMemoResponseDto();
    dto.data.todos = dto.data.todos.map((todo) => ({
      ...todo,
      startDate: '2026-11-07',
      isRecurring: true,
      repeat: {
        frequency: 'WEEKLY',
        interval: 1,
        weekdays: ['SAT', 'SUN'],
        end: { type: 'UNTIL', date: '2026-11-29' },
      },
    }));

    // When
    const plan = toMemoVoicePlan('plan-1', dto);

    // Then
    expect(plan.actions[0]).toMatchObject({
      repeat: { weekdays: ['SAT', 'SUN'], end: { type: 'UNTIL', date: '2026-11-29' } },
    });
  });

  it('종일 일정은 시간을 비우고 반복에는 종료일을 두지 않는다', () => {
    // Given
    const dto = createParseMemoResponseDto();
    dto.data.todos = dto.data.todos.map((todo) => ({
      ...todo,
      isRecurring: true,
      endDate: '2026-03-10',
      repeat: {
        frequency: 'WEEKLY',
        interval: 1,
        weekdays: ['MON'],
        end: { type: 'UNTIL', date: '2026-04-01' },
      },
    }));

    // When
    const plan = toMemoVoicePlan('plan-1', dto);

    // Then
    expect(plan.source).toBe('memo');
    expect(plan.actions[0]).toMatchObject({ scheduledTime: null, endDate: null });
  });

  it.each([
    { why: '서버가 겹침을 알려 주면 그 할 일을 가리킨다', duplicateOfTodoId: 41, expected: 41 },
    {
      why: '서버가 겹침이 없다고 하면 겹치지 않은 것으로 본다',
      duplicateOfTodoId: null,
      expected: null,
    },
  ])('$why', ({ duplicateOfTodoId, expected }) => {
    // Given
    const dto = createParseMemoResponseDto();
    dto.data.todos = dto.data.todos.map((todo) => ({ ...todo, duplicateOfTodoId }));

    // When
    const plan = toMemoVoicePlan('plan-1', dto);

    // Then
    expect(plan.actions[0]).toMatchObject({ duplicateOfTodoId: expected });
  });

  it('서버가 준 repeat은 격주·매월도 그대로 쓴다', () => {
    // Given
    const dto = createParseMemoResponseDto();
    dto.data.todos = dto.data.todos.map((todo) => ({
      ...todo,
      isRecurring: true,
      repeat: { frequency: 'MONTHLY', monthDay: 15, end: { type: 'NEVER' } },
    }));

    // When
    const plan = toMemoVoicePlan('plan-1', dto);

    // Then
    expect(plan.actions[0]).toMatchObject({
      repeat: { frequency: 'MONTHLY', monthDay: 15, end: { type: 'NEVER' } },
    });
  });
});
