import { ACTION_PLAN_LIMITS } from '@aido/api/vocabulary';
import { range } from 'es-toolkit';

import {
  createVoiceNoteDigest,
  createVoiceNoteFixture,
  createVoiceNoteKeyPoint,
  createVoiceNoteSentence,
} from '../__tests__/voice-note.fixtures';
import { createPlanReviewDraft } from './plan-review-form.schema';
import {
  createDigestInput,
  createDigestMemo,
  hasNoPlannedTodos,
  VoiceNotePolicy,
  voiceNoteSchema,
  withDigestResult,
  withPlanDraft,
} from './voice-note.model';
import { voicePlanSchema } from './voice-plan.model';

const createPlanDraftWithActions = (actions: unknown[]) =>
  createPlanReviewDraft(
    voicePlanSchema.parse({
      planId: 'draft-1',
      source: 'voice-note',
      sourceMemoId: null,
      omittedTodoCount: 0,
      actions,
    }),
  );
const createPlanDraftWithoutActions = () => createPlanDraftWithActions([]);
const createPlanDraftWithTodo = () =>
  createPlanDraftWithActions([createPlannedTodo('todo-1', '운동')]);

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

describe('VoiceNotePolicy.canDigest', () => {
  test('글자가 있고 아직 정리하지 않았으면 정리할 수 있다', () => {
    // Given
    const note = createVoiceNoteFixture();

    // When
    const result = VoiceNotePolicy.canDigest(note);

    // Then
    expect(result).toBe(true);
  });

  test('공백뿐인 문장만 있으면 정리할 수 없다', () => {
    // Given
    const note = createVoiceNoteFixture({ sentences: [createVoiceNoteSentence({ text: '  ' })] });

    // When
    const result = VoiceNotePolicy.canDigest(note);

    // Then
    expect(result).toBe(false);
  });

  test('이미 정리한 노트는 다시 정리할 수 없다', () => {
    // Given
    const note = createVoiceNoteFixture({ digest: createVoiceNoteDigest() });

    // When
    const result = VoiceNotePolicy.canDigest(note);

    // Then
    expect(result).toBe(false);
  });
});

describe('VoiceNotePolicy.canPlayRecording', () => {
  test('녹음 파일이 없으면 다시 들을 수 없다', () => {
    // Given
    const note = createVoiceNoteFixture({ recordings: [] });

    // When
    const result = VoiceNotePolicy.canPlayRecording(note);

    // Then
    expect(result).toBe(false);
  });

  test('녹음 파일과 길이가 있으면 다시 들을 수 있다', () => {
    // Given
    const note = createVoiceNoteFixture();

    // When
    const result = VoiceNotePolicy.canPlayRecording(note);

    // Then
    expect(result).toBe(true);
  });
});

describe('VoiceNotePolicy.findKeyPointAt', () => {
  const note = createVoiceNoteFixture({ digest: createVoiceNoteDigest() });

  test('첫 핵심 포인트 전에는 아무 포인트도 아니다', () => {
    // Given
    const positionMs = 11_999;

    // When
    const keyPoint = VoiceNotePolicy.findKeyPointAt(note, positionMs);

    // Then
    expect(keyPoint).toBeUndefined();
  });

  test('시작 시각 정각에는 그 포인트로 넘어간다', () => {
    // Given
    const positionMs = 41_000;

    // When
    const keyPoint = VoiceNotePolicy.findKeyPointAt(note, positionMs);

    // Then
    expect(keyPoint?.id).toBe('key-point-2');
  });

  test('다음 포인트 전까지는 직전 포인트로 본다', () => {
    // Given
    const positionMs = 116_999;

    // When
    const keyPoint = VoiceNotePolicy.findKeyPointAt(note, positionMs);

    // Then
    expect(keyPoint?.id).toBe('key-point-2');
  });

  test('순서가 섞여 있어도 가장 가까운 시작 시각을 고른다', () => {
    // Given
    const unordered = createVoiceNoteFixture({
      digest: createVoiceNoteDigest({
        keyPoints: [
          createVoiceNoteKeyPoint({ id: 'late', startMs: 90_000 }),
          createVoiceNoteKeyPoint({ id: 'early', startMs: 10_000 }),
        ],
      }),
    });

    // When
    const keyPoint = VoiceNotePolicy.findKeyPointAt(unordered, 95_000);

    // Then
    expect(keyPoint?.id).toBe('late');
  });

  test('정리 전 노트에는 핵심 포인트가 없다', () => {
    // Given
    const undigested = createVoiceNoteFixture();

    // When
    const keyPoint = VoiceNotePolicy.findKeyPointAt(undigested, 60_000);

    // Then
    expect(keyPoint).toBeUndefined();
  });
});

