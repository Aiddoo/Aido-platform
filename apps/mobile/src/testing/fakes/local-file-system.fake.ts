import type { LocalFileEntry, LocalFileSystem } from '@src/core/ports/local-file-system';

interface FakeFile {
  sizeBytes: number;
  modifiedAtMs: number | null;
}

export interface LocalFileSystemFake extends LocalFileSystem {
  addFile(directory: readonly string[], name: string, file?: Partial<FakeFile>): string;
  hasFile(directory: readonly string[], name: string): boolean;
  /** 다음 moveFile 호출을 이 오류로 실패시킨다 */
  failNextMove(error: Error): void;
  /** 다음 ensureDirectory 호출을 이 오류로 실패시킨다 */
  failNextEnsureDirectory(error: Error): void;
}

const ROOT = 'file:///documents/';
function toKey(directory: readonly string[]) {
  return directory.join('/');
}

function toUri(directory: readonly string[], name: string) {
  return `${ROOT}${[...directory, name].join('/')}`;
}

/** 메모리 안 파일 시스템. 폴더는 파일이 생기거나 ensureDirectory를 부르면 생긴다 */
export function createLocalFileSystemFake(): LocalFileSystemFake {
  const directories = new Map<string, Map<string, FakeFile>>();
  let pendingMoveError: Error | undefined;
  let pendingEnsureError: Error | undefined;

  const ensure = (directory: readonly string[]) => {
    const key = toKey(directory);
    const files = directories.get(key) ?? new Map<string, FakeFile>();
    directories.set(key, files);
    return files;
  };

  const readUriName = (uri: string) => {
    const parts = uri.slice(ROOT.length).split('/');
    return { directory: parts.slice(0, -1), name: parts.at(-1) ?? '' };
  };

  return {
    addFile: (directory, name, file = {}) => {
      ensure(directory).set(name, { sizeBytes: 0, modifiedAtMs: null, ...file });
      return toUri(directory, name);
    },
    hasFile: (directory, name) => directories.get(toKey(directory))?.has(name) ?? false,
    failNextMove: (error) => {
      pendingMoveError = error;
    },
    failNextEnsureDirectory: (error) => {
      pendingEnsureError = error;
    },
    ensureDirectory: (directory) => {
      if (pendingEnsureError != null) {
        const error = pendingEnsureError;
        pendingEnsureError = undefined;
        throw error;
      }
      ensure(directory);
      return `${ROOT}${toKey(directory)}/`;
    },
    listFiles: (directory) =>
      [...(directories.get(toKey(directory))?.entries() ?? [])].map(
        ([name, file]): LocalFileEntry => ({ name, uri: toUri(directory, name), ...file }),
      ),
    listDirectoryNames: (directory) => {
      const prefix = `${toKey(directory)}/`;
      return [
        ...new Set(
          [...directories.keys()]
            .filter((key) => key.startsWith(prefix))
            .map((key) => key.slice(prefix.length).split('/')[0] ?? ''),
        ),
      ];
    },
    findFileUri: (directory, name) =>
      directories.get(toKey(directory))?.has(name) === true ? toUri(directory, name) : null,
    moveFile: async (sourceUri, directory, name) => {
      if (pendingMoveError != null) {
        const error = pendingMoveError;
        pendingMoveError = undefined;
        throw error;
      }
      const source = readUriName(sourceUri);
      const sourceFiles = directories.get(toKey(source.directory));
      const file = sourceFiles?.get(source.name);
      if (sourceFiles == null || file == null) {
        throw new Error('원본 파일이 없습니다');
      }
      sourceFiles.delete(source.name);
      ensure(directory).set(name, file);
      return toUri(directory, name);
    },
    removeFile: (directory, name) => {
      directories.get(toKey(directory))?.delete(name);
    },
    removeFileAt: (uri) => {
      const { directory, name } = readUriName(uri);
      directories.get(toKey(directory))?.delete(name);
    },
    removeDirectory: (directory) => {
      const prefix = toKey(directory);
      for (const key of Array.from(directories.keys())) {
        if (key === prefix || key.startsWith(`${prefix}/`)) {
          directories.delete(key);
        }
      }
    },
  };
}
