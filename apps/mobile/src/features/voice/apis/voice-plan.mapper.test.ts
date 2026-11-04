import { createParseMemoResponseDto } from '@src/features/ai/__tests__/parsed-memo.factories';

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

  test('날짜 문자열은 로컬 날짜로, 반복은 앱 모델로 바꾼다', () => {
    // Given & When
    const plan = toVoicePlan('plan-1', 'quick-voice', { actions: [todoDto], omittedTodoCount: 0 });

    // Then
    expect(plan.actions[0]).toMatchObject({
      startDate: new Date(2026, 10, 5),
      repeat: {
        frequency: 'WEEKLY',
        weekdays: ['MON', 'WED'],
        end: { type: 'UNTIL', date: '2026-12-31' },
      },
    });
  });
});

describe('toVoicePlanFromParsedMemo', () => {
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