describe('VoiceNotePolicy.isExpired', () => {
  const note = createVoiceNoteFixture({ createdAt: new Date('2026-11-01T00:00:00.000Z') });

  test('만든 지 30일이 되기 직전까지는 만료되지 않는다', () => {
    // Given
    const now = new Date('2026-11-30T23:59:59.999Z');

    // When
    const result = VoiceNotePolicy.isExpired(note, now);

    // Then
    expect(result).toBe(false);
  });

  test('만든 지 30일이 되는 순간 만료된다', () => {
    // Given
    const now = new Date('2026-12-01T00:00:00.000Z');

    // When
    const result = VoiceNotePolicy.isExpired(note, now);

    // Then
    expect(result).toBe(true);
  });
});

describe('VoiceNotePolicy.isRecordingFileExpired', () => {
  test('수정 시각을 모르는 파일은 기한이 지난 것으로 본다', () => {
    // Given
    const now = new Date('2026-11-05T00:00:00.000Z');

    // When
    const result = VoiceNotePolicy.isRecordingFileExpired(null, now);

    // Then
    expect(result).toBe(true);
  });
});

describe('voiceNoteSchema', () => {
  test('저장한 순간은 ISO 문자열로 남고 읽으면 Date로 돌아온다', () => {
    // Given
    const note = createVoiceNoteFixture({ digest: createVoiceNoteDigest() });

    // When
    const stored = voiceNoteSchema.encode(note);
    const restored = voiceNoteSchema.decode(JSON.parse(JSON.stringify(stored)));

    // Then
    expect(stored.createdAt).toBe('2026-11-01T00:00:00.000Z');
    expect(restored).toEqual(note);
  });
});

describe('voiceNoteSchema 저장과 복원', () => {
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

  test('고친 카드까지 저장했다가 달력 날짜를 그대로 되살린다', () => {
    // Given
    const note = createVoiceNoteFixture({ planDraft: createPlanReviewDraft(plan) });

    // When
    const stored = JSON.parse(JSON.stringify(voiceNoteSchema.encode(note)));
    const restored = voiceNoteSchema.decode(stored);

    // Then
    const [action] = restored.planDraft?.form.actions ?? [];
    expect(action?.type === 'create-todo' && action.startDate).toBe('2026-11-06');
  });

  test('검토 초안이 깨졌으면 글자는 살리고 그 칸만 비운다', () => {
    // Given
    const note = createVoiceNoteFixture();
    const stored = JSON.parse(JSON.stringify(voiceNoteSchema.encode(note)));

    // When
    const restored = voiceNoteSchema.decode({ ...stored, planDraft: { form: 'broken' } });

    // Then
    expect(restored.planDraft).toBeNull();
    expect(restored.sentences).toHaveLength(1);
  });
});

