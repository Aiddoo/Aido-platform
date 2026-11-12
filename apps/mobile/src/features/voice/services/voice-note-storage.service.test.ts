import { toInstant } from '@src/shared/date/instant';
import { KeychainLockedError } from '@src/shared/errors';
import { openEncryptedStorage } from '@src/shared/infra/storage/encrypted-draft-storage';
import {
  createLocalFileSystemFake,
  createAppLoggerStub,
  createMemoryKeyValueStorage,
  createMemorySyncStorage,
  createTestDi,
} from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';

import {
  createVoiceNoteDigest,
  createSpokenVoiceNote,
  RELEASED_VOICE_NOTE_DRAFTS,
} from '../__tests__/voice-note.fixtures';
import { VoiceNotePolicy } from '../domains/voice-note.model';
import { createVoiceNoteDraftRepository } from '../repositories/voice-note-draft.repository';
import { createVoiceRecordingRepository } from '../repositories/voice-recording.repository';
import { VoiceNoteStorageService } from './voice-note-storage.service';

const NOW = toInstant('2026-12-05T00:00:00.000Z');
const OWNER_DIRECTORY = ['voice-notes', 'user-1'];

function createService() {
  const logger = createAppLoggerStub();
  const files = createLocalFileSystemFake();
  const storage = createMemorySyncStorage();
  const drafts = createVoiceNoteDraftRepository({
    storage,
    logger,
    getTimeZone: () => 'Asia/Seoul',
  });
  const service = new VoiceNoteStorageService({
    drafts,
    recordings: createVoiceRecordingRepository(files, logger),
    now: () => NOW,
    isDraftStorageOpen: true,
  });

  return { files, service, drafts, storage };
}

