import { createLocalFileSystemFake, createMemorySyncStorage } from '@src/shared/__tests__';

import { createVoiceNoteFixture } from '../__tests__/voice-note.factories';
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
    files.addFile(OWNER_DIRECTORY, 'draft-1.wav');
    service.drafts.save('user-1', createVoiceNoteFixture());

    // When
    service.discard('user-1', 'draft-1');

    // Then
    expect(service.drafts.find('user-1', 'draft-1')).toBeUndefined();
    expect(files.hasFile(OWNER_DIRECTORY, 'draft-1.wav')).toBe(false);
  });

  test('30일이 지난 초안은 녹음과 함께 지우고 최근 초안은 남긴다', () => {
    // Given
    const { files, service } = createService();
    files.addFile(OWNER_DIRECTORY, 'draft-1.wav', {
      modifiedAt: new Date('2026-11-01T00:00:00.000Z'),
    });
    files.addFile(OWNER_DIRECTORY, 'draft-2.wav', {
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
    expect(service.drafts.findAll('user-1').map((note) => note.recordingFileName)).toEqual([
      'draft-2.wav',
    ]);
    expect(files.hasFile(OWNER_DIRECTORY, 'draft-1.wav')).toBe(false);
    expect(files.hasFile(OWNER_DIRECTORY, 'draft-2.wav')).toBe(true);
  });
});
