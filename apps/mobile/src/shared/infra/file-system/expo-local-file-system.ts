import type { LocalFileEntry, LocalFileSystem } from '@src/core/ports/local-file-system';
import { Directory, File, Paths } from 'expo-file-system';

function openDirectory(directory: readonly string[]) {
  return new Directory(Paths.document, ...directory);
}

function toEntry(file: File): LocalFileEntry {
  const lastModified = file.lastModified;

  return {
    name: file.name,
    uri: file.uri,
    sizeBytes: file.size,
    modifiedAtMs: lastModified ?? null,
  };
}

export const expoLocalFileSystem: LocalFileSystem = {
  ensureDirectory: (directory) => {
    const target = openDirectory(directory);
    target.create({ intermediates: true, idempotent: true });
    return target.uri;
  },

  listFiles: (directory) => {
    const target = openDirectory(directory);
    if (!target.exists) {
      return [];
    }
    return target
      .list()
      .filter((item): item is File => item instanceof File)
      .map(toEntry);
  },

  listDirectoryNames: (directory) => {
    const target = openDirectory(directory);
    if (!target.exists) {
      return [];
    }
    return target
      .list()
      .filter((item): item is Directory => item instanceof Directory)
      .map((item) => item.name);
  },

  findFileUri: (directory, name) => {
    const file = new File(openDirectory(directory), name);
    return file.exists ? file.uri : null;
  },

  moveFile: async (sourceUri, directory, name) => {
    const destination = new File(openDirectory(directory), name);
    await new File(sourceUri).move(destination, { overwrite: true });
    return destination.uri;
  },

  removeFile: (directory, name) => {
    const file = new File(openDirectory(directory), name);
    if (file.exists) {
      file.delete();
    }
  },

  removeFileAt: (uri) => {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  },

  removeDirectory: (directory) => {
    const target = openDirectory(directory);
    if (target.exists) {
      target.delete();
    }
  },
};