describe('VoiceNoteStorageService', () => {
  setupFakeTimersPerTest();

  it('초안을 버리면 그 녹음 파일도 함께 지운다', () => {
    // Given
    const { files, service, drafts } = createService();
    files.addFile(OWNER_DIRECTORY, 'draft-1-0.wav');
    drafts.save('user-1', createSpokenVoiceNote());

    // When
    service.discard('user-1', 'draft-1');

    // Then
    expect(drafts.find('user-1', 'draft-1')).toBeNull();
    expect(files.hasFile(OWNER_DIRECTORY, 'draft-1-0.wav')).toBe(false);
  });

  it('아직 쓰지 않은 대기 쓰기만 있는 초안을 버려도 나중에 되살아나지 않는다', () => {
    // Given
    const { service, drafts } = createService();
    drafts.scheduleSave('user-1', createSpokenVoiceNote());

    // When
    service.discard('user-1', 'draft-1');
    jest.advanceTimersByTime(10_000);

    // Then
    expect(drafts.find('user-1', 'draft-1')).toBeNull();
  });

  it('30일이 지난 초안은 녹음과 함께 지우고 최근 초안은 남긴다', () => {
    // Given
    const { files, service, drafts } = createService();
    files.addFile(OWNER_DIRECTORY, 'draft-1-0.wav', {
      modifiedAtMs: Date.parse('2026-11-01T00:00:00.000Z'),
    });
    files.addFile(OWNER_DIRECTORY, 'draft-2-0.wav', {
      modifiedAtMs: Date.parse('2026-12-01T00:00:00.000Z'),
    });
    drafts.save('user-1', createSpokenVoiceNote());
    drafts.save(
      'user-1',
      createSpokenVoiceNote({
        draftId: 'draft-2',
        createdAt: toInstant('2026-12-01T00:00:00.000Z'),
      }),
    );

    // When
    service.removeExpired('user-1');

    // Then
    expect(drafts.findAll('user-1').map((note) => note.draftId)).toEqual(['draft-2']);
    expect(files.hasFile(OWNER_DIRECTORY, 'draft-1-0.wav')).toBe(false);
    expect(files.hasFile(OWNER_DIRECTORY, 'draft-2-0.wav')).toBe(true);
  });

  it('1.15.1이 남긴 초안의 녹음은 오래돼도 고아로 보지 않고 어느 초안도 가리키지 않는 녹음만 지운다', () => {
    // Given
    const { files, service, drafts, storage } = createService();
    const releasedNotes = Object.values(RELEASED_VOICE_NOTE_DRAFTS);
    const recordedAtMs = Date.parse('2026-12-04T00:00:00.000Z');
    releasedNotes.forEach((released) => {
      storage.set(`aido_voice_note_draft_v1:user-1:${released.draftId}`, JSON.stringify(released));
      released.recordings.forEach(({ fileName }) =>
        files.addFile(OWNER_DIRECTORY, fileName, { modifiedAtMs: recordedAtMs }),
      );
    });
    files.addFile(OWNER_DIRECTORY, 'orphan-0.wav', { modifiedAtMs: recordedAtMs });

    // When
    service.removeExpired('user-1');

    // Then
    expect(files.listFiles(OWNER_DIRECTORY).map(({ name }) => name)).toEqual(
      releasedNotes.flatMap(({ recordings }) => recordings.map(({ fileName }) => fileName)),
    );
    expect(drafts.findAll('user-1')).toHaveLength(releasedNotes.length);
  });

  describe('녹음 저장 공간', () => {
    const createNoteWithRecording = (draftId: string, createdAt: string) =>
      createSpokenVoiceNote({
        draftId,
        createdAt: toInstant(createdAt),
        digest: createVoiceNoteDigest(),
        recordings: [
          { fileName: `${draftId}-0.wav`, startMs: 0 },
          { fileName: `${draftId}-1.wav`, startMs: 60_000 },
        ],
      });

    const setUp = () => {
      const { files, service, drafts } = createService();
      files.addFile(OWNER_DIRECTORY, 'a-0.wav', { sizeBytes: 1_000 });
      files.addFile(OWNER_DIRECTORY, 'a-1.wav', { sizeBytes: 500 });
      files.addFile(OWNER_DIRECTORY, 'b-0.wav', { sizeBytes: 2_000 });
      files.addFile(OWNER_DIRECTORY, 'orphan.wav', { sizeBytes: 300 });
      drafts.save('user-1', createNoteWithRecording('a', '2026-11-01T00:00:00.000Z'));
      drafts.save('user-1', createNoteWithRecording('b', '2026-11-02T00:00:00.000Z'));
      return { files, service, drafts };
    };

    it('메모에 속한 녹음만 합쳐 전체 용량과 메모별 용량을 최근 순으로 알려 준다', () => {
      // Given
      const { service } = setUp();

      // When
      const usage = service.getRecordingUsage('user-1');

      // Then
      expect(usage.totalBytes).toBe(3_500);
      expect(usage.notes.map(({ note, bytes }) => [note.draftId, bytes])).toEqual([
        ['b', 2_000],
        ['a', 1_500],
      ]);
    });

    it('한 메모의 녹음을 지워도 글자와 요약은 남고 다시 듣기만 없어진다', () => {
      // Given
      const { files, service, drafts } = setUp();

      // When
      service.removeRecordings('user-1', 'a');

      // Then
      const note = drafts.find('user-1', 'a');
      expect(note?.sentences).toHaveLength(1);
      expect(note?.digest?.summary).toBe(createVoiceNoteDigest().summary);
      expect(note != null && VoiceNotePolicy.canPlayRecording(note)).toBe(false);
      expect(files.hasFile(OWNER_DIRECTORY, 'a-0.wav')).toBe(false);
      expect(files.hasFile(OWNER_DIRECTORY, 'a-1.wav')).toBe(false);
      expect(files.hasFile(OWNER_DIRECTORY, 'b-0.wav')).toBe(true);
    });

    it('모두 지우면 어느 메모에도 속하지 않은 파일까지 지우고 메모는 남긴다', () => {
      // Given
      const { files, service, drafts } = setUp();

      // When
      service.removeAllRecordings('user-1');

      // Then
      expect(service.getRecordingUsage('user-1')).toEqual({ totalBytes: 0, notes: [] });
      expect(files.hasFile(OWNER_DIRECTORY, 'orphan.wav')).toBe(false);
      expect(drafts.findAll('user-1')).toHaveLength(2);
    });
  });

  describe('키체인이 잠겨 초안 저장소를 열지 못한 실행', () => {
    const createLockedDi = async () => {
      const secureStorage = createMemoryKeyValueStorage();
      secureStorage.get.mockRejectedValue(new KeychainLockedError(new Error('locked')));
      const { draftStorage } = await openEncryptedStorage(secureStorage, null);
      const files = createLocalFileSystemFake();
      const di = createTestDi({
        ports: { draftStorage, queryCacheStorage: null, localFileSystem: files },
      });
      return { di, files };
    };

    it('녹음을 모두 지워도 이번 실행에 읽지 못한 초안의 녹음은 남긴다', async () => {
      // Given
      const { di, files } = await createLockedDi();
      files.addFile(OWNER_DIRECTORY, 'recorded-now-0.wav');
      files.addFile(OWNER_DIRECTORY, 'saved-before-0.wav');
      di.voiceNoteDraftRepository.save(
        'user-1',
        createSpokenVoiceNote({
          draftId: 'recorded-now',
          recordings: [{ fileName: 'recorded-now-0.wav', startMs: 0 }],
        }),
      );

      // When
      di.voiceNoteStorageService.removeAllRecordings('user-1');

      // Then
      expect(files.hasFile(OWNER_DIRECTORY, 'recorded-now-0.wav')).toBe(false);
      expect(files.hasFile(OWNER_DIRECTORY, 'saved-before-0.wav')).toBe(true);
      expect(di.voiceNoteDraftRepository.findAll('user-1')).toHaveLength(1);
    });
  });
});
