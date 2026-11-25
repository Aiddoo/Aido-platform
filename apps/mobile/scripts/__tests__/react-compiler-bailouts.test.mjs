import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const APP_ROOT = path.resolve(import.meta.dirname, '../..');
// 앱 번들과 같은 컴파일러 옵션을 쓰려고 babel-preset-expo가 넘기는 설정 그대로 돌린다
const PRESET_PATH = require.resolve('babel-preset-expo', { paths: [APP_ROOT] });
const babel = require(require.resolve('@babel/core', { paths: [PRESET_PATH] }));

// React Compiler가 건너뛰는 파일. 이 파일의 메모(useMemo·useCallback)는 이유 주석과 함께 손으로 둔다
const KNOWN_BAILOUTS = [
  // try…finally, catch 없는 try, try 안 조건식
  'src/features/device/store-review/hooks/use-store-review-moment.ts',
  'src/features/identity/auth/components/email-verification-code-step.tsx',
  'src/features/notes/memo/components/memo-editor.tsx',
  'src/features/notification/hooks/use-push-notification-response.ts',
  'src/features/planning/composer/components/todo-edit-bottom-sheet.tsx',
  'src/features/planning/composer/hooks/use-add-todo-quick-voice.ts',
  'src/features/voice/hooks/use-dictation.ts',
  'src/shared/hooks/use-refresh.ts',
  // 훅을 prop 값으로 받는 DI
  'src/shared/providers/language-provider.tsx',
  'src/shared/providers/local-date-provider.tsx',
  // 매개변수 기본값에 둔 멤버 접근·JSX·함수
  'src/features/device/widget/components/widgets.android.tsx',
  'src/features/social/invite/components/invited-friend-list.tsx',
  'src/features/voice/hooks/use-start-voice-note.ts',
  'src/shared/ui/bottom-sheet/use-sheet-route.ts',
  'src/shared/ui/inline-alert/inline-alert.tsx',
  // 선언 전에 부르는 함수
  'src/features/voice/hooks/use-voice-capture-session.ts',
  'src/features/voice/hooks/use-voice-note-recording.ts',
];

function listSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(entryPath);
    }
    const isSource = /\.tsx?$/.test(entry.name) && !/\.(test|d)\.tsx?$/.test(entry.name);
    return isSource ? [entryPath] : [];
  });
}

function hasCompilerBailout(file) {
  const events = [];
  babel.transformSync(readFileSync(file, 'utf8'), {
    filename: file,
    configFile: false,
    babelrc: false,
    presets: [
      [
        PRESET_PATH,
        { 'react-compiler': { logger: { logEvent: (_file, event) => events.push(event) } } },
      ],
    ],
    caller: {
      name: 'metro',
      bundler: 'metro',
      platform: 'ios',
      isDev: false,
      isServer: false,
      supportsReactCompiler: true,
    },
  });
  return events.some(({ kind }) => kind === 'CompileError' || kind === 'PipelineError');
}

test('React Compiler가 건너뛰는 파일이 정해진 목록과 같다', () => {
  // Given
  const files = [
    ...listSourceFiles(path.join(APP_ROOT, 'src')),
    ...listSourceFiles(path.join(APP_ROOT, 'app')),
  ];

  // When
  const bailouts = files
    .filter(hasCompilerBailout)
    .map((file) => path.relative(APP_ROOT, file))
    .sort();

  // Then
  assert.deepEqual(bailouts, [...KNOWN_BAILOUTS].sort());
});