describe('createDigestInput', () => {
  test('문장을 글자와 시각 구간으로 만들고 길이는 초로 보낸다', () => {
    // Given
    const note = createVoiceNoteFixture({
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
    const input = createDigestInput(note);

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

  test('문장이 서버 상한을 넘으면 이웃끼리 묶어 상한 안에 넣고 깃발은 남긴다', () => {
    // Given
    const sentences = range(1_000).map((index) =>
      createVoiceNoteSentence({
        text: `문장 ${index}`,
        startMs: index * 1_000,
        endMs: index * 1_000 + 1_000,
        isBookmarked: index === 1,
      }),
    );
    const note = createVoiceNoteFixture({ sentences });

    // When
    const { segments } = createDigestInput(note);

    // Then
    expect(segments.length).toBeLessThanOrEqual(ACTION_PLAN_LIMITS.DIGEST_MAX_SEGMENTS);
    expect(segments[0]).toEqual({ startMs: 0, text: '문장 0 문장 1', isBookmarked: true });
  });
});

describe('withDigestResult', () => {
  const emptyPlan = voicePlanSchema.parse({
    planId: 'draft-1',
    source: 'voice-note',
    sourceMemoId: null,
    omittedTodoCount: 0,
    actions: [],
  });

  test('핵심 포인트 시각에 말한 문장에 중요 표시가 있으면 깃발을 옮기고 시각을 모르면 그대로 둔다', () => {
    // Given
    const note = createVoiceNoteFixture({
      sentences: [
        createVoiceNoteSentence({ startMs: 0, endMs: 10_000, isBookmarked: true }),
        createVoiceNoteSentence({ startMs: 10_000, endMs: 20_000 }),
      ],
    });

    // When
    const next = withDigestResult(note, {
      plan: emptyPlan,
      title: '제목',
      summary: '요약',
      keyPoints: [
        { text: '깃발', startMs: 0 },
        { text: '보통', startMs: 10_000 },
        { text: '시각 모름', startMs: null },
      ],
      featureQuota: null,
      charged: true,
    });

    // Then
    expect(next.digest?.keyPoints.map(({ isBookmarked }) => isBookmarked)).toEqual([
      true,
      false,
      false,
    ]);
    expect(next.digest?.keyPoints[2]?.startMs).toBeNull();
    expect(next.digestRequest).toBeNull();
  });

  test('할 일이 하나도 없으면 요약은 남기고 할 일이 없다고 판단한다', () => {
    // Given
    const note = createVoiceNoteFixture();

    // When
    const next = withDigestResult(note, {
      plan: emptyPlan,
      title: '',
      summary: '요약',
      keyPoints: [],
      featureQuota: null,
      charged: true,
    });

    // Then
    expect(VoiceNotePolicy.hasNoPlannedTodos(next)).toBe(true);
    expect(next.digest?.summary).toBe('요약');
  });
});

describe('createDigestMemo', () => {
  test('요약과 핵심 포인트를 메모 한 장으로 만든다', () => {
    // Given
    const note = createVoiceNoteFixture({
      digest: createVoiceNoteDigest({
        title: '회의',
        summary: '요약',
        keyPoints: [createVoiceNoteKeyPoint({ text: '포인트' })],
      }),
    });

    // When
    const memo = createDigestMemo(note);

    // Then
    expect(memo).toMatchObject({ type: 'create-memo', title: '회의', content: '요약\n- 포인트' });
  });
});

describe('VoiceNotePolicy.findRecordingIndexAt', () => {
  const recordings = [{ startMs: 0 }, { startMs: 30_000 }, { startMs: 90_000 }];

  test.each([
    [0, 0],
    [29_999, 0],
    [30_000, 1],
    [120_000, 2],
  ])('%dms는 %d번째 조각이다', (positionMs, index) => {
    // Given
    const parts = recordings;

    // When
    const found = VoiceNotePolicy.findRecordingIndexAt(parts, positionMs);

    // Then
    expect(found).toBe(index);
  });

  test('저장된 초안에 제목이 빈 카드가 있어도 나머지 카드를 살리고 못 살린 수를 남긴다', () => {
    // Given
    const plan = voicePlanSchema.parse({
      planId: 'draft-1',
      source: 'voice-note',
      sourceMemoId: null,
      omittedTodoCount: 1,
      actions: [createPlannedTodo('todo-1', '운동'), createPlannedTodo('todo-2', '장보기')],
    });
    const note = withPlanDraft(createVoiceNoteFixture(), createPlanReviewDraft(plan));
    const stored = JSON.parse(JSON.stringify(voiceNoteSchema.encode(note)));
    stored.planDraft.form.actions[0].title = '';

    // When
    const restored = voiceNoteSchema.decode(stored);

    // Then
    expect(restored.planDraft?.form.actions.map(({ title }) => title)).toEqual(['장보기']);
    expect(restored.planDraft?.omittedTodoCount).toBe(2);
    expect(hasNoPlannedTodos(restored)).toBe(false);
  });

  test('할 일 카드를 읽을 수 없게 된 노트를 할 일이 없었던 노트로 치지 않는다', () => {
    // Given
    const note = {
      ...createVoiceNoteFixture({ digest: createVoiceNoteDigest() }),
      planDraft: null,
    };

    // When
    const result = hasNoPlannedTodos(note);

    // Then
    expect(result).toBe(false);
  });
});

describe('VoiceNotePolicy 계획 칸 상태', () => {
  test('이미 추가했으면 카드가 남아 있어도 추가했다고 본다', () => {
    // Given
    const note = createVoiceNoteFixture({
      appliedAt: new Date('2026-11-05T12:00:00.000Z'),
      planDraft: createPlanDraftWithTodo(),
    });

    // When
    const status = VoiceNotePolicy.getPlanStatus(note);

    // Then
    expect(status).toEqual({ status: 'applied' });
  });

  test('정리했는데 카드가 하나도 없으면 할 일이 없다고 본다', () => {
    // Given
    const note = createVoiceNoteFixture({
      digest: createVoiceNoteDigest(),
      planDraft: createPlanDraftWithoutActions(),
    });

    // When
    const status = VoiceNotePolicy.getPlanStatus(note);

    // Then
    expect(status).toEqual({ status: 'no-todos' });
  });

  test('카드를 읽지 못했으면 잃었다고 본다', () => {
    // Given
    const note = createVoiceNoteFixture({ digest: createVoiceNoteDigest(), planDraft: null });

    // When
    const status = VoiceNotePolicy.getPlanStatus(note);

    // Then
    expect(status).toEqual({ status: 'lost' });
  });

  test('고칠 카드가 있으면 초안을 함께 돌려준다', () => {
    // Given
    const planDraft = createPlanDraftWithTodo();
    const note = createVoiceNoteFixture({ digest: createVoiceNoteDigest(), planDraft });

    // When
    const status = VoiceNotePolicy.getPlanStatus(note);

    // Then
    expect(status).toEqual({ status: 'reviewable', planDraft });
  });
});

describe('VoiceNotePolicy 문장 계산', () => {
  const sentences = [
    createVoiceNoteSentence({ text: '하나', startMs: 1_000, isBookmarked: true }),
    createVoiceNoteSentence({ text: '두번째', startMs: 5_000 }),
  ];

  test('글자 수와 중요 표시 수를 문장에서 센다', () => {
    // Given
    const note = createVoiceNoteFixture({ sentences });

    // When
    const characterCount = VoiceNotePolicy.getCharacterCount(note);
    const markCount = VoiceNotePolicy.getMarkCount(note);

    // Then
    expect(characterCount).toBe(5);
    expect(markCount).toBe(1);
  });

  test('재생 위치의 문장을 찾고 첫 문장 앞이면 -1이다', () => {
    // Given
    const note = createVoiceNoteFixture({ sentences });

    // When
    const before = VoiceNotePolicy.findSentenceIndexAt(note, 500);
    const atSecond = VoiceNotePolicy.findSentenceIndexAt(note, 5_000);

    // Then
    expect(before).toBe(-1);
    expect(atSecond).toBe(1);
  });

  test('계획 카드 중 할 일만 센다. 카드가 없으면 0이다', () => {
    // Given
    const withTodo = createVoiceNoteFixture({ planDraft: createPlanDraftWithTodo() });
    const withoutDraft = createVoiceNoteFixture({ planDraft: null });

    // When
    const counted = VoiceNotePolicy.getPlannedTodoCount(withTodo);
    const empty = VoiceNotePolicy.getPlannedTodoCount(withoutDraft);

    // Then
    expect(counted).toBe(1);
    expect(empty).toBe(0);
  });
});

describe('toCaptureSeed', () => {
  test('저장된 문장을 확정된 글자로, 저장된 길이를 이미 들은 시간으로 잇는다', () => {
    // Given
    const note = createVoiceNoteFixture({
      durationMs: 90_000,
      sentences: [createVoiceNoteSentence({ text: '앞에서 한 말.' })],
    });

    // When
    const seed = VoiceNotePolicy.toCaptureSeed(note);

    // Then
    expect(seed.transcript).toEqual({ sentences: ['앞에서 한 말.'], interim: '' });
    expect(seed.elapsedMs).toBe(90_000);
  });
});
