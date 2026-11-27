import type { AppLogger } from '@src/core/ports/app-logger';
import type { LocalFileEntry, LocalFileSystem } from '@src/core/ports/local-file-system';
import { type Instant } from '@src/shared/date/instant';
import { getErrorMessage } from '@src/shared/errors/to-error';

import { VOICE_LOG_EVENT } from '../constants/voice-log-events';
import {
  VOICE_RECORDING_EXTENSION,
  VOICE_RECORDING_ROOT_DIRECTORY,
} from '../constants/voice-note.constants';
import { isRecordingFileExpired } from '../domains/voice-note.model';

interface SaveRecordingInput {
  accountId: string;
  draftId: string;
  partIndex: number;
  sourceUri: string;
}

export interface VoiceRecordingRepository {
  /** 인식기가 파일을 쓸 폴더. 만들지 못하면 null이라 다시 듣기 없이 글자만 남긴다 */
  prepareDirectory(accountId: string): string | null;
  /** 인식기가 쓰기 시작한 파일을 이 초안이 맡는다. 다 쓰이면 맡은 초안만 받는다. 옮기기를 마치면 저절로 풀리고, 지우거나 그만 기다리면 `releaseSource`로 놓는다 */
  reserveSource(sourceUri: string, draftId: string): void;
  releaseSource(sourceUri: string, draftId: string): void;
  /** 이 파일을 맡은 초안. 맡은 곳이 없으면 null이라 받은 쪽이 옮긴다 */
  findSourceOwner(sourceUri: string): string | null;
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
  logger: Pick<AppLogger, 'warn' | 'info'>,
): VoiceRecordingRepository {
  /** 지금 옮기는 중인 원본. 옮기기가 끝나면 지워 쌓이지 않는다 */
  const movingSourceUris = new Set<string>();
  /** 쓰는 중이거나 옮기는 중인 원본을 맡은 초안. 옮기기를 마치거나 그만 기다리면 지워 쌓이지 않는다 */
  const sourceOwners = new Map<string, string>();

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

    // 화면이 내려간 뒤 새 녹음 화면의 구독이 먼저 받아도 앞 녹음의 파일이 새 메모에 붙지 않게, 먼저 맡은 초안이 주인이다
    reserveSource: (sourceUri, draftId) => {
      if (!sourceOwners.has(sourceUri)) {
        sourceOwners.set(sourceUri, draftId);
      }
    },

    releaseSource: (sourceUri, draftId) => {
      if (sourceOwners.get(sourceUri) === draftId) {
        sourceOwners.delete(sourceUri);
      }
    },

    findSourceOwner: (sourceUri) => sourceOwners.get(sourceUri) ?? null,

    save: async ({ accountId, draftId, partIndex, sourceUri }) => {
      // 맡은 초안이 있는 파일은 다른 초안이 여기까지 오지 않는다. 시작 신호가 없어 아무도 맡지 못한 파일만 먼저 옮기기 시작한 쪽이 옮긴다
      if (movingSourceUris.has(sourceUri)) {
        // 건너뛴 쪽이 앞 녹음이면 조각이 다른 메모에 붙는다. 맡지 못한 파일이 실제로 겹쳐 오는지 볼 수 있게 남긴다
        logger.info(VOICE_LOG_EVENT.RECORDING_SHARED_SOURCE_SKIPPED);
        return null;
      }
      try {
        movingSourceUris.add(sourceUri);
        const fileName = `${encodeURIComponent(draftId)}-${partIndex}.${getExtension(sourceUri)}`;
        files.ensureDirectory(createOwnerDirectory(accountId));
        await files.moveFile(sourceUri, createOwnerDirectory(accountId), fileName);
        return fileName;
      } catch (error) {
        logger.warn(VOICE_LOG_EVENT.RECORDING_SAVE_FAILED, {
          stage: 'move',
          error: getErrorMessage(error),
        });
        return null;
      } finally {
        movingSourceUris.delete(sourceUri);
        if (sourceOwners.get(sourceUri) === draftId) {
          sourceOwners.delete(sourceUri);
        }
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
          !referencedFileNames.has(file.name) && isRecordingFileExpired(file.modifiedAtMs, now),
      );
      for (const file of expired) {
        removeSafely(directory, file.name);
      }
    },

    removeAllExceptOwner: (accountId) => {
      try {
        const ownerName = encodeURIComponent(accountId);
        const otherOwnerNames = files.listDirectoryNames(ROOT).filter((name) => name !== ownerName);
        for (const name of otherOwnerNames) {
          files.removeDirectory([...ROOT, name]);
        }
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
