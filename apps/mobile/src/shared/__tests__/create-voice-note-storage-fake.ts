import type { DIContainer } from '@src/bootstrap/providers/di-context';
import {
  createVoiceNoteDraftRepository,
  type VoiceNoteDraftRepository,
} from '@src/features/voice/apis/voice-note-draft.repository';
import { VoiceNoteStorageService } from '@src/features/voice/apis/voice-note-storage.service';
import {
  createVoiceRecordingRepository,
  type VoiceRecordingRepository,
} from '@src/features/voice/apis/voice-recording.repository';
import { getNowInstant } from '@src/shared/date/instant';

import {
  createLocalFileSystemFake,
  type LocalFileSystemFake,
} from './create-local-file-system-fake';
import { createLoggerStub } from './create-logger-stub';
import { createMemorySyncStorage } from './create-memory-sync-storage';

export interface VoiceNoteStorageFake {
  service: VoiceNoteStorageService;
  drafts: VoiceNoteDraftRepository;
  recordings: VoiceRecordingRepository;
  /** 같은 저장소를 쓰는 DI 세 항목. `di`에 펼친다 */
  di: Pick<
    DIContainer,
    'voiceNoteStorageService' | 'voiceNoteDraftRepository' | 'voiceRecordingRepository'
  >;
}

export const createVoiceNoteStorageFake = (
  files: LocalFileSystemFake = createLocalFileSystemFake(),
): VoiceNoteStorageFake => {
  const logger = createLoggerStub();
  const drafts = createVoiceNoteDraftRepository({
    storage: createMemorySyncStorage(),
    logger,
    getTimeZone: () => 'Asia/Seoul',
  });
  const recordings = createVoiceRecordingRepository(files, logger);
  const service = new VoiceNoteStorageService(drafts, recordings, getNowInstant);

  return {
    service,
    drafts,
    recordings,
    di: {
      voiceNoteStorageService: service,
      voiceNoteDraftRepository: drafts,
      voiceRecordingRepository: recordings,
    },
  };
};
