import { createLocalFileSystemFake, createMemorySyncStorage } from '@src/shared/__tests__';

import { createVoiceNoteDigest, createVoiceNoteFixture } from '../__tests__/voice-note.factories';
import { VoiceNotePolicy } from '../domains/voice-note.model';
import { createVoiceNoteDraftRepository } from './voice-note-draft.repository';
import { VoiceNoteStorageService } from './voice-note-storage.service';
import { createVoiceRecordingRepository } from './voice-recording.repository';

const NOW = new Date('2026-12-05T00:00:00.000Z');
const OWNER_DIRECTORY = ['voice-notes', 'user-1'];

function createService() {
  const logger = { warn: jest.fn() };
  const files = createLocalFileSystemFake();
  const service = new VoiceNoteStorageService(
    createVoiceNoteDraftRepository({ storage: createMemorySyncStorage(), logger }),
    createVoiceRecordingRepository(files, logger),
    () => NOW,
  );

  return { files, service };
}

describe('VoiceNoteStorageService', () => {
  test('초안을 버리면 그 녹음 파일도 함께 지운다', () => {
    // Given
    const { files, service } = createService();
    files.addFile(OWNER_DIRECTORY, 'draft-1-0.wav');
    service.drafts.save('user-1', createVoiceNoteFixture());

    // When
    service.discard('user-1', 'draft-1');

    // Then
    expect(service.drafts.find('user-1', 'draft-1')).toBeUndefined();
    expect(files.hasFile(OWNER_DIRECTORY, 'draft-1-0.wav')).toBe(false);
  });

  test('아직 쓰지 않은 대기 쓰기만 있는 초안을 버려도 나중에 되살아나지 않는다', () => {
    // Given
    jest.useFakeTimers();
    const { service } = createService();
    service.drafts.scheduleSave('user-1', createVoiceNoteFixture());

    // When
    service.discard('user-1', 'draft-1');
    jest.advanceTimersByTime(10_000);

    // Then
    expect(service.drafts.find('user-1', 'draft-1')).toBeUndefined();
    jest.useRealTimers();
  });

  test('30일이 지난 초안은 녹음과 함께 지우고 최근 초안은 남긴다', () => {
    // Given
    const { files, service } = createService();
    files.addFile(OWNER_DIRECTORY, 'draft-1-0.wav', {
      modifiedAt: new Date('2026-11-01T00:00:00.000Z'),
    });
    files.addFile(OWNER_DIRECTORY, 'draft-2-0.wav', {
      modifiedAt: new Date('2026-12-01T00:00:00.000Z'),
    });
    service.drafts.save('user-1', createVoiceNoteFixture());
    service.drafts.save(
      'user-1',
      createVoiceNoteFixture({
        draftId: 'draft-2',
        createdAt: new Date('2026-12-01T00:00:00.000Z'),
      }),
    );

    // When
    service.removeExpired('user-1');

    // Then
    expect(service.drafts.findAll('user-1').map((note) => note.draftId)).toEqual(['draft-2']);
    expect(files.hasFile(OWNER_DIRECTORY, 'draft-1-0.wav')).toBe(false);
    expect(files.hasFile(OWNER_DIRECTORY, 'draft-2-0.wav')).toBe(true);
  });

  describe('녹음 저장 공간', () => {
    const createNoteWithRecording = (draftId: string, createdAt: string) =>
      createVoiceNoteFixture({
        draftId,
        createdAt: new Date(createdAt),
        digest: createVoiceNoteDigest(),
        recordings: [
          { fileName: `${draftId}-0.wav`, startMs: 0 },
          { fileName: `${draftId}-1.wav`, startMs: 60_000 },
        ],
      });

    const setUp = () => {
      const { files, service } = createService();
      files.addFile(OWNER_DIRECTORY, 'a-0.wav', { sizeBytes: 1_000 });
      files.addFile(OWNER_DIRECTORY, 'a-1.wav', { sizeBytes: 500 });
      files.addFile(OWNER_DIRECTORY, 'b-0.wav', { sizeBytes: 2_000 });
      files.addFile(OWNER_DIRECTORY, 'orphan.wav', { sizeBytes: 300 });
      service.drafts.save('user-1', createNoteWithRecording('a', '2026-11-01T00:00:00.000Z'));
      service.drafts.save('user-1', createNoteWithRecording('b', '2026-11-02T00:00:00.000Z'));
      return { files, service };
    };

    test('전체 용량과 메모별 용량을 최근 순으로 알려 준다', () => {
      // Given
      const { service } = setUp();

      // When
      const usage = service.getRecordingUsage('user-1');

      // Then
      expect(usage.totalBytes).toBe(3_800);
      expect(usage.notes.map(({ note, bytes }) => [note.draftId, bytes])).toEqual([
        ['b', 2_000],
        ['a', 1_500],
      ]);
    });

    test('한 메모의 녹음을 지워도 글자와 요약은 남고 다시 듣기만 없어진다', () => {
      // Given
      const { files, service } = setUp();

      // When
      service.removeRecordings('user-1', 'a');

      // Then
      const note = service.drafts.find('user-1', 'a');
      expect(note?.sentences).toHaveLength(1);
      expect(note?.digest?.summary).toBe(createVoiceNoteDigest().summary);
      expect(note != null && VoiceNotePolicy.canPlayRecording(note)).toBe(false);
      expect(files.hasFile(OWNER_DIRECTORY, 'a-0.wav')).toBe(false);
      expect(files.hasFile(OWNER_DIRECTORY, 'a-1.wav')).toBe(false);
      expect(files.hasFile(OWNER_DIRECTORY, 'b-0.wav')).toBe(true);
    });

    test('모두 지우면 어느 메모에도 속하지 않은 파일까지 지우고 메모는 남긴다', () => {
      // Given
      const { files, service } = setUp();

      // When
      service.removeAllRecordings('user-1');

      // Then
      expect(service.getRecordingUsage('user-1')).toEqual({ totalBytes: 0, notes: [] });
      expect(files.hasFile(OWNER_DIRECTORY, 'orphan.wav')).toBe(false);
      expect(service.drafts.findAll('user-1')).toHaveLength(2);
    });
  });
});
