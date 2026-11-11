import { createLoggerStub, createMemorySyncStorage } from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';

import { createSpokenVoiceNote, createVoiceNoteSentence } from '../__tests__/voice-note.fixtures';
import { VOICE_LOG_EVENT } from '../constants/voice-log-events';
import { VOICE_NOTE_DRAFT_SAVE_DEBOUNCE_MS } from '../constants/voice-note.constants';
import { VoiceNotePolicy } from '../domains/voice-note.model';
import { createVoiceNoteDraftRepository } from './voice-note-draft.repository';

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

function createRepository(timeZone = 'Asia/Seoul') {
  const storage = createMemorySyncStorage();
  const logger = createLoggerStub();
  const repository = createVoiceNoteDraftRepository({
    storage,
    logger,
    getTimeZone: () => timeZone,
  });

  return { storage, logger, repository };
}

describe('VoiceNoteDraftRepository', () => {
  setupFakeTimersPerTest();

  it('저장한 초안을 같은 계정에서 그대로 복원한다', () => {
    // Given
    const { repository } = createRepository();
    const note = createSpokenVoiceNote();

    // When
    repository.save('user-1', note);

    // Then
    expect(repository.find('user-1', note.draftId)).toEqual(note);
  });

  it('다른 계정의 초안은 읽지도 목록에 넣지도 않는다', () => {
    // Given
    const { repository } = createRepository();
    repository.save('user-1', createSpokenVoiceNote());

    // When
    const found = repository.find('user-2', 'draft-1');
    const all = repository.findAll('user-2');

    // Then
    expect(found).toBeNull();
    expect(all).toEqual([]);
  });

  it('계정 id가 다른 계정 id로 시작해도 초안이 섞이지 않는다', () => {
    // Given
    const { repository } = createRepository();
    repository.save('1', createSpokenVoiceNote());
    repository.save('10', createSpokenVoiceNote());

    // When
    const all = repository.findAll('1');

    // Then
    expect(all).toHaveLength(1);
  });

  it('문장이 이어서 들어오면 마지막 상태로 한 번만 쓴다', () => {
    // Given
    const { storage, repository } = createRepository();
    const write = jest.spyOn(storage, 'set');
    const note = createSpokenVoiceNote();

    // When
    repository.scheduleSave('user-1', note);
    repository.scheduleSave(
      'user-1',
      VoiceNotePolicy.withSentences(note, [createVoiceNoteSentence()], 1_000),
    );
    repository.scheduleSave(
      'user-1',
      VoiceNotePolicy.withSentences(
        note,
        [createVoiceNoteSentence(), createVoiceNoteSentence()],
        2_000,
      ),
    );
    jest.advanceTimersByTime(VOICE_NOTE_DRAFT_SAVE_DEBOUNCE_MS);

    // Then
    expect(write).toHaveBeenCalledTimes(1);
    expect(repository.find('user-1', note.draftId)?.sentences).toHaveLength(2);
  });

  it('모아 둔 쓰기는 시간이 지나기 전에도 flush로 끝낼 수 있다', () => {
    // Given
    const { repository } = createRepository();
    const note = createSpokenVoiceNote();
    repository.scheduleSave('user-1', note);

    // When
    repository.flush('user-1', note.draftId);

    // Then
    expect(repository.find('user-1', note.draftId)).toEqual(note);
  });

  it('지운 초안은 모아 둔 쓰기가 뒤늦게 되살리지 않는다', () => {
    // Given
    const { repository } = createRepository();
    const note = createSpokenVoiceNote();
    repository.scheduleSave('user-1', note);

    // When
    repository.remove('user-1', note.draftId);
    jest.advanceTimersByTime(VOICE_NOTE_DRAFT_SAVE_DEBOUNCE_MS);

    // Then
    expect(repository.find('user-1', note.draftId)).toBeNull();
  });

  it('읽을 수 없는 초안은 복원 실패를 남기고 버린다', () => {
    // Given
    const { storage, logger, repository } = createRepository();
    storage.set('aido_voice_note_draft_v1:user-1:draft-1', '{"draftId":');

    // When
    const found = repository.find('user-1', 'draft-1');

    // Then
    expect(found).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      VOICE_LOG_EVENT.DRAFT_RESTORE_FAILED,
      expect.objectContaining({ reason: 'invalid-json' }),
    );
    expect(storage.get('aido_voice_note_draft_v1:user-1:draft-1')).toBeUndefined();
  });

  it('형식이 맞지 않는 초안은 복원 실패를 남기고 버린다', () => {
    // Given
    const { storage, logger, repository } = createRepository();
    storage.set('aido_voice_note_draft_v1:user-1:draft-1', JSON.stringify({ draftId: 'draft-1' }));

    // When
    const found = repository.find('user-1', 'draft-1');

    // Then
    expect(found).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(VOICE_LOG_EVENT.DRAFT_RESTORE_FAILED, {
      reason: 'schema-mismatch',
    });
  });

  it('다른 계정의 초안만 지우고 현재 계정의 초안은 남긴다', () => {
    // Given
    const { repository } = createRepository();
    repository.save('user-1', createSpokenVoiceNote());
    repository.save('user-2', createSpokenVoiceNote());

    // When
    repository.removeAllExceptOwner('user-1');

    // Then
    expect(repository.findAll('user-1')).toHaveLength(1);
    expect(repository.findAll('user-2')).toHaveLength(0);
  });

  it('초안이 아닌 다른 저장 값은 건드리지 않고 초안만 모두 지운다', () => {
    // Given
    const { storage, repository } = createRepository();
    storage.set('aido_draft_v1:user-1:memo', 'keep');
    repository.save('user-1', createSpokenVoiceNote());

    // When
    repository.removeAll();

    // Then
    expect(repository.findAll('user-1')).toEqual([]);
    expect(storage.get('aido_draft_v1:user-1:memo')).toBe('keep');
  });

  it('기기에 저장된 초안의 고친 카드를 그대로 읽고 같은 형식으로 다시 쓴다', () => {
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

  it('달력 날짜를 ISO 순간으로 남긴 옛 초안은 지금 시간대의 날짜로 읽는다', () => {
    // Given
    const { storage, repository } = createRepository('America/Los_Angeles');
    const [action] = STORED_NOTE.planDraft.form.actions;
    storage.set(
      'aido_voice_note_draft_v1:user-1:draft-1',
      JSON.stringify({
        ...STORED_NOTE,
        planDraft: {
          omittedTodoCount: 0,
          form: { actions: [{ ...action, startDate: '2026-11-09T15:00:00.000Z' }] },
        },
      }),
    );

    // When
    const note = repository.find('user-1', 'draft-1');

    // Then
    expect(note?.planDraft?.form.actions[0]).toMatchObject({ startDate: '2026-11-09' });
  });

  it('바뀌기 전까지 같은 목록을 돌려주고 바뀌면 구독자에게 알린다', () => {
    // Given
    const repository = createVoiceNoteDraftRepository({
      storage: createMemorySyncStorage(),
      logger: createLoggerStub(),
      getTimeZone: () => 'Asia/Seoul',
    });
    const listener = jest.fn();
    repository.subscribe(listener);
    const before = repository.getSnapshot('user-1');

    // When
    const unchanged = repository.getSnapshot('user-1');
    repository.save('user-1', createSpokenVoiceNote());

    // Then
    expect(unchanged).toBe(before);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(repository.getSnapshot('user-1')).toHaveLength(1);
  });

  it('말이 끊이지 않아도 최대 대기 시간이 지나면 쓴다', () => {
    // Given
    const { repository } = createRepository();

    // When
    for (let elapsed = 0; elapsed < 6_000; elapsed += 500) {
      repository.scheduleSave('user-1', createSpokenVoiceNote());
      jest.advanceTimersByTime(500);
    }

    // Then
    expect(repository.find('user-1', 'draft-1')).toBeDefined();
  });

  it('한 초안을 저장해도 다른 초안은 다시 해석하지 않는다', () => {
    // Given
    const { storage, repository } = createRepository();
    repository.save('user-1', createSpokenVoiceNote({ draftId: 'draft-1' }));
    repository.save('user-1', createSpokenVoiceNote({ draftId: 'draft-2' }));
    const before = repository.getSnapshot('user-1');
    const getString = jest.spyOn(storage, 'get').mockClear();

    // When
    repository.save('user-1', createSpokenVoiceNote({ draftId: 'draft-1', durationMs: 1_000 }));
    const after = repository.getSnapshot('user-1');

    // Then
    expect(getString).not.toHaveBeenCalled();
    expect(after).not.toBe(before);
    expect(after.find(({ draftId }) => draftId === 'draft-1')?.durationMs).toBe(1_000);
    expect(after.find(({ draftId }) => draftId === 'draft-2')).toBe(
      before.find(({ draftId }) => draftId === 'draft-2'),
    );
  });

  it('저장소에 아직 없는 초안의 대기 쓰기도 전체 삭제 뒤에 되살아나지 않는다', () => {
    // Given
    const { repository } = createRepository();
    repository.scheduleSave('user-1', createSpokenVoiceNote());

    // When
    repository.removeAll();
    jest.advanceTimersByTime(10_000);

    // Then
    expect(repository.find('user-1', 'draft-1')).toBeNull();
  });

  it('다른 계정의 대기 쓰기는 소유자만 남길 때 함께 취소한다', () => {
    // Given
    const { repository } = createRepository();
    repository.scheduleSave('user-2', createSpokenVoiceNote());

    // When
    repository.removeAllExceptOwner('user-1');
    jest.advanceTimersByTime(10_000);

    // Then
    expect(repository.find('user-2', 'draft-1')).toBeNull();
  });
});
