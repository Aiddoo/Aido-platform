import { Directory, File } from 'expo-file-system';

import { expoLocalFileSystem } from './expo-local-file-system';

const mockCreate = jest.fn();
const mockList = jest.fn();

jest.mock('expo-file-system', () => {
  const toUri = (parts: (string | { uri: string })[]) =>
    parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');

  class Directory {
    uri: string;
    exists = true;
    name = 'folder';
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = toUri(parts);
    }
    create = mockCreate;
    list = mockList;
  }
  class File {
    uri: string;
    name = 'file';
    size = 0;
    lastModified: number | null = null;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = toUri(parts);
    }
  }

  return { Directory, File, Paths: { document: { uri: 'file:///documents' } } };
});

function createFile(fields: { name: string; size: number; lastModified: number | null }) {
  return Object.assign(new File(`file:///documents/${fields.name}`), fields);
}

describe('expoLocalFileSystem', () => {
  beforeEach(() => {
    mockList.mockReset();
  });

  it('폴더는 문서 폴더 아래에 중간 폴더까지 만들고 이미 있어도 실패하지 않는다', () => {
    // Given
    const directory = ['voice-notes', 'user-1'];

    // When
    const uri = expoLocalFileSystem.ensureDirectory(directory);

    // Then
    expect(uri).toBe('file:///documents/voice-notes/user-1');
    expect(mockCreate).toHaveBeenCalledWith({ intermediates: true, idempotent: true });
  });

  it('목록에서 파일만 골라 크기와 수정 시각을 읽는다', () => {
    // Given
    mockList.mockReturnValue([
      new Directory('sub'),
      createFile({ name: 'a.wav', size: 1_900, lastModified: Date.UTC(2026, 10, 1) }),
      createFile({ name: 'b.wav', size: 0, lastModified: null }),
    ]);

    // When
    const files = expoLocalFileSystem.listFiles(['voice-notes']);

    // Then
    expect(files).toEqual([
      {
        name: 'a.wav',
        uri: 'file:///documents/a.wav',
        sizeBytes: 1_900,
        modifiedAt: new Date('2026-11-01T00:00:00.000Z'),
      },
      { name: 'b.wav', uri: 'file:///documents/b.wav', sizeBytes: 0, modifiedAt: null },
    ]);
  });
});
