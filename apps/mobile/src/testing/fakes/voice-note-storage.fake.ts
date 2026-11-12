import type { DIContainer } from '@src/bootstrap/providers/di-context';
import type { AppLogger } from '@src/core/ports/app-logger';
import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';
import {
  createVoiceNoteDraftRepository,
  type VoiceNoteDraftRepository,
} from '@src/features/voice/repositories/voice-note-draft.repository';
import {
  createVoiceRecordingRepository,
  type VoiceRecordingRepository,
} from '@src/features/voice/repositories/voice-recording.repository';
import { VoiceNoteStorageService } from '@src/features/voice/services/voice-note-storage.service';
import { getNowInstant } from '@src/shared/date/clock';

import { createLoggerStub } from '../ports/logger.stub';
import { createLocalFileSystemFake, type LocalFileSystemFake } from './local-file-system.fake';
import { createMemorySyncStorage } from './memory-sync-storage.fake';

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

interface VoiceNoteStorageFakeOptions {
  /** 초안을 남기는 저장소. 운영은 암호화 초안 저장소 하나를 다른 초안과 함께 쓴다 */
  storage?: EnumerableSyncStorage;
  logger?: AppLogger;
}

export function createVoiceNoteStorageFake(
  files: LocalFileSystemFake = createLocalFileSystemFake(),
  {
    storage = createMemorySyncStorage(),
    logger = createLoggerStub(),
  }: VoiceNoteStorageFakeOptions = {},
): VoiceNoteStorageFake {
  const drafts = createVoiceNoteDraftRepository({
    storage,
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
}
