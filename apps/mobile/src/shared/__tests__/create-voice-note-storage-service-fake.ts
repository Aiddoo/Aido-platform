import { createVoiceNoteDraftRepository } from '@src/features/voice/apis/voice-note-draft.repository';
import { VoiceNoteStorageService } from '@src/features/voice/apis/voice-note-storage.service';
import { createVoiceRecordingRepository } from '@src/features/voice/apis/voice-recording.repository';

import { createLocalFileSystemFake } from './create-local-file-system-fake';
import { createMemorySyncStorage } from './create-memory-sync-storage';

export const createVoiceNoteStorageServiceFake = (): VoiceNoteStorageService => {
  const logger = { warn: jest.fn() };

  return new VoiceNoteStorageService(
    createVoiceNoteDraftRepository({ storage: createMemorySyncStorage(), logger }),
    createVoiceRecordingRepository(createLocalFileSystemFake(), logger),
  );
};
