import { createParseMemoResponseDto } from '@src/features/voice/__tests__/parsed-memo.factories';

import {
  toApplyActionPlanRequest,
  toVoicePlan,
  toVoicePlanFromParsedMemo,
} from './voice-plan.mapper';

const todoDto = {
  type: 'CREATE_TODO',
  key: 't1',
  title: '헬스',
  startDate: '2026-11-05',
  endDate: null,
  scheduledTime: '19:00',
  repeat: {
    frequency: 'WEEKLY',
    interval: 1,
    weekdays: ['MON', 'WED'],
    end: { type: 'UNTIL', date: '2026-12-31' },
  },
  visibility: null,
  items: [{ title: '스트레칭' }],
  categoryId: null,
  duplicateOfTodoId: 3,
};

describe('toVoicePlan', () => {
  test('모르는 행동 타입은 버리고 아는 행동만 남긴다', () => {
    // Given
    const actions = [todoDto, { type: 'SEND_EMAIL', key: 'x' }];

    // When
    const plan = toVoicePlan('plan-1', 'quick-voice', { actions, omittedTodoCount: 2 });

    // Then
    expect(plan.actions).toHaveLength(1);
    expect(plan.omittedTodoCount).toBe(2);
  });

  test('달력 날짜는 그대로 옮기고, 반복은 앱 모델로 바꾼다', () => {
    // Given & When
    const plan = toVoicePlan('plan-1', 'quick-voice', { actions: [todoDto], omittedTodoCount: 0 });

    // Then
    expect(plan.actions[0]).toMatchObject({
      startDate: '2026-11-05',
      repeat: {
        frequency: 'WEEKLY',
        weekdays: ['MON', 'WED'],
        end: { type: 'UNTIL', date: '2026-12-31' },
      },
    });
  });
});

describe('toVoicePlanFromParsedMemo', () => {
  test('이번 주말(토·일 + 그 주 일요일까지)은 반복이 아니라 토요일 한 번이다', () => {
    // Given
    const dto = createParseMemoResponseDto();
    dto.data.todos = dto.data.todos.map((todo) => ({
      ...todo,
      startDate: '2026-11-07',
      endDate: '2026-11-08',
      isRecurring: true,
      recurrence: { daysOfWeek: ['SAT', 'SUN'], endDate: '2026-11-08' },
    }));

    // When
    const plan = toVoicePlanFromParsedMemo('plan-1', dto);

    // Then
    expect(plan.actions[0]).toMatchObject({ startDate: '2026-11-07', endDate: null, repeat: null });
  });

  test('주말 반복의 끝이 더 뒤면 그대로 반복이다', () => {
    // Given
    const dto = createParseMemoResponseDto();
    dto.data.todos = dto.data.todos.map((todo) => ({
      ...todo,
      startDate: '2026-11-07',
      isRecurring: true,
      recurrence: { daysOfWeek: ['SAT', 'SUN'], endDate: '2026-11-29' },
    }));

    // When
    const plan = toVoicePlanFromParsedMemo('plan-1', dto);

    // Then
    expect(plan.actions[0]).toMatchObject({
      repeat: { weekdays: ['SAT', 'SUN'], end: { type: 'UNTIL', date: '2026-11-29' } },
    });
  });

  test('종일 일정은 시간을 비우고 반복에는 종료일을 두지 않는다', () => {
    // Given
    const dto = createParseMemoResponseDto();
    dto.data.todos = dto.data.todos.map((todo) => ({
      ...todo,
      isRecurring: true,
      endDate: '2026-03-10',
      recurrence: { daysOfWeek: ['MON'], endDate: '2026-04-01' },
    }));

    // When
    const plan = toVoicePlanFromParsedMemo('plan-1', dto);

    // Then
    expect(plan.source).toBe('memo');
    expect(plan.actions[0]).toMatchObject({ scheduledTime: null, endDate: null });
  });

  test.each([
    { why: '서버가 겹침을 알려 주면 그 할 일을 가리킨다', duplicateOfTodoId: 41, expected: 41 },
    {
      why: '이전 서버처럼 칸이 없으면 겹치지 않은 것으로 본다',
      duplicateOfTodoId: undefined,
      expected: null,
    },
  ])('$why', ({ duplicateOfTodoId, expected }) => {
    // Given
    const dto = createParseMemoResponseDto();
    dto.data.todos = dto.data.todos.map((todo) => ({ ...todo, duplicateOfTodoId }));

    // When
    const plan = toVoicePlanFromParsedMemo('plan-1', dto);

    // Then
    expect(plan.actions[0]).toMatchObject({ duplicateOfTodoId: expected });
  });

  test('서버가 준 repeat이 있으면 격주·매월도 그대로 쓴다', () => {
    // Given
    const dto = createParseMemoResponseDto();
    dto.data.todos = dto.data.todos.map((todo) => ({
      ...todo,
      isRecurring: true,
      recurrence: { daysOfWeek: ['MON'], endDate: '2026-04-01' },
      repeat: { frequency: 'MONTHLY', monthDay: 15, end: { type: 'NEVER' } },
    }));

    // When
    const plan = toVoicePlanFromParsedMemo('plan-1', dto);

    // Then
    expect(plan.actions[0]).toMatchObject({
      repeat: { frequency: 'MONTHLY', monthDay: 15, end: { type: 'NEVER' } },
    });
  });
});

describe('toApplyActionPlanRequest', () => {
  test('카테고리를 고르지 못한 할 일은 시트의 현재 카테고리로 채운다', () => {
    // Given
    const plan = toVoicePlan('plan-1', 'quick-text', { actions: [todoDto], omittedTodoCount: 0 });

    // When
    const request = toApplyActionPlanRequest('quick-text', plan.actions, 7);

    // Then
    expect(request).toMatchObject({
      source: 'QUICK_TEXT',
      actions: [{ type: 'CREATE_TODO', categoryId: 7, startDate: '2026-11-05' }],
    });
  });
});
