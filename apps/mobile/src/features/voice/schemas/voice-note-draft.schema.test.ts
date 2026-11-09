import { createSpokenVoiceNote, createVoiceNoteDigest } from '../__tests__/voice-note.fixtures';
import { VoiceNotePolicy } from '../domains/voice-note.model';
import { voicePlanSchema } from '../domains/voice-plan.model';
import { createPlanReviewDraft } from '../utils/plan-review-draft';
import { createVoiceNoteDraftSchema } from './voice-note-draft.schema';

const createPlannedTodo = (actionId: string, title: string) => ({
  type: 'create-todo',
  actionId,
  title,
  startDate: '2026-11-05',
  endDate: null,
  scheduledTime: null,
  repeat: null,
  visibility: null,
  items: [],
  categoryId: null,
  duplicateOfTodoId: null,
});

const voiceNoteDraftSchema = createVoiceNoteDraftSchema('Asia/Seoul');

describe('createVoiceNoteDraftSchema', () => {
  const plan = voicePlanSchema.parse({
    planId: 'draft-1',
    source: 'voice-note',
    sourceMemoId: null,
    omittedTodoCount: 0,
    actions: [
      {
        type: 'create-todo',
        actionId: 'a1',
        title: '시안 받기',
        startDate: '2026-11-06',
        endDate: null,
        scheduledTime: null,
        repeat: null,
        visibility: null,
        items: [],
        categoryId: 1,
        duplicateOfTodoId: null,
      },
    ],
  });

  it('저장한 순간은 ISO 문자열로 남고 읽으면 Date로 돌아온다', () => {
    // Given
    const note = createSpokenVoiceNote({ digest: createVoiceNoteDigest() });

    // When
    const stored = voiceNoteDraftSchema.encode(note);
    const restored = voiceNoteDraftSchema.decode(JSON.parse(JSON.stringify(stored)));

    // Then
    expect(stored.createdAt).toBe('2026-11-01T00:00:00.000Z');
    expect(restored).toEqual(note);
  });

  it('고친 카드까지 저장했다가 달력 날짜를 그대로 되살린다', () => {
    // Given
    const note = createSpokenVoiceNote({
      planDraft: createPlanReviewDraft(plan),
    });

    // When
    const stored = JSON.parse(JSON.stringify(voiceNoteDraftSchema.encode(note)));
    const restored = voiceNoteDraftSchema.decode(stored);

    // Then
    const [action] = restored.planDraft?.form.actions ?? [];
    expect(action?.type === 'create-todo' && action.startDate).toBe('2026-11-06');
  });

  it('검토 초안이 깨졌으면 글자는 살리고 그 칸만 비운다', () => {
    // Given
    const note = createSpokenVoiceNote();
    const stored = JSON.parse(JSON.stringify(voiceNoteDraftSchema.encode(note)));

    // When
    const restored = voiceNoteDraftSchema.decode({ ...stored, planDraft: { form: 'broken' } });

    // Then
    expect(restored.planDraft).toBeNull();
    expect(restored.sentences).toHaveLength(1);
  });

  it('저장된 초안에 제목이 빈 카드가 있어도 나머지 카드를 살리고 못 살린 수를 남긴다', () => {
    // Given
    const plan = voicePlanSchema.parse({
      planId: 'draft-1',
      source: 'voice-note',
      sourceMemoId: null,
      omittedTodoCount: 1,
      actions: [createPlannedTodo('todo-1', '운동'), createPlannedTodo('todo-2', '장보기')],
    });
    const note = VoiceNotePolicy.withPlanDraft(
      createSpokenVoiceNote(),
      createPlanReviewDraft(plan),
    );
    const stored = JSON.parse(JSON.stringify(voiceNoteDraftSchema.encode(note)));
    stored.planDraft.form.actions[0].title = '';

    // When
    const restored = voiceNoteDraftSchema.decode(stored);

    // Then
    expect(restored.planDraft?.form.actions.map(({ title }) => title)).toEqual(['장보기']);
    expect(restored.planDraft?.omittedTodoCount).toBe(2);
    expect(VoiceNotePolicy.hasEmptyPlan(restored)).toBe(false);
  });

  it('새 칸이 생기기 전에 저장한 초안은 빈 값으로 채워 읽는다', () => {
    // Given
    const {
      planApplyRequest: _planApplyRequest,
      appliedTodoCount: _appliedTodoCount,
      memoSaveRequest: _memoSaveRequest,
      ...stored
    } = JSON.parse(JSON.stringify(voiceNoteDraftSchema.encode(createSpokenVoiceNote())));
    const [sentence] = stored.sentences;
    const { lowConfidenceWords: _lowConfidenceWords, ...oldSentence } = sentence;

    // When
    const restored = voiceNoteDraftSchema.decode({ ...stored, sentences: [oldSentence] });

    // Then
    expect(restored).toMatchObject({
      planApplyRequest: null,
      appliedTodoCount: null,
      memoSaveRequest: null,
    });
    expect(restored.sentences[0]?.lowConfidenceWords).toEqual([]);
  });
});
