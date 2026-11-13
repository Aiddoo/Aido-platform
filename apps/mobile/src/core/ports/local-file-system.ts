export interface LocalFileEntry {
  name: string;
  uri: string;
  sizeBytes: number;
  /** 마지막 수정 시각(epoch ms). core는 shared의 Instant를 모르므로 포트는 다른 포트처럼 ms로 준다. 알 수 없으면 null */
  modifiedAtMs: number | null;
}

/**
 * 앱 문서 폴더 아래의 파일. 시스템이 용량이 부족할 때 지우는 캐시 폴더가 아니라 앱이 직접 지울 때까지 남는다.
 * 폴더는 문서 폴더를 기준으로 한 이름 구간(`['voice-notes', accountId]`)으로 가리킨다.
 * 지우기는 이미 없어도 성공으로 본다.
 */
export interface LocalFileSystem {
  /** 폴더를 만들고(이미 있으면 그대로) `file://` URI를 돌려준다 */
  ensureDirectory(directory: readonly string[]): string;
  listFiles(directory: readonly string[]): readonly LocalFileEntry[];
  listDirectoryNames(directory: readonly string[]): readonly string[];
  findFileUri(directory: readonly string[], name: string): string | null;
  /** 같은 이름이 있으면 덮어쓰고 새 URI를 돌려준다 */
  moveFile(sourceUri: string, directory: readonly string[], name: string): Promise<string>;
  removeFile(directory: readonly string[], name: string): void;
  /** 앱이 이름을 정하지 않은 파일(인식기가 쓴 녹음 등)을 URI로 지운다 */
  removeFileAt(uri: string): void;
  removeDirectory(directory: readonly string[]): void;
}
