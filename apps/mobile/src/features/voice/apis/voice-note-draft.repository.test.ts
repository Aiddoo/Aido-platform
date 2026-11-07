import { createMemorySyncStorage } from '@src/shared/__tests__';

import { createVoiceNoteFixture, createVoiceNoteSentence } from '../__tests__/voice-note.fixtures';
import { VOICE_NOTE_LOG_EVENT } from '../constants/voice-note-log-events';
import { withSentences } from '../domains/voice-note.model';
import { createVoiceNoteDraftRepository } from './voice-note-draft.repository';

const DEBOUNCE_MS = 800;

const STORED_NOTE = {
  draftId: 'draft-1',
  locale: 'ko-KR',
  createdAt: '2026-11-06T00:00:00.000Z',
  durationMs: 1_000,
  sentences: [],
  recordings: [],
  digest: null,
  digestRequest: null,
  planDraft: {
    omittedTodoCount: 0,
    form: {
      actions: [
        {
          type: 'create-todo',
          actionId: 'a1',
          title: '보고서 쓰기',
          startDate: '2026-11-10',
          endDate: null,
          scheduledTime: null,
          repeat: null,
          visibility: null,
          items: [],
          categoryId: 1,
          duplicateOfTodoId: null,
          isSelected: true,
        },
      ],
    },
  },
  planApplyRequest: null,
  appliedAt: null,
  appliedTodoCount: null,
  memoSaveRequest: null,
  memoSavedAt: null,
};

function createRepository() {
  const storage = createMemorySyncStorage();
  const logger = { warn: jest.fn() };
  const repository = createVoiceNoteDraftRepository({ storage, logger, debounceMs: DEBOUNCE_MS });

  return { storage, logger, repository };
}

