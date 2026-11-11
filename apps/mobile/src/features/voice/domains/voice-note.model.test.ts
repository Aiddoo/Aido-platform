import { ACTION_PLAN_LIMITS } from '@aido/api/vocabulary';
import { toInstant } from '@src/shared/date/instant';
import { range } from 'es-toolkit';
import { ZodError } from 'zod';

import {
  createVoiceNoteDigest,
  createSpokenVoiceNote,
  createVoiceNoteKeyPoint,
  createVoiceNoteSentence,
} from '../__tests__/voice-note.fixtures';
import { createLocalFileEntry } from '../__tests__/voice.fixtures';
import { createPlanReviewDraft } from '../utils/plan-review-draft';
import {
  findRecordingIndexAt,
  VoiceNotePolicy,
  VoiceRecordingFilePolicy,
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

describe('getListedNotes', () => {
  it('최근에 만든 노트부터 보인다', () => {
    // Given
    const older = createSpokenVoiceNote({
      draftId: 'older',
      createdAt: toInstant('2026-11-01T00:00:00.000Z'),
    });
    const newer = createSpokenVoiceNote({
      draftId: 'newer',
      createdAt: toInstant('2026-11-02T00:00:00.000Z'),
    });

    // When
    const notes = VoiceNotePolicy.getListedNotes([older, newer]);

    // Then
    expect(notes.map((note) => note.draftId)).toEqual(['newer', 'older']);
  });

  it('글자가 없는 노트는 목록에서 뺀다', () => {
    // Given
    const empty = createSpokenVoiceNote({ draftId: 'empty', sentences: [] });
    const spoken = createSpokenVoiceNote({ draftId: 'spoken' });

    // When
    const notes = VoiceNotePolicy.getListedNotes([empty, spoken]);

    // Then
    expect(notes.map((note) => note.draftId)).toEqual(['spoken']);
  });
});

describe('canDigest', () => {
  it('글자가 있고 아직 정리하지 않았으면 정리할 수 있다', () => {
    // Given
    const note = createSpokenVoiceNote();

    // When
    const result = VoiceNotePolicy.canDigest(note);

    // Then
    expect(result).toBe(true);
  });

  it('공백뿐인 문장만 있으면 정리할 수 없다', () => {
    // Given
    const note = createSpokenVoiceNote({ sentences: [createVoiceNoteSentence({ text: '  ' })] });

    // When
    const result = VoiceNotePolicy.canDigest(note);

    // Then
    expect(result).toBe(false);
  });

  it('이미 정리한 노트는 다시 정리할 수 없다', () => {
    // Given
    const note = createSpokenVoiceNote({ digest: createVoiceNoteDigest() });

    // When
    const result = VoiceNotePolicy.canDigest(note);

    // Then
    expect(result).toBe(false);
  });
});

describe('canPlayRecording', () => {
  it('녹음 파일이 없으면 다시 들을 수 없다', () => {
    // Given
    const note = createSpokenVoiceNote({ recordings: [] });

    // When
    const result = VoiceNotePolicy.canPlayRecording(note);

    // Then
    expect(result).toBe(false);
  });

  it('녹음 파일과 길이가 있으면 다시 들을 수 있다', () => {
    // Given
    const note = createSpokenVoiceNote();

    // When
    const result = VoiceNotePolicy.canPlayRecording(note);

    // Then
    expect(result).toBe(true);
  });
});

describe('findKeyPointAt', () => {
  const note = createSpokenVoiceNote({ digest: createVoiceNoteDigest() });

  it('첫 핵심 포인트 전에는 아무 포인트도 아니다', () => {
    // Given
    const positionMs = 11_999;

    // When
    const keyPoint = VoiceNotePolicy.findKeyPointAt(note, positionMs);

    // Then
    expect(keyPoint).toBeNull();
  });

  it('시작 시각 정각에는 그 포인트로 넘어간다', () => {
    // Given
    const positionMs = 41_000;

    // When
    const keyPoint = VoiceNotePolicy.findKeyPointAt(note, positionMs);

    // Then
    expect(keyPoint?.id).toBe('key-point-2');
  });

  it('다음 포인트 전까지는 직전 포인트로 본다', () => {
    // Given
    const positionMs = 116_999;

    // When
    const keyPoint = VoiceNotePolicy.findKeyPointAt(note, positionMs);

    // Then
    expect(keyPoint?.id).toBe('key-point-2');
  });

  it('순서가 섞여 있어도 가장 가까운 시작 시각을 고른다', () => {
    // Given
    const unordered = createSpokenVoiceNote({
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

  it('정리 전 노트에는 핵심 포인트가 없다', () => {
    // Given
    const undigested = createSpokenVoiceNote();

    // When
    const keyPoint = VoiceNotePolicy.findKeyPointAt(undigested, 60_000);

    // Then
    expect(keyPoint).toBeNull();
  });
});

describe('isExpired', () => {
  const note = createSpokenVoiceNote({ createdAt: toInstant('2026-11-01T00:00:00.000Z') });

  it('만든 지 30일이 되기 직전까지는 만료되지 않는다', () => {
    // Given
    const now = toInstant('2026-11-30T23:59:59.999Z');

    // When
    const result = VoiceNotePolicy.isExpired(note, now);

    // Then
    expect(result).toBe(false);
  });

  it('만든 지 30일이 되는 순간 만료된다', () => {
    // Given
    const now = toInstant('2026-12-01T00:00:00.000Z');

    // When
    const result = VoiceNotePolicy.isExpired(note, now);

    // Then
    expect(result).toBe(true);
  });
});

describe('isRecordingFileExpired', () => {
  const now = toInstant('2026-11-05T01:00:00.000Z');

  it('수정 시각을 모르는 파일은 기한이 지난 것으로 본다', () => {
    // When
    const result = VoiceRecordingFilePolicy.isRecordingFileExpired(
      createLocalFileEntry({ modifiedAt: null }),
      now,
    );

    // Then
    expect(result).toBe(true);
  });

  it('수정한 지 1시간이 되기 직전까지는 만료되지 않는다', () => {
    // Given
    const modifiedAt = new Date('2026-11-05T00:00:00.001Z');

    // When
    const result = VoiceRecordingFilePolicy.isRecordingFileExpired(
      createLocalFileEntry({ modifiedAt }),
      now,
    );

    // Then
    expect(result).toBe(false);
  });

  it('수정한 지 1시간이 되는 순간 만료된다', () => {
    // Given
    const modifiedAt = new Date('2026-11-05T00:00:00.000Z');

    // When
    const result = VoiceRecordingFilePolicy.isRecordingFileExpired(
      createLocalFileEntry({ modifiedAt }),
      now,
    );

    // Then
    expect(result).toBe(true);
  });
});

describe('createDigestInput', () => {
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
    const input = VoiceNotePolicy.createDigestInput(note);

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
    const { segments } = VoiceNotePolicy.createDigestInput(note);

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

  it('핵심 포인트 시각에 말한 문장에 중요 표시가 있으면 깃발을 옮기고 시각을 모르면 그대로 둔다', () => {
    // Given
    const note = createSpokenVoiceNote({
      sentences: [
        createVoiceNoteSentence({ startMs: 0, endMs: 10_000, isBookmarked: true }),
        createVoiceNoteSentence({ startMs: 10_000, endMs: 20_000 }),
      ],
    });

    // When
    const next = VoiceNotePolicy.withDigestResult(
      note,
      {
        plan: emptyPlan,
        title: '제목',
        summary: '요약',
        keyPoints: [
          { text: '깃발', startMs: 0 },
          { text: '보통', startMs: 10_000 },
          { text: '시각 모름', startMs: null },
        ],
        featureQuota: null,
        isCharged: true,
      },
      createPlanReviewDraft(emptyPlan),
    );

    // Then
    expect(next.digest?.keyPoints.map(({ isBookmarked }) => isBookmarked)).toEqual([
      true,
      false,
      false,
    ]);
    expect(next.digest?.keyPoints[2]?.startMs).toBeNull();
    expect(next.digestRequest).toBeNull();
  });

  it('할 일이 하나도 없으면 요약은 남기고 할 일이 없다고 판단한다', () => {
    // Given
    const note = createSpokenVoiceNote();

    // When
    const next = VoiceNotePolicy.withDigestResult(
      note,
      {
        plan: emptyPlan,
        title: '',
        summary: '요약',
        keyPoints: [],
        featureQuota: null,
        isCharged: true,
      },
      createPlanReviewDraft(emptyPlan),
    );

    // Then
    expect(VoiceNotePolicy.hasEmptyPlan(next)).toBe(true);
    expect(next.digest?.summary).toBe('요약');
  });
});

describe('createDigestMemo', () => {
  it('요약과 핵심 포인트를 메모 한 장으로 만든다', () => {
    // Given
    const note = createSpokenVoiceNote({
      digest: createVoiceNoteDigest({
        title: '회의',
        summary: '요약',
        keyPoints: [createVoiceNoteKeyPoint({ text: '포인트' })],
      }),
    });

    // When
    const memo = VoiceNotePolicy.createDigestMemo(note);

    // Then
    expect(memo).toMatchObject({ type: 'create-memo', title: '회의', content: '요약\n- 포인트' });
  });
});

describe('hasEmptyPlan', () => {
  it('할 일 카드를 읽을 수 없게 된 노트를 할 일이 없었던 노트로 치지 않는다', () => {
    // Given
    const note = {
      ...createSpokenVoiceNote({ digest: createVoiceNoteDigest() }),
      planDraft: null,
    };

    // When
    const result = VoiceNotePolicy.hasEmptyPlan(note);

    // Then
    expect(result).toBe(false);
  });
});

describe('findRecordingIndexAt', () => {
  const recordings = [{ startMs: 0 }, { startMs: 30_000 }, { startMs: 90_000 }];

  it.each([
    [0, 0],
    [29_999, 0],
    [30_000, 1],
    [120_000, 2],
  ])('%dms는 %d번째 조각이다', (positionMs, index) => {
    // When
    const found = findRecordingIndexAt(recordings, positionMs);

    // Then
    expect(found).toBe(index);
  });
});

describe('getPlanStatus', () => {
  it('이미 추가했으면 카드가 남아 있어도 추가했다고 본다', () => {
    // Given
    const note = createSpokenVoiceNote({
      appliedAt: toInstant('2026-11-05T12:00:00.000Z'),
      planDraft: createPlanDraftWithTodo(),
    });

    // When
    const status = VoiceNotePolicy.getPlanStatus(note);

    // Then
    expect(status).toEqual({ status: 'applied' });
  });

  it('정리했는데 카드가 하나도 없으면 할 일이 없다고 본다', () => {
    // Given
    const note = createSpokenVoiceNote({
      digest: createVoiceNoteDigest(),
      planDraft: createPlanDraftWithoutActions(),
    });

    // When
    const status = VoiceNotePolicy.getPlanStatus(note);

    // Then
    expect(status).toEqual({ status: 'no-todos' });
  });

  it('카드를 읽지 못했으면 잃었다고 본다', () => {
    // Given
    const note = createSpokenVoiceNote({ digest: createVoiceNoteDigest(), planDraft: null });

    // When
    const status = VoiceNotePolicy.getPlanStatus(note);

    // Then
    expect(status).toEqual({ status: 'lost' });
  });

  it('고칠 카드가 있으면 초안을 함께 돌려준다', () => {
    // Given
    const planDraft = createPlanDraftWithTodo();
    const note = createSpokenVoiceNote({ digest: createVoiceNoteDigest(), planDraft });

    // When
    const status = VoiceNotePolicy.getPlanStatus(note);

    // Then
    expect(status).toEqual({ status: 'reviewable', planDraft });
  });
});

const spokenSentences = [
  createVoiceNoteSentence({ text: '하나', startMs: 1_000, isBookmarked: true }),
  createVoiceNoteSentence({ text: '두번째', startMs: 5_000 }),
];

describe('getCharacterCount', () => {
  it('문장의 글자 수를 모두 더한다', () => {
    // Given
    const note = createSpokenVoiceNote({ sentences: spokenSentences });

    // When
    const characterCount = VoiceNotePolicy.getCharacterCount(note);

    // Then
    expect(characterCount).toBe(5);
  });
});

describe('getMarkCount', () => {
  it('중요 표시한 문장만 센다', () => {
    // Given
    const note = createSpokenVoiceNote({ sentences: spokenSentences });

    // When
    const markCount = VoiceNotePolicy.getMarkCount(note);

    // Then
    expect(markCount).toBe(1);
  });
});

describe('findSentenceIndexAt', () => {
  it('재생 위치의 문장을 찾고 첫 문장 앞이면 -1이다', () => {
    // Given
    const note = createSpokenVoiceNote({ sentences: spokenSentences });

    // When
    const before = VoiceNotePolicy.findSentenceIndexAt(note, 500);
    const atSecond = VoiceNotePolicy.findSentenceIndexAt(note, 5_000);

    // Then
    expect(before).toBe(-1);
    expect(atSecond).toBe(1);
  });
});

describe('findTodoCount', () => {
  it('추가하기 전에는 계획 카드 중 할 일만 센다. 카드가 없으면 0이다', () => {
    // Given
    const withTodo = createSpokenVoiceNote({ planDraft: createPlanDraftWithTodo() });
    const withoutDraft = createSpokenVoiceNote({ planDraft: null });

    // When
    const counted = VoiceNotePolicy.findTodoCount(withTodo);
    const empty = VoiceNotePolicy.findTodoCount(withoutDraft);

    // Then
    expect(counted).toBe(1);
    expect(empty).toBe(0);
  });

  it('추가한 뒤에는 계획 카드가 비어도 추가한 수를 센다', () => {
    // Given
    const planned = createSpokenVoiceNote({ planDraft: createPlanDraftWithTodo() });
    const applied = VoiceNotePolicy.withAppliedAt(
      planned,
      toInstant('2026-11-05T12:00:00.000Z'),
      3,
    );

    // When
    const result = VoiceNotePolicy.findTodoCount(applied);

    // Then
    expect(result).toBe(3);
  });

  it('추가한 수를 남기기 전에 추가한 노트는 수를 모른다', () => {
    // Given
    const note = createSpokenVoiceNote({
      appliedAt: toInstant('2026-11-05T12:00:00.000Z'),
      appliedTodoCount: null,
      planDraft: null,
    });

    // When
    const result = VoiceNotePolicy.findTodoCount(note);

    // Then
    expect(result).toBeNull();
  });
});

describe('hasAppliedOnlyMemo', () => {
  it('저장은 했는데 할 일이 0개면 메모만 저장한 노트다', () => {
    // Given
    const note = createSpokenVoiceNote({
      appliedAt: toInstant('2026-11-05T12:00:00.000Z'),
      appliedTodoCount: 0,
    });

    // When
    const result = VoiceNotePolicy.hasAppliedOnlyMemo(note);

    // Then
    expect(result).toBe(true);
  });

  it('할 일을 하나라도 저장했으면 메모만 저장한 노트가 아니다', () => {
    // Given
    const note = createSpokenVoiceNote({
      appliedAt: toInstant('2026-11-05T12:00:00.000Z'),
      appliedTodoCount: 1,
    });

    // When
    const result = VoiceNotePolicy.hasAppliedOnlyMemo(note);

    // Then
    expect(result).toBe(false);
  });

  it('아직 저장하지 않은 노트는 메모만 저장한 노트가 아니다', () => {
    // Given
    const note = createSpokenVoiceNote({ appliedAt: null, appliedTodoCount: 0 });

    // When
    const result = VoiceNotePolicy.hasAppliedOnlyMemo(note);

    // Then
    expect(result).toBe(false);
  });

  it('저장한 할 일 수를 모르는 옛 초안은 메모만 저장한 노트로 보지 않는다', () => {
    // Given
    const note = createSpokenVoiceNote({
      appliedAt: toInstant('2026-11-05T12:00:00.000Z'),
      appliedTodoCount: null,
    });

    // When
    const result = VoiceNotePolicy.hasAppliedOnlyMemo(note);

    // Then
    expect(result).toBe(false);
  });
});

describe('withAppliedAt', () => {
  it('저장한 시각과 할 일 수를 남기고 검토 초안과 저장 요청을 비운다', () => {
    // Given
    const appliedAt = toInstant('2026-11-05T12:00:00.000Z');
    const note = createSpokenVoiceNote({
      planDraft: createPlanDraftWithTodo(),
      planApplyRequest: { idempotencyKey: 'key-1', fingerprint: 'fingerprint-1' },
    });

    // When
    const applied = VoiceNotePolicy.withAppliedAt(note, appliedAt, 2);

    // Then
    expect(applied).toMatchObject({
      appliedAt,
      appliedTodoCount: 2,
      planDraft: null,
      planApplyRequest: null,
    });
  });
});

describe('getRecordingSizeBytes', () => {
  const note = createSpokenVoiceNote({
    recordings: [
      { fileName: 'draft-1-0.wav', startMs: 0 },
      { fileName: 'draft-1-1.wav', startMs: 30_000 },
    ],
  });

  it('노트가 가리키는 녹음 파일 크기만 더한다', () => {
    // Given
    const sizes = { 'draft-1-0.wav': 1_000, 'draft-1-1.wav': 2_500, 'other-0.wav': 9_999 };

    // When
    const totalBytes = VoiceNotePolicy.getRecordingSizeBytes(note, sizes);

    // Then
    expect(totalBytes).toBe(3_500);
  });

  it('크기를 모르는 파일은 0바이트로 센다', () => {
    // Given
    const sizes = { 'draft-1-1.wav': 2_500 };

    // When
    const totalBytes = VoiceNotePolicy.getRecordingSizeBytes(note, sizes);

    // Then
    expect(totalBytes).toBe(2_500);
  });
});

describe('toCaptureSeed', () => {
  it('저장된 문장을 확정된 글자로, 저장된 길이를 이미 들은 시간으로 잇는다', () => {
    // Given
    const note = createSpokenVoiceNote({
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

describe('createVoiceNote', () => {
  it('글자·녹음·정리·저장 기록이 모두 비어 있는 새 노트를 만든다', () => {
    // Given
    const createdAt = toInstant('2026-11-01T00:00:00.000Z');

    // When
    const note = VoiceNotePolicy.createVoiceNote({
      draftId: 'draft-1',
      locale: 'ko-KR',
      createdAt,
    });

    // Then
    expect(note).toEqual({
      draftId: 'draft-1',
      locale: 'ko-KR',
      createdAt,
      durationMs: 0,
      sentences: [],
      recordings: [],
      digest: null,
      digestRequest: null,
      planDraft: null,
      planApplyRequest: null,
      appliedAt: null,
      appliedTodoCount: null,
      memoSaveRequest: null,
      memoSavedAt: null,
    });
  });

  it('빈 초안 id로는 노트를 만들지 않는다', () => {
    // Given
    const createdAt = toInstant('2026-11-01T00:00:00.000Z');

    // When
    const create = () =>
      VoiceNotePolicy.createVoiceNote({ draftId: '', locale: 'ko-KR', createdAt });

    // Then
    expect(create).toThrow(ZodError);
  });
});

describe('withSentences', () => {
  it('문장과 들은 길이를 함께 바꾸고 원래 노트는 그대로 둔다', () => {
    // Given
    const note = createSpokenVoiceNote();
    const sentences = [
      createVoiceNoteSentence({ text: '첫 문장', startMs: 0, endMs: 2_000 }),
      createVoiceNoteSentence({ text: '둘째 문장', startMs: 2_000, endMs: 5_000 }),
    ];

    // When
    const next = VoiceNotePolicy.withSentences(note, sentences, 5_000);

    // Then
    expect(next.sentences).toEqual(sentences);
    expect(next.sentences).not.toBe(sentences);
    expect(next.durationMs).toBe(5_000);
    expect(note.durationMs).toBe(178_000);
  });
});

describe('withRecordings', () => {
  it('녹음 조각 목록을 새 목록으로 바꾼다', () => {
    // Given
    const note = createSpokenVoiceNote();
    const recordings = [
      { fileName: 'draft-1-0.wav', startMs: 0 },
      { fileName: 'draft-1-1.wav', startMs: 60_000 },
    ];

    // When
    const next = VoiceNotePolicy.withRecordings(note, recordings);

    // Then
    expect(next.recordings).toEqual(recordings);
    expect(next.recordings).not.toBe(recordings);
    expect(note.recordings).toHaveLength(1);
  });
});

describe('withoutRecordings', () => {
  it('녹음 조각만 비우고 글자는 남긴다', () => {
    // Given
    const note = createSpokenVoiceNote();

    // When
    const next = VoiceNotePolicy.withoutRecordings(note);

    // Then
    expect(next.recordings).toEqual([]);
    expect(next.sentences).toEqual(note.sentences);
  });
});

describe('멱등 요청 기록', () => {
  it('정리 요청 키를 남기고 null이면 지운다', () => {
    // Given
    const note = createSpokenVoiceNote();
    const digestRequest = { idempotencyKey: 'digest-key' };

    // When
    const requested = VoiceNotePolicy.withDigestRequest(note, digestRequest);
    const cleared = VoiceNotePolicy.withDigestRequest(requested, null);

    // Then
    expect(requested.digestRequest).toEqual(digestRequest);
    expect(cleared.digestRequest).toBeNull();
  });

  it('카드 저장 요청은 키와 내용 지문을 함께 남기고 null이면 지운다', () => {
    // Given
    const note = createSpokenVoiceNote();
    const planApplyRequest = { idempotencyKey: 'apply-key', fingerprint: 'cards-v1' };

    // When
    const requested = VoiceNotePolicy.withPlanApplyRequest(note, planApplyRequest);
    const cleared = VoiceNotePolicy.withPlanApplyRequest(requested, null);

    // Then
    expect(requested.planApplyRequest).toEqual(planApplyRequest);
    expect(cleared.planApplyRequest).toBeNull();
  });

  it('메모 저장 요청 키를 남기고 null이면 지운다', () => {
    // Given
    const note = createSpokenVoiceNote();
    const memoSaveRequest = { idempotencyKey: 'memo-key' };

    // When
    const requested = VoiceNotePolicy.withMemoSaveRequest(note, memoSaveRequest);
    const cleared = VoiceNotePolicy.withMemoSaveRequest(requested, null);

    // Then
    expect(requested.memoSaveRequest).toEqual(memoSaveRequest);
    expect(cleared.memoSaveRequest).toBeNull();
  });
});

describe('withMemoSavedAt', () => {
  it('메모로 저장한 시각을 남기고 끝난 저장 요청 키는 지운다', () => {
    // Given
    const note = VoiceNotePolicy.withMemoSaveRequest(createSpokenVoiceNote(), {
      idempotencyKey: 'memo-key',
    });
    const savedAt = toInstant('2026-11-01T01:00:00.000Z');

    // When
    const next = VoiceNotePolicy.withMemoSavedAt(note, savedAt);

    // Then
    expect(next.memoSavedAt).toBe(savedAt);
    expect(next.memoSaveRequest).toBeNull();
  });
});

describe('hasText', () => {
  it('글자가 있는 문장이 하나라도 있으면 글자가 있다', () => {
    // Given
    const note = createSpokenVoiceNote({
      sentences: [
        createVoiceNoteSentence({ text: '  ' }),
        createVoiceNoteSentence({ text: '장보기' }),
      ],
    });

    // When
    const result = VoiceNotePolicy.hasText(note);

    // Then
    expect(result).toBe(true);
  });

  it('문장이 공백뿐이면 글자가 없다', () => {
    // Given
    const note = createSpokenVoiceNote({
      sentences: [createVoiceNoteSentence({ text: '' }), createVoiceNoteSentence({ text: ' ' })],
    });

    // When
    const result = VoiceNotePolicy.hasText(note);

    // Then
    expect(result).toBe(false);
  });

  it('문장이 없으면 글자가 없다', () => {
    // Given
    const note = createSpokenVoiceNote({ sentences: [] });

    // When
    const result = VoiceNotePolicy.hasText(note);

    // Then
    expect(result).toBe(false);
  });
});

describe('findDigestTitle', () => {
  it('정리 결과의 제목을 돌려준다', () => {
    // Given
    const note = createSpokenVoiceNote({ digest: createVoiceNoteDigest({ title: '주간 회의' }) });

    // When
    const title = VoiceNotePolicy.findDigestTitle(note);

    // Then
    expect(title).toBe('주간 회의');
  });

  it('아직 정리하지 않았으면 null이라 화면이 기본 제목을 쓴다', () => {
    // Given
    const note = createSpokenVoiceNote({ digest: null });

    // When
    const title = VoiceNotePolicy.findDigestTitle(note);

    // Then
    expect(title).toBeNull();
  });

  it('정리 제목이 빈 글자면 null이다', () => {
    // Given
    const note = createSpokenVoiceNote({ digest: createVoiceNoteDigest({ title: '' }) });

    // When
    const title = VoiceNotePolicy.findDigestTitle(note);

    // Then
    expect(title).toBeNull();
  });
});
