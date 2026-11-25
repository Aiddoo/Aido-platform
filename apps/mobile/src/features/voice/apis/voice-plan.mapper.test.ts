import { ACTION_PLAN_LIMITS } from '@aido/api/vocabulary';
import { range } from 'es-toolkit';

import { createSpokenVoiceNote, createVoiceNoteSentence } from '../__tests__/voice-note.fixtures';
import { toApplyActionPlanRequest, toVoiceNoteDigestInput, toVoicePlan } from './voice-plan.mapper';

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

describe('toVoiceNoteDigestInput', () => {
  it('문장을 글자와 시각 구간으로 만들고 길이는 초로 보낸다', () => {
    // Given
    const note = createSpokenVoiceNote({
      durationMs: 178_400,
      sentences: [
        createVoiceNoteSentence({ text: '첫 문장.', startMs: 0, endMs: 2_000 }),
        createVoiceNoteSentence({ text: '   ', startMs: 2_000, endMs: 3_000 }),
        createVoiceNoteSentence({
          text: '둘째 문장.',
          startMs: 3_000,
          endMs: 5_000,
          isBookmarked: true,
        }),
      ],
    });

    // When
    const input = toVoiceNoteDigestInput(note);

    // Then
    expect(input).toEqual({
      text: '첫 문장. 둘째 문장.',
      durationSeconds: 178,
      segments: [
        { startMs: 0, text: '첫 문장.', isBookmarked: false },
        { startMs: 3_000, text: '둘째 문장.', isBookmarked: true },
      ],
    });
  });

  it('문장이 서버 상한을 넘으면 이웃끼리 묶어 상한 안에 넣고 깃발은 남긴다', () => {
    // Given
    const sentences = range(1_000).map((index) =>
      createVoiceNoteSentence({
        text: `문장 ${index}`,
        startMs: index * 1_000,
        endMs: index * 1_000 + 1_000,
        isBookmarked: index === 1,
      }),
    );
    const note = createSpokenVoiceNote({ sentences });

    // When
    const { segments } = toVoiceNoteDigestInput(note);

    // Then
    expect(segments.length).toBeLessThanOrEqual(ACTION_PLAN_LIMITS.DIGEST_MAX_SEGMENTS);
    expect(segments[0]).toEqual({ startMs: 0, text: '문장 0 문장 1', isBookmarked: true });
  });
});