describe('VoiceNoteDraftRepository', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('저장한 초안을 같은 계정에서 그대로 복원한다', () => {
    // Given
    const { repository } = createRepository();
    const note = createVoiceNoteFixture();

    // When
    repository.save('user-1', note);

    // Then
    expect(repository.find('user-1', note.draftId)).toEqual(note);
  });

  test('다른 계정의 초안은 읽지도 목록에 넣지도 않는다', () => {
    // Given
    const { repository } = createRepository();
    repository.save('user-1', createVoiceNoteFixture());

    // When
    const found = repository.find('user-2', 'draft-1');
    const all = repository.findAll('user-2');

    // Then
    expect(found).toBeUndefined();
    expect(all).toEqual([]);
  });

  test('계정 id가 다른 계정 id로 시작해도 초안이 섞이지 않는다', () => {
    // Given
    const { repository } = createRepository();
    repository.save('1', createVoiceNoteFixture());
    repository.save('10', createVoiceNoteFixture());

    // When
    const all = repository.findAll('1');

    // Then
    expect(all).toHaveLength(1);
  });

  test('문장이 이어서 들어오면 마지막 상태로 한 번만 쓴다', () => {
    // Given
    const { storage, repository } = createRepository();
    const write = jest.spyOn(storage, 'set');
    const note = createVoiceNoteFixture();

    // When
    repository.scheduleSave('user-1', note);
    repository.scheduleSave('user-1', withSentences(note, [createVoiceNoteSentence()], 1_000));
    repository.scheduleSave(
      'user-1',
      withSentences(note, [createVoiceNoteSentence(), createVoiceNoteSentence()], 2_000),
    );
    jest.advanceTimersByTime(DEBOUNCE_MS);

    // Then
    expect(write).toHaveBeenCalledTimes(1);
    expect(repository.find('user-1', note.draftId)?.sentences).toHaveLength(2);
  });

  test('모아 둔 쓰기는 시간이 지나기 전에도 flush로 끝낼 수 있다', () => {
    // Given
    const { repository } = createRepository();
    const note = createVoiceNoteFixture();
    repository.scheduleSave('user-1', note);

    // When
    repository.flush('user-1', note.draftId);

    // Then
    expect(repository.find('user-1', note.draftId)).toEqual(note);
  });

  test('지운 초안은 모아 둔 쓰기가 뒤늦게 되살리지 않는다', () => {
    // Given
    const { repository } = createRepository();
    const note = createVoiceNoteFixture();
    repository.scheduleSave('user-1', note);

    // When
    repository.remove('user-1', note.draftId);
    jest.advanceTimersByTime(DEBOUNCE_MS);

    // Then
    expect(repository.find('user-1', note.draftId)).toBeUndefined();
  });

  test('읽을 수 없는 초안은 복원 실패를 남기고 버린다', () => {
    // Given
    const { storage, logger, repository } = createRepository();
    storage.set('aido_voice_note_draft_v1:user-1:draft-1', '{"draftId":');

    // When
    const found = repository.find('user-1', 'draft-1');

    // Then
    expect(found).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      VOICE_NOTE_LOG_EVENT.DRAFT_RESTORE_FAILED,
      expect.objectContaining({ reason: 'invalid-json' }),
    );
    expect(storage.get('aido_voice_note_draft_v1:user-1:draft-1')).toBeUndefined();
  });

  test('형식이 맞지 않는 초안은 복원 실패를 남기고 버린다', () => {
    // Given
    const { storage, logger, repository } = createRepository();
    storage.set('aido_voice_note_draft_v1:user-1:draft-1', JSON.stringify({ draftId: 'draft-1' }));

    // When
    const found = repository.find('user-1', 'draft-1');

    // Then
    expect(found).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(VOICE_NOTE_LOG_EVENT.DRAFT_RESTORE_FAILED, {
      reason: 'schema-mismatch',
    });
  });

  test('다른 계정의 초안만 지우고 현재 계정의 초안은 남긴다', () => {
    // Given
    const { repository } = createRepository();
    repository.save('user-1', createVoiceNoteFixture());
    repository.save('user-2', createVoiceNoteFixture());

    // When
    repository.removeAllExceptOwner('user-1');

    // Then
    expect(repository.findAll('user-1')).toHaveLength(1);
    expect(repository.findAll('user-2')).toHaveLength(0);
  });

  test('초안이 아닌 다른 저장 값은 건드리지 않고 초안만 모두 지운다', () => {
    // Given
    const { storage, repository } = createRepository();
    storage.set('aido_draft_v1:user-1:memo', 'keep');
    repository.save('user-1', createVoiceNoteFixture());

    // When
    repository.removeAll();

    // Then
    expect(repository.findAll('user-1')).toEqual([]);
    expect(storage.get('aido_draft_v1:user-1:memo')).toBe('keep');
  });

  test('기기에 저장된 초안의 고친 카드를 그대로 읽고 같은 형식으로 다시 쓴다', () => {
    // Given
    const { storage, repository } = createRepository();
    const key = 'aido_voice_note_draft_v1:user-1:draft-1';
    storage.set(key, JSON.stringify(STORED_NOTE));

    // When
    const note = repository.find('user-1', 'draft-1');
    if (note != null) {
      repository.save('user-1', note);
    }

    // Then
    expect(note?.planDraft?.form.actions[0]).toMatchObject({
      title: '보고서 쓰기',
      startDate: '2026-11-10',
    });
    expect(JSON.parse(storage.get(key) ?? '')).toEqual(STORED_NOTE);
  });

  test('바뀌기 전까지 같은 목록을 돌려주고 바뀌면 구독자에게 알린다', () => {
    // Given
    const repository = createVoiceNoteDraftRepository({
      storage: createMemorySyncStorage(),
      logger: { warn: jest.fn() },
    });
    const listener = jest.fn();
    repository.subscribe(listener);
    const before = repository.getSnapshot('user-1');

    // When
    const unchanged = repository.getSnapshot('user-1');
    repository.save('user-1', createVoiceNoteFixture());

    // Then
    expect(unchanged).toBe(before);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(repository.getSnapshot('user-1')).toHaveLength(1);
  });

  test('말이 끊이지 않아도 최대 대기 시간이 지나면 쓴다', () => {
    // Given
    const { repository } = createRepository();

    // When
    for (let elapsed = 0; elapsed < 6_000; elapsed += 500) {
      repository.scheduleSave('user-1', createVoiceNoteFixture());
      jest.advanceTimersByTime(500);
    }

    // Then
    expect(repository.find('user-1', 'draft-1')).toBeDefined();
  });

  test('한 초안을 저장해도 다른 초안은 다시 해석하지 않는다', () => {
    // Given
    const { storage, repository } = createRepository();
    repository.save('user-1', createVoiceNoteFixture({ draftId: 'draft-1' }));
    repository.save('user-1', createVoiceNoteFixture({ draftId: 'draft-2' }));
    const before = repository.getSnapshot('user-1');
    const getString = jest.spyOn(storage, 'get').mockClear();

    // When
    repository.save('user-1', createVoiceNoteFixture({ draftId: 'draft-1', durationMs: 1_000 }));
    const after = repository.getSnapshot('user-1');

    // Then
    expect(getString).not.toHaveBeenCalled();
    expect(after).not.toBe(before);
    expect(after.find(({ draftId }) => draftId === 'draft-1')?.durationMs).toBe(1_000);
    expect(after.find(({ draftId }) => draftId === 'draft-2')).toBe(
      before.find(({ draftId }) => draftId === 'draft-2'),
    );
  });

  test('저장소에 아직 없는 초안의 대기 쓰기도 전체 삭제 뒤에 되살아나지 않는다', () => {
    // Given
    const { repository } = createRepository();
    repository.scheduleSave('user-1', createVoiceNoteFixture());

    // When
    repository.removeAll();
    jest.advanceTimersByTime(10_000);

    // Then
    expect(repository.find('user-1', 'draft-1')).toBeUndefined();
  });

  test('다른 계정의 대기 쓰기는 소유자만 남길 때 함께 취소한다', () => {
    // Given
    const { repository } = createRepository();
    repository.scheduleSave('user-2', createVoiceNoteFixture());

    // When
    repository.removeAllExceptOwner('user-1');
    jest.advanceTimersByTime(10_000);

    // Then
    expect(repository.find('user-2', 'draft-1')).toBeUndefined();
  });
});
