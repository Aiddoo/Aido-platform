import { toApplyActionPlanRequest, toVoicePlan } from './voice-plan.mapper';

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
  it('모르는 행동 타입은 버리고 아는 행동만 남긴다', () => {
    // Given
    const actions = [todoDto, { type: 'SEND_EMAIL', key: 'x' }];

    // When
    const plan = toVoicePlan('plan-1', 'quick-voice', { actions, omittedTodoCount: 2 });

    // Then
    expect(plan.actions).toHaveLength(1);
    expect(plan.omittedTodoCount).toBe(2);
  });

  it('달력 날짜는 그대로 옮기고, 반복은 앱 모델로 바꾼다', () => {
    // When
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

describe('toApplyActionPlanRequest', () => {
  it('카테고리를 고르지 못한 할 일은 시트의 현재 카테고리로 채운다', () => {
    // Given
    const plan = toVoicePlan('plan-1', 'quick-text', { actions: [todoDto], omittedTodoCount: 0 });

    // When
    const request = toApplyActionPlanRequest({
      source: 'quick-text',
      actions: plan.actions,
      fallbackCategoryId: 7,
      sourceMemoId: null,
    });

    // Then
    expect(request).toMatchObject({
      source: 'QUICK_TEXT',
      actions: [{ type: 'CREATE_TODO', categoryId: 7, startDate: '2026-11-05' }],
    });
  });
});
