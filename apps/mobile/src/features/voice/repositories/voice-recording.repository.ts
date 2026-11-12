import type { AppLogger } from '@src/core/ports/app-logger';
import type { LocalFileEntry, LocalFileSystem } from '@src/core/ports/local-file-system';
import { type Instant } from '@src/shared/date/instant';
import { getErrorMessage } from '@src/shared/errors/to-error';

import { VOICE_LOG_EVENT } from '../constants/voice-log-events';
import {
  VOICE_RECORDING_EXTENSION,
  VOICE_RECORDING_ROOT_DIRECTORY,
} from '../constants/voice-note.constants';
import { VoiceRecordingFilePolicy } from '../domains/voice-note.model';

interface SaveRecordingInput {
  accountId: string;
  draftId: string;
  partIndex: number;
  sourceUri: string;
}

export interface VoiceRecordingRepository {
  /** 인식기가 파일을 쓸 폴더. 만들지 못하면 null이라 다시 듣기 없이 글자만 남긴다 */
  prepareDirectory(accountId: string): string | null;
  /** 인식기가 쓴 파일을 초안 이름으로 옮기고 파일 이름을 돌려준다. 실패하면 null이다 */
  save(input: SaveRecordingInput): Promise<string | null>;
  findUri(accountId: string, fileName: string): string | null;
  remove(accountId: string, fileName: string): void;
  /** 초안으로 옮기기 전의 파일을 지운다. 이미 지운 초안의 늦은 파일이 정리 때까지 남지 않게 한다 */
  removeSource(sourceUri: string): void;
  /** 파일 이름별 크기(바이트) */
  getFileSizes(accountId: string): Record<string, number>;
  removeOwned(accountId: string): void;
  removeExpired(accountId: string, now: Instant, referencedFileNames: ReadonlySet<string>): void;
  removeAllExceptOwner(accountId: string): void;
  removeAll(): void;
}

const ROOT = [VOICE_RECORDING_ROOT_DIRECTORY] as const;
function createOwnerDirectory(accountId: string) {
  return [...ROOT, encodeURIComponent(accountId)];
}

function getExtension(uri: string) {
  return /\.([a-z0-9]{1,5})$/i.exec(uri)?.[1]?.toLowerCase() ?? VOICE_RECORDING_EXTENSION;
}

export function createVoiceRecordingRepository(
  files: LocalFileSystem,
  logger: Pick<AppLogger, 'warn'>,
): VoiceRecordingRepository {
  const logRemoveFailed = (error: unknown) => {
    logger.warn(VOICE_LOG_EVENT.RECORDING_REMOVE_FAILED, { error: getErrorMessage(error) });
  };

  const removeSafely = (directory: readonly string[], name: string) => {
    try {
      files.removeFile(directory, name);
    } catch (error) {
      logRemoveFailed(error);
    }
  };

  const listSafely = (directory: readonly string[]): readonly LocalFileEntry[] => {
    try {
      return files.listFiles(directory);
    } catch (error) {
      logger.warn(VOICE_LOG_EVENT.RECORDING_READ_FAILED, { error: getErrorMessage(error) });
      return [];
    }
  };

  return {
    prepareDirectory: (accountId) => {
      try {
        return files.ensureDirectory(createOwnerDirectory(accountId));
      } catch (error) {
        logger.warn(VOICE_LOG_EVENT.RECORDING_SAVE_FAILED, {
          stage: 'prepare',
          error: getErrorMessage(error),
        });
        return null;
      }
    },

    save: async ({ accountId, draftId, partIndex, sourceUri }) => {
      const fileName = `${encodeURIComponent(draftId)}-${partIndex}.${getExtension(sourceUri)}`;
      try {
        files.ensureDirectory(createOwnerDirectory(accountId));
        await files.moveFile(sourceUri, createOwnerDirectory(accountId), fileName);
        return fileName;
      } catch (error) {
        logger.warn(VOICE_LOG_EVENT.RECORDING_SAVE_FAILED, {
          stage: 'move',
          error: getErrorMessage(error),
        });
        return null;
      }
    },

    findUri: (accountId, fileName) => {
      try {
        return files.findFileUri(createOwnerDirectory(accountId), fileName);
      } catch (error) {
        logger.warn(VOICE_LOG_EVENT.RECORDING_READ_FAILED, {
          error: getErrorMessage(error),
        });
        return null;
      }
    },

    remove: (accountId, fileName) => removeSafely(createOwnerDirectory(accountId), fileName),

    removeSource: (sourceUri) => {
      try {
        files.removeFileAt(sourceUri);
      } catch (error) {
        logRemoveFailed(error);
      }
    },

    getFileSizes: (accountId) =>
      Object.fromEntries(
        listSafely(createOwnerDirectory(accountId)).map((file) => [file.name, file.sizeBytes]),
      ),

    removeOwned: (accountId) => {
      try {
        files.removeDirectory(createOwnerDirectory(accountId));
      } catch (error) {
        logger.warn(VOICE_LOG_EVENT.RECORDING_CLEANUP_FAILED, {
          error: getErrorMessage(error),
        });
      }
    },

    removeExpired: (accountId, now, referencedFileNames) => {
      const directory = createOwnerDirectory(accountId);
      const expired = listSafely(directory).filter(
        (file) =>
          !referencedFileNames.has(file.name) &&
          VoiceRecordingFilePolicy.isRecordingFileExpired(file, now),
      );
      expired.forEach((file) => removeSafely(directory, file.name));
    },

    removeAllExceptOwner: (accountId) => {
      try {
        const ownerName = encodeURIComponent(accountId);
        files
          .listDirectoryNames(ROOT)
          .filter((name) => name !== ownerName)
          .forEach((name) => files.removeDirectory([...ROOT, name]));
      } catch (error) {
        logger.warn(VOICE_LOG_EVENT.RECORDING_CLEANUP_FAILED, {
          error: getErrorMessage(error),
        });
      }
    },

    removeAll: () => {
      try {
        files.removeDirectory(ROOT);
      } catch (error) {
        logger.warn(VOICE_LOG_EVENT.RECORDING_CLEANUP_FAILED, {
          error: getErrorMessage(error),
        });
      }
    },
  };
}
