import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const APP_ROOT = resolve(__dirname, '../../../..');
const SOURCE_ROOTS = ['src', 'app'].map((folder) => join(APP_ROOT, folder));
const SKIPPED_FOLDERS = new Set(['node_modules', '__tests__', 'testing']);
const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;
const DECLARATION_FILE = /(\.events|event-map)\.ts$/;
const APP_EVENT_MAP_BLOCK = /interface AppEventMap\s*\{([\s\S]*?)\n\s*\}\n/g;

function listSourceFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_FOLDERS.has(entry.name) ? [] : listSourceFiles(path);
    }
    return SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name) ? [path] : [];
  });
}

/** 선언 블록의 첫 칸과 같은 들여쓰기의 키만 이벤트 이름이다. 더 깊은 키는 파라미터다 */
function readDeclaredEventNames(source: string): string[] {
  return [...source.matchAll(APP_EVENT_MAP_BLOCK)].flatMap(([, body = '']) => {
    const indent = /\n( +)\w+\??:/.exec(body)?.[1] ?? '';
    return [...body.matchAll(new RegExp(`^${indent}(\\w+)\\??:`, 'gm'))].flatMap(([, name]) =>
      name == null ? [] : [name],
    );
  });
}

/**
 * `AppEventMap`은 타입이라 실행 중에는 목록이 없다. 선언 파일(`*.events.ts`·`event-map.ts`)을 글자로 읽어 이름을 모으고,
 * 테스트·선언 밖 운영 코드에 그 이름이 문자열로 한 번이라도 있는지 본다. 지운 기능의 이벤트가 선언에만 남아
 * GA 콘솔·측정 계획이 아무도 보내지 않는 이벤트를 기다리지 않게 한다
 */
describe('AppEventMap 선언과 기록', () => {
  const files = SOURCE_ROOTS.flatMap(listSourceFiles);
  const declarationFiles = files.filter((file) => DECLARATION_FILE.test(file));
  const readDeclaredNames = () =>
    new Set(declarationFiles.flatMap((file) => readDeclaredEventNames(readFileSync(file, 'utf8'))));

  it('기능 선언과 앱 공통 선언에서 이벤트 이름만 읽고 파라미터 키는 빼다', () => {
    // When
    const declaredNames = readDeclaredNames();

    // Then
    expect(declaredNames.size).toBeGreaterThan(100);
    expect(declaredNames).toContain('feature_action_success');
    expect(declaredNames).toContain('todo_import_completed');
    expect(declaredNames).not.toContain('created_bucket');
  });

  it('선언한 이벤트는 모두 운영 코드 어딘가에서 이름으로 기록한다', () => {
    // Given
    const productionSource = files
      .filter((file) => !DECLARATION_FILE.test(file))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    // When
    const unusedNames = [...readDeclaredNames()].filter(
      (name) => !productionSource.includes(`'${name}'`),
    );

    // Then
    expect(unusedNames).toEqual([]);
  });
});
