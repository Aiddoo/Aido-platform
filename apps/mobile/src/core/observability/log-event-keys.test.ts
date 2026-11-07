import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(__dirname, '../..');
const KEY_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/;

const sourcePaths = readdirSync(SRC_ROOT, { recursive: true, encoding: 'utf8' }).filter(
  (path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path),
);

const logEventFiles = sourcePaths.filter((path) => path.endsWith('log-events.ts'));

describe('로그 이벤트 키', () => {
  it('상수 파일이 있다', () => {
    // Then
    expect(logEventFiles.length).toBeGreaterThan(0);
  });

  it.each(logEventFiles)('%s의 키는 feature.action.result 세 마디다', (path) => {
    // Given
    const source = readFileSync(join(SRC_ROOT, path), 'utf8');
    const keys = [...source.matchAll(/:\s*'([a-z0-9.-]+)'/g)].map(([, key]) => key ?? '');

    // When
    const malformed = keys.filter((key) => !KEY_FORMAT.test(key));

    // Then
    expect(keys.length).toBeGreaterThan(0);
    expect(malformed).toEqual([]);
  });

  it.each(logEventFiles)('%s는 *_LOG_EVENT 상수 하나를 내보낸다', (path) => {
    // Given
    const source = readFileSync(join(SRC_ROOT, path), 'utf8');

    // When
    const exported = [...source.matchAll(/export const (\w+)/g)].map(([, name]) => name ?? '');

    // Then
    expect(exported).toHaveLength(1);
    expect(exported[0]).toMatch(/_LOG_EVENT$/);
  });

  it('logger 호출은 문자열 리터럴 대신 상수를 쓴다', () => {
    // Given
    const literalCall = /\blogger\.(?:debug|info|warn|error)\(\s*['"`]/;

    // When
    const offenders = sourcePaths.filter((path) =>
      literalCall.test(readFileSync(join(SRC_ROOT, path), 'utf8')),
    );

    // Then
    expect(offenders).toEqual([]);
  });
});
