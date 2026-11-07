import { createVoiceNoteDraftRepository } from '@src/features/voice/apis/voice-note-draft.repository';
import { VoiceNoteStorageService } from '@src/features/voice/apis/voice-note-storage.service';
import { createVoiceRecordingRepository } from '@src/features/voice/apis/voice-recording.repository';
import { getNowInstant } from '@src/shared/date/instant';

import {
  createLocalFileSystemFake,
  type LocalFileSystemFake,
} from './create-local-file-system-fake';
import { createMemorySyncStorage } from './create-memory-sync-storage';

export const createVoiceNoteStorageServiceFake = (
  files: LocalFileSystemFake = createLocalFileSystemFake(),
): VoiceNoteStorageService => {
  const logger = { warn: jest.fn() };

  return new VoiceNoteStorageService(
    createVoiceNoteDraftRepository({
      storage: createMemorySyncStorage(),
      logger,
      getTimeZone: () => 'Asia/Seoul',
    }),
    createVoiceRecordingRepository(files, logger),
    getNowInstant,
  );
};
