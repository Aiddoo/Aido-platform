import type { LocalFileEntry, LocalFileSystem } from '@src/core/ports/local-file-system';
import type { Logger } from '@src/core/ports/logger';
import { getErrorMessage } from '@src/shared/errors/to-error';

import { VOICE_NOTE_LOG_EVENT } from '../constants/voice-note-log-events';
import {
  VOICE_RECORDING_EXTENSION,
  VOICE_RECORDING_ROOT_DIRECTORY,
} from '../constants/voice-note.constants';
import { isRecordingFileExpired } from '../domains/voice-note.model';

interface SaveRecordingInput {
  accountId: string;
  draftId: string;
  /** 초안의 몇 번째 조각인지. 멈췄다 이어 들으면 파일이 조각마다 하나다 */
  partIndex: number;
  /** 인식기가 `recording-saved`로 알려 준 파일 */
  sourceUri: string;
}

export interface VoiceRecordingRepository {
  /** 인식기가 파일을 쓸 폴더. 만들지 못하면 null이라 다시 듣기 없이 글자만 남긴다 */
  prepareDirectory(accountId: string): string | null;
  /** 인식기가 쓴 파일을 초안 이름으로 옮기고 파일 이름을 돌려준다. 실패하면 null이다 */
  save(input: SaveRecordingInput): Promise<string | null>;
  findUri(accountId: string, fileName: string): string | undefined;
  remove(accountId: string, fileName: string): void;
  /** 파일 이름별 크기(바이트) */
  getFileSizes(accountId: string): Record<string, number>;
  removeOwned(accountId: string): void;
  /** 초안이 가리키지 않고 보관 기한이 지난 파일을 지우고 지운 파일 이름을 돌려준다 */
  removeExpired(accountId: string, now: Date, referencedFileNames: ReadonlySet<string>): string[];
  removeAllExceptOwner(accountId: string): void;
  removeAll(): void;
}

const ROOT = [VOICE_RECORDING_ROOT_DIRECTORY] as const;
const ownerDirectory = (accountId: string) => [...ROOT, encodeURIComponent(accountId)];

const getExtension = (uri: string) =>
  /\.([a-z0-9]{1,5})$/i.exec(uri)?.[1]?.toLowerCase() ?? VOICE_RECORDING_EXTENSION;

export function createVoiceRecordingRepository(
  files: LocalFileSystem,
  logger: Pick<Logger, 'warn'>,
): VoiceRecordingRepository {
  const removeSafely = (directory: readonly string[], name: string) => {
    try {
      files.removeFile(directory, name);
    } catch (error) {
      logger.warn(VOICE_NOTE_LOG_EVENT.RECORDING_REMOVE_FAILED, { error: getErrorMessage(error) });
    }
  };

  const listSafely = (directory: readonly string[]): readonly LocalFileEntry[] => {
    try {
      return files.listFiles(directory);
    } catch (error) {
      logger.warn(VOICE_NOTE_LOG_EVENT.RECORDING_CLEANUP_FAILED, { error: getErrorMessage(error) });
      return [];
    }
  };

  return {
    prepareDirectory: (accountId) => {
      try {
        return files.ensureDirectory(ownerDirectory(accountId));
      } catch (error) {
        logger.warn(VOICE_NOTE_LOG_EVENT.RECORDING_SAVE_FAILED, {
          stage: 'prepare',
          error: getErrorMessage(error),
        });
        return null;
      }
    },

    save: async ({ accountId, draftId, partIndex, sourceUri }) => {
      const fileName = `${encodeURIComponent(draftId)}-${partIndex}.${getExtension(sourceUri)}`;
      try {
        files.ensureDirectory(ownerDirectory(accountId));
        await files.moveFile(sourceUri, ownerDirectory(accountId), fileName);
        return fileName;
      } catch (error) {
        logger.warn(VOICE_NOTE_LOG_EVENT.RECORDING_SAVE_FAILED, {
          stage: 'move',
          error: getErrorMessage(error),
        });
        return null;
      }
    },

    findUri: (accountId, fileName) => {
      try {
        return files.findFileUri(ownerDirectory(accountId), fileName);
      } catch (error) {
        logger.warn(VOICE_NOTE_LOG_EVENT.RECORDING_CLEANUP_FAILED, {
          error: getErrorMessage(error),
        });
        return undefined;
      }
    },

    remove: (accountId, fileName) => removeSafely(ownerDirectory(accountId), fileName),

    getFileSizes: (accountId) =>
      Object.fromEntries(
        listSafely(ownerDirectory(accountId)).map((file) => [file.name, file.sizeBytes]),
      ),

    removeOwned: (accountId) => {
      try {
        files.removeDirectory(ownerDirectory(accountId));
      } catch (error) {
        logger.warn(VOICE_NOTE_LOG_EVENT.RECORDING_REMOVE_FAILED, {
          error: getErrorMessage(error),
        });
      }
    },

    removeExpired: (accountId, now, referencedFileNames) => {
      const directory = ownerDirectory(accountId);
      const expired = listSafely(directory).filter(
        (file) =>
          !referencedFileNames.has(file.name) && isRecordingFileExpired(file.modifiedAt, now),
      );
      expired.forEach((file) => removeSafely(directory, file.name));
      return expired.map((file) => file.name);
    },

    removeAllExceptOwner: (accountId) => {
      try {
        const ownerName = encodeURIComponent(accountId);
        files
          .listDirectoryNames(ROOT)
          .filter((name) => name !== ownerName)
          .forEach((name) => files.removeDirectory([...ROOT, name]));
      } catch (error) {
        logger.warn(VOICE_NOTE_LOG_EVENT.RECORDING_CLEANUP_FAILED, {
          error: getErrorMessage(error),
        });
      }
    },

    removeAll: () => {
      try {
        files.removeDirectory(ROOT);
      } catch (error) {
        logger.warn(VOICE_NOTE_LOG_EVENT.RECORDING_CLEANUP_FAILED, {
          error: getErrorMessage(error),
        });
      }
    },
  };
}
