#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = resolve(MOBILE_ROOT, '../..');

/**
 * 서버만 바뀐 CI는 모바일 의존성을 설치하지 않는다(`install-scope: api`).
 * 같은 lockfile의 typescript를 서버 패키지에서 찾아 서버·공유 계약만 바뀐 PR에서도 이 검사가 돈다.
 */
function loadTypeScript() {
  for (const packageJson of ['apps/mobile/package.json', 'apps/api/package.json']) {
    try {
      return createRequire(resolve(REPOSITORY_ROOT, packageJson))('typescript');
    } catch {}
  }
  throw new Error(
    'typescript를 찾을 수 없습니다. pnpm install로 모바일 또는 서버 의존성을 설치하세요.',
  );
}

const ts = loadTypeScript();
const TODO_COMMENT_ROOT = 'apps/mobile/src/features/engagement/comment';
const FEATURE_AREAS = new Set([
  'app-config',
  'assistant',
  'billing',
  'device',
  'engagement',
  'identity',
  'insights',
  'notes',
  'planning',
  'social',
  'support',
]);
const TODO_COMMENT_COMPONENT_ROOT = `${TODO_COMMENT_ROOT}/components`;
const TODO_COMMENT_TEST_ROOTS = [
  `${TODO_COMMENT_ROOT}/constants/`,
  `${TODO_COMMENT_ROOT}/domains/`,
  `${TODO_COMMENT_ROOT}/apis/`,
  `${TODO_COMMENT_ROOT}/schemas/`,
  `${TODO_COMMENT_ROOT}/utils/navigation/`,
  `${TODO_COMMENT_ROOT}/utils/`,
  `${TODO_COMMENT_ROOT}/utils/view-models/`,
];
// 화면 동작 회귀(답글 아래 줄처럼 여러 Provider가 함께 정하는 것)만 공용 renderUi + 포트 stub으로 컴포넌트 옆에서 확인한다.
const TODO_COMMENT_COMPONENT_TEST_ROOT = `${TODO_COMMENT_ROOT}/components/`;
const RENDER_UI_MODULE = '@src/shared/__tests__/render-ui';
const TEST_TOOLS_MODULE = '@src/shared/__tests__';
const TODO_COMMENT_UI_TEST_MODULE_PREFIXES = [
  '@shopify/flash-list',
  '@src/shared/ui',
  '@testing-library/',
  'expo-router',
  'heroui-native',
  'react-native',
];
const TODO_ROUTE_ROOT = 'apps/mobile/app/(app)/todo/[todoId]';
// 댓글은 할 일 상세(`/todo/[todoId]`) 한 화면이다. `comments/[commentId].tsx`는 1.14.0 이하 링크를 옮기는 Redirect뿐이다.
// 답글 펼침·작성기는 같은 화면 안에서 바꾸므로 그 아래 route나 전용 layout을 두지 않는다.
const FORBIDDEN_ROUTE_PATHS = [
  'apps/mobile/app/(app)/todo/[todoId]/_layout.tsx',
  'apps/mobile/app/(app)/todo/[todoId]/comment',
  'apps/mobile/app/(app)/todo/[todoId]/comments/_layout.tsx',
  'apps/mobile/app/(app)/todo/[todoId]/comments/[commentId]',
];
// 댓글 위에 뜨는 신고 시트는 댓글 단계가 아니라 moderation sheet route라 예전 경로 아래에 둔다.
const ALLOWED_TODO_COMMENT_ROUTE_FILES = new Set([
  'apps/mobile/app/(app)/todo/[todoId]/comments/[commentId]/report.tsx',
]);
const TODO_COMMENT_NAVIGATION_OWNER = `${TODO_COMMENT_ROOT}/hooks/use-todo-comment-params.ts`;
const ROUTE_IDENTIFIER_PROP_NAMES = new Set([
  'anchorCommentId',
  'commentId',
  'focusCommentId',
  'parentId',
  'rootId',
  'threadId',
  'todoId',
]);
const QUERY_HOOK_NAMES = new Set([
  'useInfiniteQuery',
  'useMutation',
  'useQuery',
  'useSuspenseQuery',
]);

// 1.15부터 손댄 모델은 자기 Zod 스키마를 갖고, 요청·응답 계약(@aido/api 루트·contracts)은 apis의 service·mapper만 안다.
// 용어 튜플·상수(vocabulary)와 ErrorCode(errors)는 서버와 같은 값을 쓰도록 모델에서도 import한다.
// 한꺼번에 옮기면 리뷰할 수 없어 옮긴 폴더·파일부터 이 목록에 올린다.
const MODEL_SCHEMA_NAME = /^[a-z][A-Za-z]*Schema$/u;
const DOMAIN_MODEL_FILE = /\/domains\/[^/]+\.model\.ts$/u;

const CLIENT_OWNED_MODEL_PATHS = [
  'apps/mobile/src/features/weather/components/',
  'apps/mobile/src/features/weather/constants/',
  'apps/mobile/src/features/weather/domains/',
  'apps/mobile/src/features/weather/hooks/',
  'apps/mobile/src/features/weather/queries/',
  'apps/mobile/src/features/weather/utils/',
  'apps/mobile/src/features/notes/memo/components/',
  'apps/mobile/src/features/notes/memo/constants/',
  'apps/mobile/src/features/notes/memo/domains/',
  'apps/mobile/src/features/notes/memo/hooks/',
  'apps/mobile/src/features/notes/memo/queries/',
  'apps/mobile/src/features/notes/memo/utils/',
  'apps/mobile/src/features/support/inquiry/constants/',
  'apps/mobile/src/features/support/inquiry/hooks/',
  'apps/mobile/src/features/support/inquiry/queries/',
  'apps/mobile/src/features/insights/achievement/constants/',
  'apps/mobile/src/features/insights/achievement/domains/',
  'apps/mobile/src/features/insights/achievement/hooks/',
  'apps/mobile/src/features/insights/achievement/queries/',
  'apps/mobile/src/features/insights/achievement/utils/',
  'apps/mobile/src/features/device/activation/components/',
  'apps/mobile/src/features/device/activation/constants/',
  'apps/mobile/src/features/device/activation/domains/',
  'apps/mobile/src/features/device/activation/hooks/',
  'apps/mobile/src/features/device/activation/queries/',
  'apps/mobile/src/features/identity/preference/constants/',
  'apps/mobile/src/features/identity/preference/domains/',
  'apps/mobile/src/features/identity/preference/queries/',
  'apps/mobile/src/features/identity/user/components/',
  'apps/mobile/src/features/identity/user/constants/',
  'apps/mobile/src/features/identity/user/domains/',
  'apps/mobile/src/features/identity/user/hooks/',
  'apps/mobile/src/features/identity/user/queries/',
  'apps/mobile/src/features/identity/user/utils/',
  'apps/mobile/src/features/identity/consent/components/',
  'apps/mobile/src/features/identity/consent/constants/',
  'apps/mobile/src/features/identity/consent/domains/',
  'apps/mobile/src/features/identity/consent/hooks/',
  'apps/mobile/src/features/identity/consent/queries/',
  'apps/mobile/src/features/identity/auth/components/',
  'apps/mobile/src/features/identity/auth/constants/',
  'apps/mobile/src/features/identity/auth/domains/',
  'apps/mobile/src/features/identity/auth/hooks/',
  'apps/mobile/src/features/identity/auth/queries/',
  'apps/mobile/src/features/identity/auth/utils/',
  'apps/mobile/src/features/device/app-icon/components/',
  'apps/mobile/src/features/device/app-icon/constants/',
  'apps/mobile/src/features/device/app-icon/domains/',
  'apps/mobile/src/features/device/app-icon/queries/',
  'apps/mobile/src/features/app-config/app-version/components/',
  'apps/mobile/src/features/app-config/app-version/domains/',
  'apps/mobile/src/features/app-config/app-version/queries/',
  'apps/mobile/src/features/app-config/feature-campaign/constants/',
  'apps/mobile/src/features/app-config/feature-campaign/queries/',
  'apps/mobile/src/features/app-config/whats-new/components/',
  'apps/mobile/src/features/app-config/whats-new/constants/',
  'apps/mobile/src/features/app-config/whats-new/domains/',
  'apps/mobile/src/features/app-config/whats-new/hooks/',
  'apps/mobile/src/features/device/coachmark/components/',
  'apps/mobile/src/features/device/coachmark/constants/',
  'apps/mobile/src/features/device/coachmark/domains/',
  'apps/mobile/src/features/device/coachmark/hooks/',
  'apps/mobile/src/features/notification/components/',
  'apps/mobile/src/features/notification/constants/',
  'apps/mobile/src/features/notification/domains/',
  'apps/mobile/src/features/notification/hooks/',
  'apps/mobile/src/features/notification/queries/',
  'apps/mobile/src/features/notification/utils/',
  'apps/mobile/src/features/device/store-review/constants/',
  'apps/mobile/src/features/device/store-review/domains/',
  'apps/mobile/src/features/device/store-review/hooks/',
  'apps/mobile/src/features/device/store-review/utils/',
  'apps/mobile/src/features/social/moderation/constants/',
  'apps/mobile/src/features/social/moderation/domains/',
  'apps/mobile/src/features/social/moderation/queries/',
  'apps/mobile/src/features/insights/report/components/',
  'apps/mobile/src/features/insights/report/constants/',
  'apps/mobile/src/features/insights/report/queries/',
  'apps/mobile/src/features/insights/report/utils/',
  'apps/mobile/src/features/assistant/suggestion/components/',
  'apps/mobile/src/features/assistant/suggestion/constants/',
  'apps/mobile/src/features/assistant/suggestion/domains/',
  'apps/mobile/src/features/assistant/suggestion/queries/',
  'apps/mobile/src/features/social/friend/components/',
  'apps/mobile/src/features/social/friend/constants/',
  'apps/mobile/src/features/social/friend/domains/',
  'apps/mobile/src/features/social/friend/queries/',
  'apps/mobile/src/features/social/friend/utils/',
  'apps/mobile/src/features/social/nudge/constants/',
  'apps/mobile/src/features/social/nudge/queries/',
  'apps/mobile/src/features/social/nudge/utils/',
  'apps/mobile/src/features/billing/subscription/domains/customer-info.model.ts',
  'apps/mobile/src/features/billing/subscription/domains/entitlement.model.ts',
  'apps/mobile/src/features/engagement/comment/components/',
  'apps/mobile/src/features/engagement/comment/constants/',
  'apps/mobile/src/features/engagement/comment/domains/',
  'apps/mobile/src/features/engagement/comment/hooks/',
  'apps/mobile/src/features/engagement/comment/queries/',
  'apps/mobile/src/features/engagement/comment/utils/',
  'apps/mobile/src/features/planning/todo/components/',
  'apps/mobile/src/features/planning/todo/constants/',
  'apps/mobile/src/features/planning/todo/domains/',
  'apps/mobile/src/features/planning/todo/hooks/',
  'apps/mobile/src/features/planning/todo/queries/',
  'apps/mobile/src/features/planning/todo/utils/',
  'apps/mobile/src/features/planning/composer/components/',
  'apps/mobile/src/features/planning/composer/domains/',
  'apps/mobile/src/features/planning/composer/hooks/',
  'apps/mobile/src/features/planning/composer/queries/',
  'apps/mobile/src/features/planning/composer/utils/',
  'apps/mobile/src/features/voice/domains/',
  'apps/mobile/src/features/planning/category/components/',
  'apps/mobile/src/features/planning/category/constants/',
  'apps/mobile/src/features/planning/category/domains/',
  'apps/mobile/src/features/planning/category/hooks/',
  'apps/mobile/src/features/planning/category/queries/',
  'apps/mobile/src/features/social/nudge/components/',
  'apps/mobile/src/features/social/nudge/constants/',
  'apps/mobile/src/features/social/nudge/domains/',
  'apps/mobile/src/features/social/nudge/hooks/',
  'apps/mobile/src/features/social/nudge/queries/',
  'apps/mobile/src/features/social/nudge/utils/',
  'apps/mobile/src/features/social/invite/components/',
  'apps/mobile/src/features/social/invite/constants/',
  'apps/mobile/src/features/social/invite/domains/',
  'apps/mobile/src/features/social/invite/hooks/',
  'apps/mobile/src/features/social/invite/queries/',
  'apps/mobile/src/features/social/invite/utils/',
];
const SCHEMA_FOLDER_FEATURE_PATHS = [
  'apps/mobile/src/features/notes/memo/',
  'apps/mobile/src/features/voice/',
  'apps/mobile/src/features/support/inquiry/',
  'apps/mobile/src/features/insights/achievement/',
  'apps/mobile/src/features/device/activation/',
  'apps/mobile/src/features/identity/preference/',
  'apps/mobile/src/features/identity/user/',
  'apps/mobile/src/features/identity/consent/',
  'apps/mobile/src/features/identity/auth/',
  'apps/mobile/src/features/billing/subscription/apis/',
  'apps/mobile/src/features/billing/subscription/components/',
  'apps/mobile/src/features/billing/subscription/domains/',
  'apps/mobile/src/features/billing/subscription/queries/',
  'apps/mobile/src/features/billing/subscription/utils/',
  'apps/mobile/src/features/device/app-icon/',
  'apps/mobile/src/features/app-config/app-version/',
  'apps/mobile/src/features/app-config/feature-campaign/',
  'apps/mobile/src/features/app-config/whats-new/',
  'apps/mobile/src/features/device/coachmark/',
  'apps/mobile/src/features/weather/',
  'apps/mobile/src/features/notification/',
  'apps/mobile/src/features/device/store-review/',
  'apps/mobile/src/features/planning/category/',
  'apps/mobile/src/features/social/nudge/',
  'apps/mobile/src/features/social/invite/',
  'apps/mobile/src/features/planning/todo/',
  'apps/mobile/src/features/planning/composer/',
  'apps/mobile/src/features/social/moderation/apis/',
  'apps/mobile/src/features/social/moderation/components/',
  'apps/mobile/src/features/social/moderation/constants/',
  'apps/mobile/src/features/social/moderation/domains/',
  'apps/mobile/src/features/social/moderation/hooks/',
  'apps/mobile/src/features/social/moderation/queries/',
  'apps/mobile/src/features/insights/report/apis/',
  'apps/mobile/src/features/insights/report/components/',
  'apps/mobile/src/features/insights/report/constants/',
  'apps/mobile/src/features/insights/report/queries/',
  'apps/mobile/src/features/insights/report/utils/',
  'apps/mobile/src/features/assistant/suggestion/apis/',
  'apps/mobile/src/features/assistant/suggestion/components/',
  'apps/mobile/src/features/assistant/suggestion/constants/',
  'apps/mobile/src/features/assistant/suggestion/queries/',
  'apps/mobile/src/features/social/friend/apis/',
  'apps/mobile/src/features/social/friend/components/',
  'apps/mobile/src/features/social/friend/constants/',
  'apps/mobile/src/features/social/friend/queries/',
  'apps/mobile/src/features/social/friend/utils/',
  'apps/mobile/src/features/social/nudge/constants/',
  'apps/mobile/src/features/social/nudge/queries/',
  'apps/mobile/src/features/social/nudge/utils/',
  'apps/mobile/src/features/social/invite/constants/',
  'apps/mobile/src/features/social/invite/queries/',
  'apps/mobile/src/features/social/invite/utils/',
  'apps/mobile/src/features/notification/apis/',
  'apps/mobile/src/features/notification/components/',
  'apps/mobile/src/features/notification/constants/',
  'apps/mobile/src/features/notification/domains/',
  'apps/mobile/src/features/notification/hooks/',
  'apps/mobile/src/features/notification/queries/',
  'apps/mobile/src/features/notification/utils/',
  'apps/mobile/src/features/engagement/comment/apis/',
  'apps/mobile/src/features/engagement/comment/components/',
  'apps/mobile/src/features/engagement/comment/constants/',
  'apps/mobile/src/features/engagement/comment/domains/',
  'apps/mobile/src/features/engagement/comment/hooks/',
  'apps/mobile/src/features/engagement/comment/queries/',
  'apps/mobile/src/features/engagement/comment/utils/',
];
const SHARED_CONTRACT_MODULE = '@aido/api';
const SHARED_CONTRACT_CONTRACTS_PREFIX = `${SHARED_CONTRACT_MODULE}/contracts/`;

const STRICT_NULLISH_ROOTS = ['apps/api/src', 'apps/mobile/src', 'apps/mobile/app'];
const STRICT_NULLISH_ALLOW_MARKER = 'nullish-strict:';
const STRICT_EQUALITY_OPERATORS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
]);

// 네이티브·외부 SDK는 shared/infra에서만 import한다(.claude/architecture.md#portadapterdi). 예외 목록은 두지 않는다.
// 이 목록에 넣지 않은 라이브러리와 이유:
// - expo-router: 라우트 파일과 화면의 앱 뼈대다. 라우터 교체는 route 전체를 바꾸는 일이라 포트로 숨기지 않는다.
// - UI 라이브러리(heroui-native, reanimated, gesture-handler, gorhom, expo-image, datetimepicker 등): 화면 그 자체다.
// - expo-widgets, @expo/ui, react-native-android-widget: 위젯은 네이티브가 직접 부르는 자기 조립 진입점이다.
// - expo-constants: 위젯 headless 진입이 scheme을 읽고 env.ts가 빌드 값을 읽는다. Provider 밖 시작 값이다.
// - expo-splash-screen: Provider가 뜨기 전부터 쓰는 부트스트랩 전용이다.
const SDK_MODULES = [
  'ky',
  'expo-auth-session',
  'expo-quick-actions',
  'expo-store-review',
  '@react-native-kakao/core',
  '@react-native-kakao/share',
  'expo-linking',
  'expo-application',
  'expo-device',
  'expo-secure-store',
  'expo-sharing',
  'expo-clipboard',
  'expo-haptics',
  'expo-notifications',
  'expo-speech-recognition',
  'react-native-purchases',
  'expo-audio',
  'expo-keep-awake',
  'expo-file-system',
  'expo-location',
  'react-native-mmkv',
  'expo-network',
  'expo-web-browser',
  'expo-apple-authentication',
  'expo-updates',
  'expo-localization',
  'expo-crypto',
  'react-native-view-shot',
  '@sentry/react-native',
  '@react-native-firebase/app',
  '@react-native-firebase/analytics',
];
const SDK_INFRA_ROOT = 'apps/mobile/src/shared/infra/';
// es-toolkit/compat은 lodash 호환 계층이라 메인 패키지보다 무겁다. 메인에 없는 기능만 이유와 함께 허용한다.
const ES_TOOLKIT_COMPAT_ALLOWLIST = new Set([
  // 메인 debounce에는 maxWait이 없어 입력이 계속돼도 초안이 저장되도록 compat을 쓴다.
  'apps/mobile/src/features/voice/apis/voice-note-draft.repository.ts',
]);

function checkEsToolkitCompatImports(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName).replaceAll('\\', '/');
  if (ES_TOOLKIT_COMPAT_ALLOWLIST.has(relativePath)) {
    return;
  }
  for (const statement of sourceFile.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith('es-toolkit/compat')
    ) {
      errors.push(
        `${getLocation(sourceFile, statement, repositoryRoot)} es-toolkit/compat 대신 메인 'es-toolkit'을 쓰세요. times는 range(n).map으로 바꿉니다.`,
      );
    }
  }
}

function getSdkModule(moduleName) {
  return SDK_MODULES.find((sdk) => moduleName === sdk || moduleName.startsWith(`${sdk}/`));
}

const FEATURE_SOURCE_ROOT = 'apps/mobile/src/features/';

// feature는 useTrack만 쓴다. 타입 이벤트 맵과 계정 정리 순서가 한 입구를 지나게 한다.
// 기기 저장 값은 그 값의 repository가 읽기·쓰기·구독을 모두 가진다. 키와 파서가 화면으로 새지 않게 한다.
const DEVICE_STORAGE_HOOKS = new Set(['useSyncStorageString']);

function checkFeatureAnalyticsPort(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName).replaceAll('\\', '/');
  const isScreen = relativePath.startsWith('apps/mobile/app/');
  if (!(relativePath.startsWith(FEATURE_SOURCE_ROOT) || isScreen) || isTestSource(relativePath)) {
    return;
  }
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue;
    }
    const namedBindings = statement.importClause?.namedBindings;
    if (namedBindings === undefined || !ts.isNamedImports(namedBindings)) {
      continue;
    }
    for (const element of namedBindings.elements) {
      const importedName = (element.propertyName ?? element.name).text;
      if (DEVICE_STORAGE_HOOKS.has(importedName)) {
        errors.push(
          `${getLocation(sourceFile, element, repositoryRoot)} ${importedName}로 기기 저장 값을 직접 읽지 않습니다. 그 값의 repository에 읽기·쓰기·subscribe를 두고 useSyncExternalStore로 구독하세요.`,
        );
      }
      if (!isScreen && importedName === 'useAnalytics') {
        errors.push(
          `${getLocation(sourceFile, element, repositoryRoot)} feature는 useAnalytics를 직접 쓰지 않습니다. useTrack을 쓰세요.`,
        );
      }
    }
  }
}

const MUTATION_OPTIONS_FILE = /\/queries\/[^/]+\.mutations\.tsx?$/u;

/** 실패 처리를 묶은 함수(`onError: showFailure`)는 호출부에서 햅틱·토스트·보고가 보이지 않는다 */
function checkInlineMutationErrorHandlers(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName).replaceAll('\\', '/');
  if (!MUTATION_OPTIONS_FILE.test(relativePath) || isTestSource(relativePath)) {
    return;
  }
  function visit(node) {
    if (
      ts.isPropertyAssignment(node) &&
      getPropertyName(node.name) === 'onError' &&
      !ts.isArrowFunction(node.initializer) &&
      !ts.isFunctionExpression(node.initializer)
    ) {
      errors.push(
        `${getLocation(sourceFile, node, repositoryRoot)} mutation onError는 햅틱·토스트를 그 자리에 나란히 적습니다. 실패 처리 함수로 묶지 않습니다.`,
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

const CACHE_HELPER_FILE = /\/queries\/[^/]+-cache\.ts$/u;
const CACHE_HELPER_FORBIDDEN_MODULE =
  /^@src\/core\/events\/|\/apis\/[^/]+\.service$|\/ports\/(error-reporter|logger)$/u;

/** `*-cache.ts`는 Query 캐시만 만진다. 이벤트 발행·오류 보고·Service 호출(기기 저장)은 호출부에 적는다 */
function checkCacheHelperPurity(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName).replaceAll('\\', '/');
  if (!CACHE_HELPER_FILE.test(relativePath) || isTestSource(relativePath)) {
    return;
  }
  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      CACHE_HELPER_FORBIDDEN_MODULE.test(statement.moduleSpecifier.text)
    ) {
      errors.push(
        `${getLocation(sourceFile, statement, repositoryRoot)} 캐시 helper는 Query 캐시만 만집니다. ${statement.moduleSpecifier.text}는 호출부(mutation)에서 씁니다.`,
      );
    }
  }
}

const JEST_MODULE_MOCK_METHODS = new Set(['mock', 'doMock', 'setMock']);

// 모듈 mock은 어댑터 테스트의 SDK와 jest.setup·moduleNameMapper의 네이티브 모듈만 쓴다. 허용 목록은 두지 않는다.
function checkJestModuleMocks(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName).replaceAll('\\', '/');
  if (!isTestSource(relativePath)) {
    return;
  }
  const isAdapterTest = relativePath.startsWith(SDK_INFRA_ROOT);

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'jest' &&
      JEST_MODULE_MOCK_METHODS.has(node.expression.name.text) &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      const moduleName = node.arguments[0].text;
      const isAppModule =
        moduleName.startsWith('@src/') || moduleName.startsWith('.') || moduleName.startsWith('@/');
      if (!isAdapterTest || isAppModule) {
        errors.push(
          `${getLocation(sourceFile, node, repositoryRoot)} ${moduleName}를 jest.mock하지 않습니다. 포트 stub과 createTestDi, renderUi를 쓰고, 네이티브 모듈은 jest.setup이나 moduleNameMapper에 둡니다.`,
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

function checkSdkImports(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName).replaceAll('\\', '/');
  if (relativePath.startsWith(SDK_INFRA_ROOT) || isTestSource(relativePath)) {
    return;
  }
  for (const statement of sourceFile.statements) {
    if (
      !(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) ||
      statement.moduleSpecifier === undefined ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const sdk = getSdkModule(statement.moduleSpecifier.text);
    if (sdk !== undefined) {
      errors.push(
        `${getLocation(sourceFile, statement, repositoryRoot)} ${sdk}는 shared/infra에서만 import합니다. 포트와 어댑터를 거쳐 DI 훅으로 받으세요. 라이브러리가 React 훅이면 경계 훅 파일 하나에 둡니다(.claude/architecture.md#portadapterdi).`,
      );
    }
  }
}

const MY_PAGE_MENU_PANE = 'apps/mobile/src/bootstrap/navigation/my-page-menu-pane.tsx';
const ROUTER_NAVIGATION_METHODS = new Set(['push', 'navigate', 'replace', 'dismissTo']);

/** 마이 탭 메뉴 칸이 그리는 기능 컴포넌트는 useMyPageMenuNavigate로만 이동한다. 직접 push하면 넓은 화면에서 오른쪽 칸을 바꾸지 않고 위에 쌓인다 */
function checkMyPageMenuNavigation(repositoryRoot, errors) {
  const panePath = resolve(repositoryRoot, MY_PAGE_MENU_PANE);
  if (!existsSync(panePath)) {
    return;
  }
  const pane = ts.createSourceFile(
    panePath,
    readFileSync(panePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const componentFiles = pane.statements
    .filter(ts.isImportDeclaration)
    .map((statement) => statement.moduleSpecifier)
    .filter(ts.isStringLiteral)
    .map((specifier) => specifier.text)
    .filter(
      (moduleName) =>
        moduleName.startsWith('@src/features/') && moduleName.includes('/components/'),
    )
    .flatMap((moduleName) =>
      ['.tsx', '.ts']
        .map((extension) =>
          resolve(
            repositoryRoot,
            `apps/mobile/src/${moduleName.slice('@src/'.length)}${extension}`,
          ),
        )
        .filter((file) => existsSync(file))
        .slice(0, 1),
    );

  for (const file of componentFiles) {
    const sourceFile = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node) => {
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'router' &&
        ROUTER_NAVIGATION_METHODS.has(node.name.text)
      ) {
        errors.push(
          `${getLocation(sourceFile, node, repositoryRoot)} 마이 탭 메뉴 칸의 항목은 router.${node.name.text} 대신 useMyPageMenuNavigate로 엽니다. 넓은 화면에서 오른쪽 칸을 바꾸고 선택 표시를 맞춥니다.`,
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
}

function getSourceFiles(root, relativeDirectory) {
  const directory = resolve(root, relativeDirectory);
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return getSourceFiles(root, relative(root, path));
    }
    if (!entry.isFile() || !/\.[cm]?[jt]sx?$/u.test(entry.name)) {
      return [];
    }
    return [path];
  });
}

function getLocation(sourceFile, node, repositoryRoot) {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${relative(repositoryRoot, sourceFile.fileName)}:${start.line + 1}:${start.character + 1}`;
}

function getPropertyName(name) {
  if (name === undefined) {
    return null;
  }
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }
  return null;
}

function getCallName(expression) {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  return null;
}

function isComponentName(name) {
  return name !== null && /^\p{Lu}/u.test(name);
}

function getBindingName(name) {
  return ts.isIdentifier(name) ? name.text : null;
}

function getAssignmentName(expression) {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  return null;
}

function isDefaultExportFunction(node) {
  if (!ts.isFunctionDeclaration(node) || node.name !== undefined) {
    return false;
  }
  return (
    node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ?? false
  );
}

function isComponentFunction(node) {
  if (
    (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) &&
    isComponentName(node.name?.text ?? null)
  ) {
    return true;
  }
  if (isDefaultExportFunction(node)) {
    return true;
  }

  let current = node;
  while (current.parent !== undefined) {
    const parent = current.parent;
    if (
      ts.isParenthesizedExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isSatisfiesExpression(parent)
    ) {
      current = parent;
      continue;
    }
    if (ts.isCallExpression(parent) && parent.arguments.some((argument) => argument === current)) {
      current = parent;
      continue;
    }
    if (ts.isVariableDeclaration(parent) && parent.initializer === current) {
      return isComponentName(getBindingName(parent.name));
    }
    if (
      ts.isBinaryExpression(parent) &&
      parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      parent.right === current
    ) {
      return isComponentName(getAssignmentName(parent.left));
    }
    if (ts.isExportAssignment(parent) && parent.expression === current) {
      return true;
    }
    return false;
  }
  return false;
}

function isPropsDeclaration(node) {
  return (
    (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
    node.name.text.endsWith('Props')
  );
}

function getPropsMembers(node) {
  if (ts.isInterfaceDeclaration(node)) {
    return node.members;
  }
  if (ts.isTypeLiteralNode(node.type)) {
    return node.type.members;
  }
  if (ts.isIntersectionTypeNode(node.type)) {
    return node.type.types.flatMap((type) => (ts.isTypeLiteralNode(type) ? [...type.members] : []));
  }
  return [];
}

function getInlinePropsMembers(type) {
  if (ts.isTypeLiteralNode(type)) {
    return [...type.members];
  }
  if (ts.isIntersectionTypeNode(type)) {
    return type.types.flatMap(getInlinePropsMembers);
  }
  if (ts.isParenthesizedTypeNode(type)) {
    return getInlinePropsMembers(type.type);
  }
  return [];
}

function checkIdentifierMembers(sourceFile, members, repositoryRoot, errors) {
  for (const member of members) {
    const propertyName = getPropertyName(member.name);
    if (propertyName !== null && ROUTE_IDENTIFIER_PROP_NAMES.has(propertyName)) {
      errors.push(
        `${getLocation(sourceFile, member, repositoryRoot)} 댓글 화면 식별자 ${propertyName}를 props로 전달하지 마세요. Expo Router의 검증된 route hook에서 직접 읽어야 합니다.`,
      );
    }
  }
}

function checkComponentProps(sourceFile, repositoryRoot, errors) {
  function visit(node) {
    if (isPropsDeclaration(node)) {
      checkIdentifierMembers(sourceFile, getPropsMembers(node), repositoryRoot, errors);
    }
    if (ts.isFunctionLike(node) && isComponentFunction(node)) {
      for (const parameter of node.parameters) {
        if (parameter.type !== undefined) {
          checkIdentifierMembers(
            sourceFile,
            getInlinePropsMembers(parameter.type),
            repositoryRoot,
            errors,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function checkTodoCheckboxProps(sourceFile, repositoryRoot, errors) {
  function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      node.tagName.text === 'TodoCheckbox'
    ) {
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute)) {
          continue;
        }
        const name = attribute.name.text;
        if (name === 'isChecked' || name === 'onCheckedChange') {
          errors.push(
            `${getLocation(sourceFile, attribute, repositoryRoot)} TodoCheckbox는 HeroUI Checkbox의 isSelected/onSelectedChange 계약을 그대로 사용해야 합니다.`,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function isRenderUiImport(statement) {
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
    return false;
  }
  if (statement.moduleSpecifier.text === RENDER_UI_MODULE) {
    return true;
  }
  const namedBindings = statement.importClause?.namedBindings;
  return (
    statement.moduleSpecifier.text === TEST_TOOLS_MODULE &&
    namedBindings !== undefined &&
    ts.isNamedImports(namedBindings) &&
    namedBindings.elements.some((element) => element.name.text.startsWith('renderUi'))
  );
}

function checkTodoCommentTestLocation(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName).replaceAll('\\', '/');
  if (!/\.(?:spec|test)\.[cm]?[jt]sx?$/u.test(relativePath)) {
    return;
  }
  if (TODO_COMMENT_TEST_ROOTS.some((root) => relativePath.startsWith(root))) {
    return;
  }
  if (
    relativePath.startsWith(TODO_COMMENT_COMPONENT_TEST_ROOT) &&
    sourceFile.statements.some(isRenderUiImport)
  ) {
    return;
  }

  errors.push(
    `${relativePath} 댓글 클라이언트 테스트는 model, service/mapper, pure navigation/util/view-model에만 둡니다. 컴포넌트 동작은 공용 renderUi로만 확인하고, hook, Provider, Query Options 배선을 테스트 코드로 복제하지 마세요.`,
  );
}

function isTodoCommentUiTestModule(moduleName) {
  return (
    moduleName === 'react' ||
    moduleName.startsWith('react/') ||
    TODO_COMMENT_UI_TEST_MODULE_PREFIXES.some((prefix) => moduleName.startsWith(prefix)) ||
    moduleName.includes('/components/') ||
    moduleName.includes('/hooks/') ||
    moduleName.includes('/providers/') ||
    moduleName.includes('/__tests__/render-ui')
  );
}

const TEST_QUERY_CLIENT_FACTORY = 'apps/mobile/src/shared/__tests__/query-client.ts';

function isTestSource(relativePath) {
  return (
    /\.(?:spec|test)\.[cm]?[jt]sx?$/u.test(relativePath) || relativePath.includes('/__tests__/')
  );
}

// 테스트 QueryClient는 공통 팩토리에서만 만든다. 각 테스트가 만들면 정리 타이머가 남아 Jest 종료를 붙잡는다.
function checkTestQueryClientFactory(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName).replaceAll('\\', '/');
  if (!isTestSource(relativePath) || relativePath === TEST_QUERY_CLIENT_FACTORY) {
    return;
  }
  const visit = (node) => {
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'QueryClient'
    ) {
      errors.push(
        `${getLocation(sourceFile, node, repositoryRoot)} 테스트에서 new QueryClient를 직접 만들지 말고 @src/shared/__tests__의 createTestQueryClient를 쓰세요.`,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

function checkTodoCommentTestPurity(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName).replaceAll('\\', '/');
  if (!/\.(?:spec|test)\.[cm]?[jt]sx?$/u.test(relativePath)) {
    return;
  }
  if (!TODO_COMMENT_TEST_ROOTS.some((root) => relativePath.startsWith(root))) {
    return;
  }

  const uiImport = sourceFile.statements.find(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      (isTodoCommentUiTestModule(statement.moduleSpecifier.text) || isRenderUiImport(statement)),
  );
  if (!relativePath.endsWith('x') && uiImport === undefined) {
    return;
  }

  errors.push(
    `${relativePath} 댓글 model/service/util 테스트에는 TSX나 React Native UI 배선을 넣지 마세요. UI 동작은 native 검증 행렬에서 확인합니다.`,
  );
}

function checkFeatureSource(sourceFile, repositoryRoot, errors) {
  const importedNames = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause === undefined) {
      continue;
    }
    const { importClause } = statement;
    if (importClause.name !== undefined) {
      importedNames.add(importClause.name.text);
    }
    if (importClause.namedBindings === undefined) {
      continue;
    }
    if (ts.isNamespaceImport(importClause.namedBindings)) {
      importedNames.add(importClause.namedBindings.name.text);
      continue;
    }
    for (const element of importClause.namedBindings.elements) {
      importedNames.add(element.name.text);
    }
  }

  function visit(node) {
    if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
      errors.push(
        `${getLocation(sourceFile, node, repositoryRoot)} 댓글 클라이언트에서는 다른 파일의 값을 다시 export하지 마세요. 소유 파일을 직접 import해야 변경 경로를 예측할 수 있습니다.`,
      );
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier === undefined &&
      node.exportClause !== undefined &&
      ts.isNamedExports(node.exportClause)
    ) {
      const reexportedNames = node.exportClause.elements
        .map((element) => element.propertyName?.text ?? element.name.text)
        .filter((name) => importedNames.has(name));
      if (reexportedNames.length > 0) {
        errors.push(
          `${getLocation(sourceFile, node, repositoryRoot)} 댓글 클라이언트에서는 가져온 값 ${reexportedNames.join(', ')}을 다시 export하지 마세요. 소유 파일을 직접 import해야 변경 경로를 예측할 수 있습니다.`,
        );
      }
    }
    if (
      ts.isExportAssignment(node) &&
      ts.isIdentifier(node.expression) &&
      importedNames.has(node.expression.text)
    ) {
      errors.push(
        `${getLocation(sourceFile, node, repositoryRoot)} 댓글 클라이언트에서는 가져온 값 ${node.expression.text}을 다시 export하지 마세요. 소유 파일을 직접 import해야 변경 경로를 예측할 수 있습니다.`,
      );
    }

    if (ts.isCallExpression(node)) {
      const callName = getCallName(node.expression);
      const firstArgument = node.arguments[0];
      if (
        callName !== null &&
        QUERY_HOOK_NAMES.has(callName) &&
        firstArgument !== undefined &&
        ts.isObjectLiteralExpression(firstArgument)
      ) {
        errors.push(
          `${getLocation(sourceFile, node, repositoryRoot)} ${callName} 옵션을 컴포넌트나 훅 안에 인라인으로 만들지 마세요. presentations/queries의 옵션 팩토리가 소유해야 합니다.`,
        );
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'router' &&
      node.expression.name.text === 'push' &&
      relative(repositoryRoot, sourceFile.fileName) !== TODO_COMMENT_NAVIGATION_OWNER
    ) {
      errors.push(
        `${getLocation(sourceFile, node, repositoryRoot)} 댓글 화면은 직접 push하지 않습니다. 댓글 위치는 use-todo-comment-params가 search로만 바꿉니다.`,
      );
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function getFeatureName(path) {
  const match = /\/src\/features\/([^/]+)\/(?:([^/]+)\/)?/u.exec(path);
  if (match === null) {
    return null;
  }
  const [, topLevel, nested] = match;
  return FEATURE_AREAS.has(topLevel) && nested !== undefined ? `${topLevel}/${nested}` : topLevel;
}

function checkCrossFeatureRelativeImports(sourceFile, repositoryRoot, errors) {
  const owner = getFeatureName(sourceFile.fileName);
  if (owner === null) {
    return;
  }
  for (const statement of sourceFile.statements) {
    if (
      !(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) ||
      statement.moduleSpecifier === undefined ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.moduleSpecifier.text.startsWith('.')
    ) {
      continue;
    }
    const target = getFeatureName(
      `${resolve(dirname(sourceFile.fileName), statement.moduleSpecifier.text)}/`,
    );
    if (target !== null && target !== owner) {
      errors.push(
        `${getLocation(sourceFile, statement, repositoryRoot)} 다른 피처(${target})는 상대경로가 아니라 @src/features/${target} 경로로 import하세요. 피처 경계가 검색과 리뷰에서 드러나야 합니다.`,
      );
    }
  }
}

function checkOwnFeatureAbsoluteImports(sourceFile, repositoryRoot, errors) {
  const owner = getFeatureName(sourceFile.fileName);
  if (owner === null) {
    return;
  }
  for (const statement of sourceFile.statements) {
    if (
      !(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) ||
      statement.moduleSpecifier === undefined ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.moduleSpecifier.text.startsWith('@src/features/')
    ) {
      continue;
    }
    const target = getFeatureName(`/${statement.moduleSpecifier.text.slice('@'.length)}/`);
    if (target === owner) {
      errors.push(
        `${getLocation(sourceFile, statement, repositoryRoot)} 자기 피처(${owner})는 @src/features 절대 경로가 아니라 상대 경로로 import하세요.`,
      );
    }
  }
}

function checkServerErrorReading(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName);
  if (
    !relativePath.startsWith('apps/mobile/src/features/') ||
    relativePath.endsWith('.error.ts') ||
    isTestSource(relativePath)
  ) {
    return;
  }
  function visit(node) {
    const isApiErrorImport =
      ts.isImportSpecifier(node) && (node.propertyName ?? node.name).text === 'isApiError';
    const isHasCodeCall =
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'hasCode';
    if (isApiErrorImport || isHasCodeCall) {
      errors.push(
        `${getLocation(sourceFile, node, repositoryRoot)} 서버 오류는 domains/{feature}.error.ts의 이름 있는 판별 함수로만 읽으세요. isApiError와 hasCode를 이 파일에서 직접 쓰지 않습니다.`,
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

// 공용 부품 이름(Avatar, BottomSheet, Button, Input, Text, TextArea)은 앱 안에서 하나의 뜻만 갖는다.
// shared/ui가 heroui-native 원본을 감싸므로, 그 밖에서 같은 이름을 heroui-native에서 가져오면 막는다.
const SHARED_UI_NAMES_OVER_HEROUI = new Set([
  'Avatar',
  'BottomSheet',
  'Button',
  'Input',
  'Text',
  'TextArea',
]);

const SPACING_PROP_NAMES = new Set([
  'p',
  'px',
  'py',
  'pt',
  'pb',
  'pl',
  'pr',
  'm',
  'mx',
  'my',
  'mt',
  'mb',
  'ml',
  'mr',
]);

function checkSpacingPropsWithClassName(sourceFile, repositoryRoot, errors) {
  if (!sourceFile.fileName.endsWith('.tsx')) {
    return;
  }
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const names = node.attributes.properties
        .filter(ts.isJsxAttribute)
        .map((attribute) => attribute.name.getText(sourceFile));
      const spacingNames = names.filter((name) => SPACING_PROP_NAMES.has(name));
      if (spacingNames.length > 0 && names.includes('className')) {
        errors.push(
          `${getLocation(sourceFile, node, repositoryRoot)} spacing prop(${spacingNames.join(', ')})과 className을 한 태그에 섞지 않습니다. 여백은 className으로 씁니다.`,
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function checkHerouiSharedNameImports(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName);
  if (
    !/^apps\/mobile\/(?:src|app)\//u.test(relativePath) ||
    relativePath.startsWith('apps/mobile/src/shared/ui/')
  ) {
    return;
  }
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== 'heroui-native' ||
      statement.importClause?.namedBindings === undefined ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }
    for (const element of statement.importClause.namedBindings.elements) {
      const importedName = (element.propertyName ?? element.name).text;
      if (SHARED_UI_NAMES_OVER_HEROUI.has(importedName)) {
        errors.push(
          `${getLocation(sourceFile, element, repositoryRoot)} heroui-native의 ${importedName} 대신 @src/shared/ui의 ${importedName}를 씁니다. 앱 안에서 같은 이름은 하나의 뜻만 갖습니다.`,
        );
      }
    }
  }
}

function checkCardComponentUsesCard(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName);
  if (
    !/^apps\/mobile\/src\/(?:features|shared\/ui)\/.+-card\.tsx$/u.test(relativePath) ||
    isTestSource(relativePath)
  ) {
    return;
  }
  const importsCard = sourceFile.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === 'heroui-native' &&
      statement.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        (element) => (element.propertyName ?? element.name).text === 'Card',
      ),
  );
  if (!importsCard) {
    errors.push(
      `${relativePath} 이름이 -card인 컴포넌트는 heroui-native Card를 써야 합니다. 목록 행이면 -row로, 다른 원본이면 그 원본 이름으로 바꾸세요.`,
    );
  }
}

function isWireContractModule(moduleName) {
  return (
    moduleName === SHARED_CONTRACT_MODULE || moduleName.startsWith(SHARED_CONTRACT_CONTRACTS_PREFIX)
  );
}

// 모델은 업무 규칙만 둔다. 문구·화면 부품·플랫폼은 view-model·컴포넌트·어댑터가 맡는다
function findModelPresentationImport(moduleName) {
  if (
    moduleName === '@src/shared/i18n' ||
    moduleName.startsWith('@src/shared/i18n/') ||
    moduleName === 'i18next' ||
    moduleName === 'react-i18next'
  ) {
    return '문구(i18n)';
  }
  if (moduleName === '@src/shared/ui' || moduleName.startsWith('@src/shared/ui/')) {
    return '화면 부품(shared/ui)';
  }
  if (moduleName === 'react-native' || moduleName.startsWith('react-native/')) {
    return '플랫폼(react-native)';
  }
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return 'React';
  }
  return null;
}

function checkClientOwnedModelImports(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName).replaceAll('\\', '/');
  const isDomainModel = DOMAIN_MODEL_FILE.test(relativePath);
  if (
    relativePath.includes('.test.') ||
    (!CLIENT_OWNED_MODEL_PATHS.some((path) => relativePath.startsWith(path)) && !isDomainModel)
  ) {
    return;
  }
  for (const statement of sourceFile.statements) {
    if (
      !(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) ||
      statement.moduleSpecifier === undefined ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const moduleName = statement.moduleSpecifier.text;
    if (isWireContractModule(moduleName)) {
      errors.push(
        `${getLocation(sourceFile, statement, repositoryRoot)} 클라이언트 모델은 요청·응답 계약(${moduleName})을 import하지 않습니다. 모델이 자기 Zod 스키마를 갖고 apis/*.mapper.ts가 DTO를 모델로 바꿔야 서버가 바뀌어도 mapper만 고칩니다. 용어 튜플·상수는 @aido/api/vocabulary, 오류 코드는 @aido/api/errors에서 가져오세요.`,
      );
      continue;
    }
    const presentation = isDomainModel ? findModelPresentationImport(moduleName) : null;
    if (presentation !== null) {
      errors.push(
        `${getLocation(sourceFile, statement, repositoryRoot)} 도메인 모델은 ${presentation}(${moduleName})을 import하지 않습니다. 모델과 Policy는 업무 규칙만 두고 문구·화면·플랫폼 값은 view-model·컴포넌트·어댑터가 맡습니다.`,
      );
    }
  }
}

function checkSchemaFolderImports(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName).replaceAll('\\', '/');
  if (
    isTestSource(relativePath) ||
    relativePath.includes('/schemas/') ||
    DOMAIN_MODEL_FILE.test(relativePath) ||
    !SCHEMA_FOLDER_FEATURE_PATHS.some((path) => relativePath.startsWith(path))
  ) {
    return;
  }
  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === 'zod'
    ) {
      errors.push(
        `${getLocation(sourceFile, statement, repositoryRoot)} Zod 스키마는 클라이언트 모델이면 domains/{entity}.model.ts, 폼·route·초안·서버와 공유하는 요청 타입이면 schemas/에 둡니다.`,
      );
    }
  }
}

function getPackageSourceRoots(repositoryRoot) {
  const packagesDirectory = resolve(repositoryRoot, 'packages');
  if (!existsSync(packagesDirectory)) {
    return [];
  }
  return readdirSync(packagesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}/src`);
}

function isNullishLiteral(node) {
  return (
    node.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(node) && node.text === 'undefined')
  );
}

function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
}

function getEnclosingStatement(node) {
  let current = node;
  while (
    current.parent !== undefined &&
    !ts.isSourceFile(current.parent) &&
    !ts.isBlock(current.parent) &&
    !ts.isModuleBlock(current.parent) &&
    !ts.isCaseClause(current.parent) &&
    !ts.isDefaultClause(current.parent) &&
    !ts.isClassElement(current)
  ) {
    current = current.parent;
  }
  return current;
}

/** 허용 표시는 비교가 있는 문장 바로 위 주석부터 비교가 있는 줄 사이에 둔다. 한 문장 안의 여러 PATCH 필드는 그 위 표시 하나로 설명한다 */
function hasStrictNullishAllowComment(sourceFile, lines, node, comparisonLine) {
  const statement = getEnclosingStatement(node);
  let firstLine = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line;
  while (firstLine > 0 && isCommentLine(lines[firstLine - 1])) {
    firstLine -= 1;
  }
  return lines
    .slice(firstLine, comparisonLine + 1)
    .some((line) => line.includes(STRICT_NULLISH_ALLOW_MARKER));
}

function checkStrictNullishComparisons(sourceFile, repositoryRoot, errors) {
  const lines = sourceFile.text.split('\n');

  function visit(node) {
    if (
      ts.isBinaryExpression(node) &&
      STRICT_EQUALITY_OPERATORS.has(node.operatorToken.kind) &&
      (isNullishLiteral(node.left) || isNullishLiteral(node.right))
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        node.operatorToken.getStart(sourceFile),
      );
      if (!hasStrictNullishAllowComment(sourceFile, lines, node, line)) {
        errors.push(
          `${getLocation(sourceFile, node.operatorToken, repositoryRoot)} "없음" 판단은 == null / != null로 쓰세요. null과 undefined의 뜻이 달라 엄격하게 비교해야 하면 비교가 있는 문장 바로 위나 같은 줄에 // ${STRICT_NULLISH_ALLOW_MARKER} <이유>를 남기세요. (docs/conventions/nullish.md)`,
        );
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

// 앱의 Hermes(260318099.0.5)에서 실측해 없는 표준 메서드. TS lib에는 있어 typecheck를 통과하고 호출한 순간 앱에서만 죽는다.
// 같은 시대의 toReversed·toSpliced·with·findLast·findLastIndex는 있다. jest.setup.ts도 같은 목록을 Node에서 지운다.
const SHARED_ROUTE_HOOKS = new Set([
  'apps/mobile/src/shared/hooks/use-route-params.ts',
  'apps/mobile/src/shared/hooks/use-view.ts',
]);
const ROUTE_PARAM_HOOK_FILE = /\/hooks\/use-[^/]*-params?\.tsx?$/u;

function isRouterSetParamsCall(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'router' &&
    node.expression.name.text === 'setParams'
  );
}

function isUseLocalSearchParamsCall(node) {
  return (
    node !== undefined &&
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'useLocalSearchParams'
  );
}

function isZodObjectCall(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'z' &&
    node.expression.name.text === 'object'
  );
}

/** URL 값은 `useRouteParams`와 `schemas/`의 스키마로 읽고 쓴다. 플랫폼 값과 이미지도 한 가지로 쓴다 */
function isSafeParseResult(sourceFile, name) {
  let isFound = false;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer !== undefined &&
      ts.isCallExpression(node.initializer) &&
      ts.isPropertyAccessExpression(node.initializer.expression) &&
      node.initializer.expression.name.text === 'safeParse'
    ) {
      isFound = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return isFound;
}

function checkRouteParamConventions(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName).replaceAll('\\', '/');
  if (isTestSource(relativePath)) {
    return;
  }

  const isSheetRoute =
    relativePath.startsWith('apps/mobile/app/') && sourceFile.text.includes('<SheetRouteScreen');

  function visit(node) {
    if (
      isSheetRoute &&
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'data' &&
      ts.isIdentifier(node.expression) &&
      isSafeParseResult(sourceFile, node.expression.text)
    ) {
      errors.push(
        `${getLocation(sourceFile, node, repositoryRoot)} 시트 route는 safeParse로 검증하고 Redirect만 합니다. 대상은 시트가 같은 스키마의 route 훅으로 읽습니다.`,
      );
    }
    if (
      isRouterSetParamsCall(node) &&
      !SHARED_ROUTE_HOOKS.has(relativePath) &&
      !ROUTE_PARAM_HOOK_FILE.test(relativePath)
    ) {
      errors.push(
        `${getLocation(sourceFile, node, repositoryRoot)} router.setParams는 use-*-param(s).ts 훅과 공용 훅에서만 부릅니다. useRouteParams의 setParams를 쓰세요.`,
      );
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      isUseLocalSearchParamsCall(node.initializer)
    ) {
      errors.push(
        `${getLocation(sourceFile, node, repositoryRoot)} useLocalSearchParams 결과를 구조 분해하지 마세요. schemas/의 스키마로 parse한 값을 씁니다.`,
      );
    }
    if (ROUTE_PARAM_HOOK_FILE.test(relativePath) && isZodObjectCall(node)) {
      errors.push(
        `${getLocation(sourceFile, node, repositoryRoot)} route 파라미터 스키마는 훅 파일이 아니라 schemas/{name}-params.schema.ts에 둡니다.`,
      );
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Platform' &&
      node.name.text === 'OS'
    ) {
      errors.push(
        `${getLocation(sourceFile, node, repositoryRoot)} Platform.OS 대신 process.env.EXPO_OS를 씁니다. 번들에서 안 쓰는 플랫폼 코드가 빠집니다.`,
      );
    }
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === 'react-native' &&
      node.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(node.importClause.namedBindings) &&
      node.importClause.namedBindings.elements.some(
        (element) => (element.propertyName ?? element.name).text === 'Image',
      )
    ) {
      errors.push(
        `${getLocation(sourceFile, node, repositoryRoot)} react-native의 Image 대신 @src/shared/ui의 Image를 씁니다.`,
      );
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

// 층이 낮을수록 아래다. core·shared(0)가 맨 아래, app·bootstrap이 맨 위다. 표의 근거는 .claude/architecture.md#층과-의존.
const FEATURE_LAYERS = new Map([
  ['identity/auth', 1],
  ['identity/user', 1],
  ['identity/preference', 1],
  ['identity/consent', 1],
  ['billing/subscription', 1],
  ['support/inquiry', 1],
  ['app-config/app-version', 1],
  ['app-config/feature-campaign', 1],
  ['device/app-icon', 1],
  ['planning/todo', 2],
  ['planning/category', 2],
  ['device/coachmark', 2],
  ['device/store-review', 2],
  ['voice', 3],
  ['engagement/comment', 3],
  ['social/friend', 3],
  ['social/nudge', 3],
  ['social/moderation', 3],
  ['assistant/suggestion', 3],
  ['insights/achievement', 3],
  ['insights/report', 3],
  ['app-config/whats-new', 3],
  ['device/widget', 3],
  ['planning/composer', 4],
  ['notes/memo', 4],
  ['weather', 4],
  ['notification', 4],
  ['social/invite', 4],
  ['device/activation', 4],
]);
// 다른 층 어디서든 가져와도 되는 것: 타입, Policy가 있는 모델, 캐시 무효화 함수
const ANY_LAYER_IMPORT_PATTERN = /\/(?:domains\/[^/]+\.model|queries\/[^/]+-cache)$/u;
const FORBIDDEN_COMPONENT_NAME = /(?:Body|Bodies|Frames?|Sections?|Blocks?|Wrappers?)$/u;
const XXX_OF_NAME = /^[a-z][A-Za-z0-9]*[a-z0-9]Of$/u;
// `getLimitFromError`·`toPlanFromDraft`처럼 값을 만드는 동사 뒤에 출처를 붙이는 꼴. `removeTodoFromList`·`openFromReentry`처럼
// 동작이 일어나는 곳을 말하는 이름은 뜻이 달라 둔다
const XXX_FROM_NAME =
  /^(?:get|to|create|find|with|calculate|parse|format|resolve|use)[A-Z][A-Za-z0-9]*From[A-Z][A-Za-z0-9]*$/u;
const TRY_NAME = /^try[A-Z]/u;
const FORM_INPUT_TYPE_NAME = /FormInput$/u;
const MUTATION_VARIABLES_TYPE_NAME = /(?:Params|Args)$/u;
const MUTATIONS_FILE = /\/queries\/[^/]+\.mutations\.ts$/u;
const POLICY_NAME = /Policy$/u;
const QUERY_KEY_FILE = /\/constants\/[^/]*query-keys\.ts$/u;
const ROLE_CONSTANTS = new Set(['USER_ROLE', 'PREMIUM_SOURCE']);
const ALLOWLIST_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'mobile-conventions-allowlist.json',
);
const EMPTY_ALLOWLIST = {};

const HERMES_MISSING_METHODS = new Map([
  ['toSorted', 'es-toolkit의 sortBy'],
  ['fromAsync', 'for await'],
]);

// 수직선 순서로 읽히게 범위 비교는 `min <= x && x <= max`로 쓴다.
const LOWER_THAN_OPERATORS = new Set([
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
]);
const GREATER_THAN_OPERATORS = new Set([
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
]);

function isOrderComparison(node) {
  return (
    ts.isBinaryExpression(node) &&
    (LOWER_THAN_OPERATORS.has(node.operatorToken.kind) ||
      GREATER_THAN_OPERATORS.has(node.operatorToken.kind))
  );
}

function getAndOperands(node) {
  if (ts.isParenthesizedExpression(node)) {
    return getAndOperands(node.expression);
  }
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    return [...getAndOperands(node.left), ...getAndOperands(node.right)];
  }
  return [node];
}

function isBoundOnRight(comparison) {
  return LOWER_THAN_OPERATORS.has(comparison.operatorToken.kind);
}

function isRangeInWrongOrder(sourceFile, first, second) {
  if (isBoundOnRight(first) === isBoundOnRight(second)) {
    return false;
  }
  if (first.left.getText(sourceFile) === second.left.getText(sourceFile)) {
    return !ts.isNumericLiteral(first.left);
  }
  return (
    first.right.getText(sourceFile) === second.right.getText(sourceFile) &&
    !ts.isNumericLiteral(first.right)
  );
}

function checkRangeComparisonOrder(sourceFile, repositoryRoot, errors) {
  function visit(node) {
    const isAndChainRoot =
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      !(
        ts.isBinaryExpression(node.parent) &&
        node.parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      );
    if (isAndChainRoot) {
      const operands = getAndOperands(node);
      for (const [index, operand] of operands.entries()) {
        const next = operands[index + 1];
        if (
          next !== undefined &&
          isOrderComparison(operand) &&
          isOrderComparison(next) &&
          isRangeInWrongOrder(sourceFile, operand, next)
        ) {
          errors.push(
            `${getLocation(sourceFile, operand, repositoryRoot)} 범위 비교는 왼쪽에서 오른쪽으로 읽히게 \`min <= x && x <= max\`로 쓰세요.`,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

// 판별 이름은 긍정으로 짓고 허용을 묻는 판별은 can*으로 쓴다(.claude/architecture.md의 이름 절).
// 호출부가 `!`를 붙일지 헷갈리게 하는 이름을 막는다. 가져온 이름과 구조 분해는 라이브러리와
// 서버 계약이 정한 이름이라 선언만 검사한다.
const FORBIDDEN_PREDICATE_NAME = /^(?:isNot[A-Z]|hasNo[A-Z]|is(?:[A-Z]\w*)?(?:Allowed|Eligible)$)/u;
// OS 권한 상태의 이름 그대로다
const OS_STATE_PREDICATE_NAMES = new Set(['isNotDetermined']);

function getDeclaredName(node) {
  const isNamedDeclaration =
    ts.isFunctionDeclaration(node) ||
    ts.isVariableDeclaration(node) ||
    ts.isParameter(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isMethodSignature(node) ||
    ts.isPropertySignature(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isPropertyAssignment(node);
  return isNamedDeclaration && node.name !== undefined && ts.isIdentifier(node.name)
    ? node.name
    : null;
}

function checkPredicateNames(sourceFile, repositoryRoot, errors) {
  function visit(node) {
    const name = getDeclaredName(node);
    if (
      name != null &&
      FORBIDDEN_PREDICATE_NAME.test(name.text) &&
      !OS_STATE_PREDICATE_NAMES.has(name.text)
    ) {
      errors.push(
        `${getLocation(sourceFile, name, repositoryRoot)} ${name.text}: 판별 이름은 긍정으로 짓고(isNot*, hasNo* 금지), 허용을 묻는 판별은 can*으로 쓰세요(is*Allowed, is*Eligible 금지). 값이 뒤집히면 호출부를 하나씩 확인하세요.`,
      );
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function isIconComponentType(type) {
  if (type === undefined) {
    return false;
  }
  if (ts.isUnionTypeNode(type) || ts.isParenthesizedTypeNode(type)) {
    return (ts.isUnionTypeNode(type) ? type.types : [type.type]).some(isIconComponentType);
  }
  if (ts.isTypeReferenceNode(type)) {
    return ts.isIdentifier(type.typeName) && type.typeName.text === 'StyledIcon';
  }
  return ts.isTypeQueryNode(type) && type.exprName.getText().endsWith('Icon');
}

function checkIconPropNames(sourceFile, repositoryRoot, errors) {
  function visit(node) {
    if (
      ts.isPropertySignature(node) &&
      ts.isIdentifier(node.name) &&
      isIconComponentType(node.type) &&
      !/^(?:[A-Z][A-Za-z]*)?Icon$/u.test(node.name.text)
    ) {
      errors.push(
        `${getLocation(sourceFile, node.name, repositoryRoot)} ${node.name.text}: 아이콘 컴포넌트를 받는 prop은 \`Icon: StyledIcon\`으로 쓰세요. 그려 둔 요소를 받으면 \`icon: ReactNode\`입니다.`,
      );
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function checkLoadingNamespaceNames(sourceFile, repositoryRoot, errors) {
  function visit(node) {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      isComponentName(node.left.name.text) &&
      node.left.name.text.endsWith('Skeleton')
    ) {
      errors.push(
        `${getLocation(sourceFile, node.left.name, repositoryRoot)} ${node.left.name.text}: 로딩 자리 조각은 \`X.Loading\`으로 거세요. 행마다 다르면 \`X.Item.Loading\`처럼 그 행에 겁니다.`,
      );
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function collectImportedNames(sourceFile) {
  const names = new Set();
  for (const statement of sourceFile.statements) {
    const clause = ts.isImportDeclaration(statement) ? statement.importClause : undefined;
    if (clause?.name != null) {
      names.add(clause.name.text);
    }
    if (clause?.namedBindings != null && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        names.add(element.name.text);
      }
    }
  }
  return names;
}

function checkNamespaceFunctionNames(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName);
  if (isTestSource(relativePath)) {
    return;
  }
  const importedNames = collectImportedNames(sourceFile);

  function visit(node) {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      isComponentName(node.left.name.text) &&
      ts.isFunctionExpression(node.right) &&
      node.right.name != null
    ) {
      const property = node.left.name.text;
      const functionName = node.right.name.text;
      const isAllowed =
        functionName === property ||
        (property === 'Error' && functionName === 'ErrorFallback') ||
        (importedNames.has(property) && functionName !== property);
      if (!isAllowed) {
        errors.push(
          `${getLocation(sourceFile, node.right.name, repositoryRoot)} ${functionName}: 네임스페이스 조각의 함수 이름은 속성 이름(\`${property}\`)과 같게 쓰세요. \`.Error\`는 \`ErrorFallback\`, 가져온 이름을 가리면 다른 이름을 씁니다.`,
        );
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function checkHermesMissingMethods(sourceFile, repositoryRoot, errors) {
  function visit(node) {
    if (ts.isPropertyAccessExpression(node)) {
      const replacement = HERMES_MISSING_METHODS.get(node.name.text);
      const isTarget =
        node.name.text !== 'fromAsync' ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'Array');
      if (replacement != null && isTarget) {
        errors.push(
          `${getLocation(sourceFile, node.name, repositoryRoot)} ${node.name.text}는 앱의 Hermes에 없어 호출하면 앱에서만 죽습니다. ${replacement}를 쓰세요.`,
        );
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

const ENTITY_FILE_FOLDERS = new Set([
  'schemas',
  'domains',
  'apis',
  'queries',
  'constants',
  '__tests__',
]);
const ENTITY_FILE_NAME =
  /^(.+?)(?:\.schema|\.model|\.mapper|\.service|\.error|-query-keys|-mutation-keys|-cache|\.events|-log-events|-labels|\.constants|\.queries|\.mutations|\.fixtures)\.tsx?$/u;
// schemas/는 폼·route·초안·쿼리 키·기기 저장·서버와 주고받는 모양만 둔다. 모델은 domains/{entity}.model.ts다
const SCHEMA_FILE_SUFFIXES = [
  'form',
  'params',
  'draft',
  'query-key',
  'storage',
  'request',
  'response',
  'payload',
  'entry',
];
const SCHEMA_FILE_NAME = new RegExp(
  `-(?:${SCHEMA_FILE_SUFFIXES.join('|')})\\.schema(?:\\.test)?\\.ts$`,
  'u',
);

function checkSchemaFileNames(repositoryRoot, errors) {
  for (const file of getSourceFiles(repositoryRoot, 'apps/mobile/src/features')) {
    const fileName = relative(repositoryRoot, file).replaceAll('\\', '/');
    if (fileName.includes('/schemas/') && !SCHEMA_FILE_NAME.test(fileName)) {
      errors.push(
        `${fileName} schemas/ 파일 이름은 {name}-(${SCHEMA_FILE_SUFFIXES.join('|')}).schema.ts입니다. 클라이언트 모델이면 domains/{entity}.model.ts로 옮기세요.`,
      );
    }
  }
}

function getEntityNames(featureDirectory) {
  const domainDirectory = resolve(featureDirectory, 'domains');
  if (!existsSync(domainDirectory)) {
    return [];
  }
  return readdirSync(domainDirectory)
    .filter((name) => name.endsWith('.model.ts'))
    .map((name) => name.slice(0, -'.model.ts'.length));
}

function checkFeatureFilePrefixes(repositoryRoot, errors) {
  for (const file of getSourceFiles(repositoryRoot, 'apps/mobile/src/features')) {
    const featureName = getFeatureName(file);
    const fileName = relative(repositoryRoot, file);
    const [folder, baseName, ...rest] = fileName
      .slice(`apps/mobile/src/features/${featureName}/`.length)
      .split('/');
    if (!ENTITY_FILE_FOLDERS.has(folder) || rest.length > 0 || /\.test\.tsx?$/u.test(baseName)) {
      continue;
    }
    const shortName = featureName.split('/').at(-1);
    const prefix = ENTITY_FILE_NAME.exec(baseName)?.[1];
    if (prefix !== shortName) {
      continue;
    }
    const entityNames = getEntityNames(
      resolve(repositoryRoot, `apps/mobile/src/features/${featureName}`),
    );
    const entityName = entityNames.find((name) => name.endsWith(`-${shortName}`));
    if (entityName != null && !entityNames.includes(shortName)) {
      errors.push(
        `${fileName} 파일 접두사는 entity 이름 ${entityName}입니다. feature 이름 ${shortName}만으로 시작하지 않습니다.`,
      );
    }
  }
}

function loadAllowlist() {
  return JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
}

function getAllowedCount(entry) {
  return typeof entry === 'number' ? entry : (entry?.count ?? 0);
}

function getImportedFeaturePath(moduleName, fileName) {
  if (moduleName.startsWith('@src/features/')) {
    return `/src/features/${moduleName.slice('@src/features/'.length)}`;
  }
  if (moduleName.startsWith('.')) {
    const resolved = resolve(dirname(fileName), moduleName).replaceAll('\\', '/');
    const index = resolved.indexOf('/src/features/');
    return index === -1 ? null : resolved.slice(index);
  }
  return null;
}

function isTypeOnlyStatement(statement) {
  if (ts.isExportDeclaration(statement)) {
    return statement.isTypeOnly;
  }
  const clause = statement.importClause;
  if (clause === undefined) {
    return false;
  }
  if (clause.isTypeOnly) {
    return true;
  }
  const { name, namedBindings } = clause;
  return (
    name === undefined &&
    namedBindings !== undefined &&
    ts.isNamedImports(namedBindings) &&
    namedBindings.elements.length > 0 &&
    namedBindings.elements.every((element) => element.isTypeOnly)
  );
}

function getModuleStatements(sourceFile) {
  return sourceFile.statements.filter(
    (statement) =>
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier),
  );
}

/** core는 아무것도 보지 않고, shared는 core만 본다. 테스트 도구는 조립을 위해 위층을 볼 수 있다 */
function checkLowerLayerImports(sourceFile, relativePath, errors, repositoryRoot) {
  const forbidden = relativePath.startsWith('apps/mobile/src/core/')
    ? ['@src/shared', '@src/features', '@src/bootstrap']
    : relativePath.startsWith('apps/mobile/src/shared/')
      ? ['@src/features', '@src/bootstrap']
      : [];
  for (const statement of getModuleStatements(sourceFile)) {
    const moduleName = statement.moduleSpecifier.text;
    const target = forbidden.find(
      (root) => moduleName === root || moduleName.startsWith(`${root}/`),
    );
    if (target !== undefined) {
      errors.push(
        `${getLocation(sourceFile, statement, repositoryRoot)} ${relativePath.split('/')[3]}는 ${target}를 import하지 않습니다. 포트와 타입을 core로 옮기거나 값을 인자로 받으세요.`,
      );
    }
  }
}

function collectFeatureImports(sourceFile, findings, featureEdges, errors, repositoryRoot) {
  const owner = getFeatureName(sourceFile.fileName);
  if (owner === null) {
    return;
  }
  for (const statement of getModuleStatements(sourceFile)) {
    const importedPath = getImportedFeaturePath(
      statement.moduleSpecifier.text,
      sourceFile.fileName,
    );
    const target = importedPath === null ? null : getFeatureName(importedPath);
    if (target === null || target === owner) {
      continue;
    }
    if (!featureEdges.has(owner)) {
      featureEdges.set(owner, new Set());
    }
    featureEdges.get(owner).add(target);
    const location = getLocation(sourceFile, statement, repositoryRoot);
    const ownerLayer = FEATURE_LAYERS.get(owner);
    const targetLayer = FEATURE_LAYERS.get(target);
    if (ownerLayer === undefined || targetLayer === undefined) {
      errors.push(
        `${location} ${ownerLayer === undefined ? owner : target}의 층이 정해지지 않았습니다. FEATURE_LAYERS와 .claude/architecture.md의 층 표에 더하세요.`,
      );
      continue;
    }
    if (
      ownerLayer < targetLayer &&
      !isTypeOnlyStatement(statement) &&
      !ANY_LAYER_IMPORT_PATTERN.test(importedPath)
    ) {
      findings.push({
        rule: 'feature-upward',
        key: `${owner} -> ${target}`,
        message: `${location} 위층 ${target}의 코드를 import합니다. 위층에서 가져와도 되는 것은 타입, 모델(Policy), *-cache입니다. app/에서 조립하거나 슬롯으로 넘기세요.`,
      });
    }
  }
}

function collectBidirectionalFindings(featureEdges, findings) {
  for (const [owner, targets] of featureEdges) {
    for (const target of targets) {
      if (owner < target && featureEdges.get(target)?.has(owner)) {
        findings.push({
          rule: 'feature-bidirectional',
          key: `${owner} <-> ${target}`,
          message: `${owner}와 ${target}가 서로 import합니다. 한쪽을 끊거나 이유를 적어 허용 목록에 더하세요.`,
        });
      }
    }
  }
}

function getDeclaredComponentName(node) {
  if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
    return node.name.text;
  }
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer !== undefined &&
    (ts.isArrowFunction(node.initializer) ||
      ts.isFunctionExpression(node.initializer) ||
      ts.isCallExpression(node.initializer))
  ) {
    return node.name.text;
  }
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isPropertyAccessExpression(node.left) &&
    (ts.isFunctionExpression(node.right) || ts.isArrowFunction(node.right))
  ) {
    return node.left.name.text;
  }
  return null;
}

function unwrapExpression(expression) {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

// 모델 일부만 받는 모양. 모델에 필드가 늘거나 줄 때마다 Policy 서명과 호출부가 함께 바뀐다
const MODEL_FRAGMENT_UTILITIES = new Set(['Pick', 'Partial', 'Omit', 'Required']);
const ARRAY_TYPE_NAMES = new Set(['ReadonlyArray', 'Array']);

function collectLocalTypeAliases(sourceFile) {
  const aliases = new Map();
  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement)) {
      aliases.set(statement.name.text, statement.type);
    }
  }
  return aliases;
}

function isNullishTypeNode(typeNode) {
  return (
    typeNode.kind === ts.SyntaxKind.UndefinedKeyword ||
    (ts.isLiteralTypeNode(typeNode) && typeNode.literal.kind === ts.SyntaxKind.NullKeyword)
  );
}

/**
 * 첫 인자가 모델 전체(또는 모델 목록)가 아니라 일부를 받는지 본다. 같은 파일의 type 별칭과 타입 인자 제약까지 따라간다.
 * 별칭이 객체 리터럴의 합(판별 유니온)이면 상태 모델이라 통과한다
 */
function describeModelFragment(typeNode, context, isAliasUnionMember = false) {
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return describeModelFragment(typeNode.type, context, isAliasUnionMember);
  }
  if (ts.isTypeOperatorNode(typeNode) && typeNode.operator === ts.SyntaxKind.ReadonlyKeyword) {
    return describeModelFragment(typeNode.type, context);
  }
  if (ts.isArrayTypeNode(typeNode)) {
    return describeModelFragment(typeNode.elementType, context);
  }
  if (ts.isRestTypeNode(typeNode) || ts.isNamedTupleMember(typeNode)) {
    return describeModelFragment(typeNode.type, context);
  }
  if (ts.isTupleTypeNode(typeNode)) {
    for (const element of typeNode.elements) {
      const fragment = describeModelFragment(element, context);
      if (fragment !== null) {
        return fragment;
      }
    }
    return null;
  }
  if (ts.isUnionTypeNode(typeNode)) {
    for (const member of typeNode.types) {
      if (isNullishTypeNode(member)) {
        continue;
      }
      const fragment = describeModelFragment(member, context, context.isInAlias);
      if (fragment !== null) {
        return fragment;
      }
    }
    return null;
  }
  if (ts.isIntersectionTypeNode(typeNode)) {
    return '교차 타입';
  }
  if (ts.isTypeLiteralNode(typeNode)) {
    return isAliasUnionMember ? null : '객체 리터럴 타입';
  }
  if (ts.isIndexedAccessTypeNode(typeNode)) {
    return '모델 필드 타입';
  }
  if (!ts.isTypeReferenceNode(typeNode) || !ts.isIdentifier(typeNode.typeName)) {
    return null;
  }
  const name = typeNode.typeName.text;
  if (MODEL_FRAGMENT_UTILITIES.has(name)) {
    return `${name}<…>`;
  }
  const [elementType] = typeNode.typeArguments ?? [];
  if (ARRAY_TYPE_NAMES.has(name) && elementType !== undefined) {
    return describeModelFragment(elementType, context);
  }
  if (context.visited.has(name)) {
    return null;
  }
  const constraint = context.typeParameters.get(name);
  if (constraint !== undefined) {
    context.visited.add(name);
    return describeModelFragment(constraint, context);
  }
  const alias = context.aliases.get(name);
  if (alias === undefined) {
    return null;
  }
  context.visited.add(name);
  const fragment = describeModelFragment(alias, { ...context, isInAlias: true });
  return fragment === null ? null : `${name}(${fragment})`;
}

function checkPolicyMemberFirstParameter(declaration, sourceFile, aliases) {
  const [firstParameter] = declaration.parameters;
  if (firstParameter === undefined) {
    return null;
  }
  if (firstParameter.type === undefined) {
    return ts.isObjectBindingPattern(firstParameter.name) ? '구조 분해한 객체' : null;
  }
  const typeParameters = new Map(
    (declaration.typeParameters ?? [])
      .filter((parameter) => parameter.constraint !== undefined)
      .map((parameter) => [parameter.name.text, parameter.constraint]),
  );
  return describeModelFragment(firstParameter.type, {
    aliases,
    typeParameters,
    visited: new Set(),
    isInAlias: false,
  });
}

function checkPolicyFacade(node, sourceFile, relativePath, findings, repositoryRoot) {
  const object = node.initializer === undefined ? null : unwrapExpression(node.initializer);
  if (object === null || !ts.isObjectLiteralExpression(object)) {
    return;
  }
  const push = (member, problem) =>
    findings.push({
      rule: 'policy-facade',
      key: relativePath,
      message: `${getLocation(sourceFile, member, repositoryRoot)} ${node.name.text}: ${problem}. Facade는 모듈 수준 함수를 같은 이름으로 모으기만 합니다.`,
    });
  const functions = new Map(
    sourceFile.statements
      .filter((statement) => ts.isFunctionDeclaration(statement) && statement.name !== undefined)
      .map((statement) => [statement.name.text, statement]),
  );
  const aliases = collectLocalTypeAliases(sourceFile);
  for (const member of object.properties) {
    if (ts.isMethodDeclaration(member)) {
      push(member, '메서드를 Facade 안에 정의했습니다');
      continue;
    }
    const value = ts.isShorthandPropertyAssignment(member)
      ? member.name
      : ts.isPropertyAssignment(member)
        ? unwrapExpression(member.initializer)
        : null;
    if (value === null) {
      continue;
    }
    if (ts.isIdentifier(value) && value.text !== getPropertyName(member.name)) {
      push(member, `별칭(${getPropertyName(member.name)}: ${value.text})을 썼습니다`);
      continue;
    }
    if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) {
      push(member, '함수를 Facade 안에 정의했습니다');
      continue;
    }
    const declaration = ts.isIdentifier(value) ? functions.get(value.text) : undefined;
    const fragment =
      declaration === undefined
        ? null
        : checkPolicyMemberFirstParameter(declaration, sourceFile, aliases);
    if (fragment !== null) {
      findings.push({
        rule: 'policy-facade',
        key: relativePath,
        message: `${getLocation(sourceFile, member, repositoryRoot)} ${node.name.text}.${value.text}: 첫 인자가 모델 일부(${fragment})입니다. Policy 멤버는 모델 전체(category: TodoCategory)나 모델 목록(readonly TodoCategory[])을 첫 인자로 받아 모델 필드가 바뀌어도 서명이 그대로입니다. 호출부가 모델 일부(폼 값 등)만 가지면 엔티티 규칙이 아니니 Policy 밖 순수 함수로 두세요.`,
      });
    }
  }
}

const COMPONENT_WRAPPER_NAMES = new Set(['memo', 'forwardRef']);

function isModuleArrowValue(value) {
  if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) {
    return true;
  }
  if (!ts.isCallExpression(value) || !COMPONENT_WRAPPER_NAMES.has(getCallName(value.expression))) {
    return false;
  }
  const [render] = value.arguments;
  return render !== undefined && ts.isArrowFunction(unwrapExpression(render));
}

/** 이미 있는 위반은 허용 목록의 수까지 두고 늘면 막는 규칙들. 찾은 것은 findings로 모은다 */
function collectRatchetFindings(sourceFile, relativePath, findings, repositoryRoot) {
  const isTest = isTestSource(relativePath);
  const isFeatureOrScreen =
    relativePath.startsWith('apps/mobile/src/features/') ||
    relativePath.startsWith('apps/mobile/app/');
  const isDomain = relativePath.includes('/domains/');
  const isFeatureModel =
    relativePath.startsWith('apps/mobile/src/features/') &&
    isDomain &&
    relativePath.endsWith('.model.ts');
  const isDeclaration = relativePath.endsWith('.d.ts');

  if (!isTest && !isDeclaration) {
    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) {
        continue;
      }
      for (const declaration of statement.declarationList.declarations) {
        const value =
          declaration.initializer === undefined ? null : unwrapExpression(declaration.initializer);
        if (value !== null && isModuleArrowValue(value)) {
          findings.push({
            rule: 'module-arrow',
            key: relativePath,
            message: `${getLocation(sourceFile, declaration, repositoryRoot)} 모듈 수준 함수는 function 선언으로 씁니다.`,
          });
        }
      }
    }
  }

  function visit(node) {
    if (isTest) {
      ts.forEachChild(node, visit);
      return;
    }

    const componentName = isFeatureOrScreen ? getDeclaredComponentName(node) : null;
    if (
      componentName !== null &&
      isComponentName(componentName) &&
      FORBIDDEN_COMPONENT_NAME.test(componentName)
    ) {
      findings.push({
        rule: 'forbidden-name',
        key: relativePath,
        message: `${getLocation(sourceFile, node, repositoryRoot)} ${componentName}: Body, Frame, Section, Blocks, Wrapper로 끝나는 컴포넌트 이름을 쓰지 않습니다. 역할이 드러나는 이름을 짓거나 스크린에 펼치세요.`,
      });
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      POLICY_NAME.test(node.name.text)
    ) {
      checkPolicyFacade(node, sourceFile, relativePath, findings, repositoryRoot);
    }
    if (
      isFeatureModel &&
      ts.isVariableStatement(node) &&
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const declaration of node.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          !POLICY_NAME.test(declaration.name.text) &&
          !MODEL_SCHEMA_NAME.test(declaration.name.text)
        ) {
          findings.push({
            rule: 'policy-facade',
            key: relativePath,
            message: `${getLocation(sourceFile, declaration, repositoryRoot)} ${declaration.name.text}: 모델 파일은 클라이언트 모델 스키마(*Schema)·타입·순수 함수·Policy만 내보냅니다. 상수는 constants/{feature}.constants.ts로 옮기세요.`,
          });
        }
      }
    }
    if (node.kind === ts.SyntaxKind.ThisKeyword && isDomain && !isInsideClass(node)) {
      findings.push({
        rule: 'policy-facade',
        key: relativePath,
        message: `${getLocation(sourceFile, node, repositoryRoot)} 모델에서 this를 쓰지 않습니다. Facade가 아니라 함수를 직접 부르세요.`,
      });
    }

    if (
      (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) &&
      node.name !== undefined &&
      ts.isIdentifier(node.name) &&
      XXX_OF_NAME.test(node.name.text)
    ) {
      findings.push({
        rule: 'xxx-of-name',
        key: relativePath,
        message: `${getLocation(sourceFile, node, repositoryRoot)} ${node.name.text}: xxxOf 대신 동사로 시작하는 이름을 씁니다.`,
      });
    }

    if (
      (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) &&
      node.name !== undefined &&
      ts.isIdentifier(node.name) &&
      (XXX_FROM_NAME.test(node.name.text) || TRY_NAME.test(node.name.text))
    ) {
      findings.push({
        rule: 'function-name',
        key: relativePath,
        message: `${getLocation(sourceFile, node, repositoryRoot)} ${node.name.text}: xxxFrom·tryX 대신 동사로 시작하고 결과를 말하는 이름을 씁니다(없으면 null은 find*, 변환은 to*).`,
      });
    }

    if (
      (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
      (FORM_INPUT_TYPE_NAME.test(node.name.text) ||
        (MUTATIONS_FILE.test(relativePath) && MUTATION_VARIABLES_TYPE_NAME.test(node.name.text)))
    ) {
      findings.push({
        rule: 'type-name',
        key: relativePath,
        message: `${getLocation(sourceFile, node, repositoryRoot)} ${node.name.text}: 폼 값은 *FormValues, mutation 인자는 *Variables로 짓습니다. Params는 route 값에만 씁니다.`,
      });
    }

    if (isWorkletWithParameterDefault(node)) {
      findings.push({
        rule: 'worklet-default',
        key: relativePath,
        message: `${getLocation(sourceFile, node, repositoryRoot)} worklet 함수의 매개변수 기본값은 Reanimated가 모듈 값을 잡아 주지 않아 UI 스레드에서 오류가 납니다. 호출부가 값을 넘기세요.`,
      });
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'Render'
    ) {
      findings.push({
        rule: 'render-call',
        key: relativePath,
        message: `${getLocation(sourceFile, node, repositoryRoot)} X.Render(...)는 훅을 쓰는 컴포넌트라 함수로 부르면 훅 순서가 부모와 섞입니다. <X.Render … /> JSX로 그리세요.`,
      });
    }

    if (isChipLabelElement(node)) {
      findings.push({
        rule: 'chip-label',
        key: relativePath,
        message: `${getLocation(sourceFile, node, repositoryRoot)} Chip.Label은 앱 글꼴을 따르지 않습니다. 글자는 자식 <Text>로 넣으세요.`,
      });
    }

    if (isRawTextTabsLabel(node)) {
      findings.push({
        rule: 'tabs-label',
        key: relativePath,
        message: `${getLocation(sourceFile, node, repositoryRoot)} Tabs.Label의 날글자는 앱 글꼴을 따르지 않습니다. SegmentTabTrigger, LineTabTrigger를 쓰거나 자식 <Text>로 넣으세요.`,
      });
    }

    if (isFormShapeViolation(node)) {
      findings.push({
        rule: 'form-shape',
        key: relativePath,
        message: `${getLocation(sourceFile, node, repositoryRoot)} 폼은 변수 form, useForm 제네릭 없이, Controller로 씁니다. FormProvider, useFormContext, FormField, methods, formMethods를 쓰지 않고 form을 props로 넘기세요.`,
      });
    }

    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === 'react-native' &&
      node.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(node.importClause.namedBindings) &&
      node.importClause.namedBindings.elements.some(
        (element) => (element.propertyName ?? element.name).text === 'ActivityIndicator',
      )
    ) {
      findings.push({
        rule: 'rn-ui-import',
        key: relativePath,
        message: `${getLocation(sourceFile, node, repositoryRoot)} react-native의 ActivityIndicator 대신 heroui-native의 Spinner를 씁니다.`,
      });
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Alert' &&
      node.expression.name.text === 'alert'
    ) {
      findings.push({
        rule: 'rn-ui-import',
        key: relativePath,
        message: `${getLocation(sourceFile, node, repositoryRoot)} Alert.alert 대신 useConfirmDialog를 씁니다.`,
      });
    }

    if (
      !isDomain &&
      ts.isBinaryExpression(node) &&
      STRICT_EQUALITY_OPERATORS.has(node.operatorToken.kind) &&
      [node.left, node.right].some(
        (side) =>
          ts.isPropertyAccessExpression(side) &&
          ts.isIdentifier(side.expression) &&
          ROLE_CONSTANTS.has(side.expression.text),
      )
    ) {
      findings.push({
        rule: 'role-comparison',
        key: relativePath,
        message: `${getLocation(sourceFile, node, repositoryRoot)} 역할과 프리미엄 출처 판별은 Policy에 둡니다.`,
      });
    }

    if (
      ts.isPropertyAssignment(node) &&
      getPropertyName(node.name) === 'queryKey' &&
      ts.isArrayLiteralExpression(node.initializer) &&
      !QUERY_KEY_FILE.test(relativePath)
    ) {
      findings.push({
        rule: 'query-key-location',
        key: relativePath,
        message: `${getLocation(sourceFile, node, repositoryRoot)} 쿼리 키는 constants/{feature}-query-keys.ts에서 만듭니다.`,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

const FORM_CONTEXT_IMPORTS = new Set(['FormProvider', 'useFormContext']);
const FORM_VARIABLE_NAMES = new Set(['methods', 'formMethods']);

function hasDefaultValue(binding) {
  if (binding.initializer !== undefined) {
    return true;
  }
  const name = binding.name;
  return (
    name !== undefined &&
    (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) &&
    name.elements.some((element) => ts.isBindingElement(element) && hasDefaultValue(element))
  );
}

function isWorkletWithParameterDefault(node) {
  if (
    !(
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) ||
    node.body === undefined ||
    !ts.isBlock(node.body)
  ) {
    return false;
  }
  const hasWorkletDirective = node.body.statements.some(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression) &&
      statement.expression.text === 'worklet',
  );
  return hasWorkletDirective && node.parameters.some(hasDefaultValue);
}

function isChipLabelElement(node) {
  return (
    (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
    ts.isPropertyAccessExpression(node.tagName) &&
    ts.isIdentifier(node.tagName.expression) &&
    node.tagName.expression.text === 'Chip' &&
    node.tagName.name.text === 'Label'
  );
}

function isRawTextTabsLabel(node) {
  if (
    !ts.isJsxElement(node) ||
    !ts.isPropertyAccessExpression(node.openingElement.tagName) ||
    !ts.isIdentifier(node.openingElement.tagName.expression) ||
    node.openingElement.tagName.expression.text !== 'Tabs' ||
    node.openingElement.tagName.name.text !== 'Label'
  ) {
    return false;
  }
  return node.children.some(
    (child) =>
      ts.isJsxExpression(child) || (ts.isJsxText(child) && !child.containsOnlyTriviaWhiteSpaces),
  );
}

function isFormShapeViolation(node) {
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    const bindings = node.importClause?.namedBindings;
    if (bindings === undefined || !ts.isNamedImports(bindings)) {
      return false;
    }
    const names = bindings.elements.map((element) => (element.propertyName ?? element.name).text);
    const specifier = node.moduleSpecifier.text;
    return (
      (specifier === 'react-hook-form' && names.some((name) => FORM_CONTEXT_IMPORTS.has(name))) ||
      (names.includes('FormField') &&
        (specifier === '@src/shared/ui' || specifier.endsWith('/form-field')))
    );
  }
  if (ts.isVariableDeclaration(node)) {
    return ts.isIdentifier(node.name) && FORM_VARIABLE_NAMES.has(node.name.text);
  }
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'useForm' &&
    node.typeArguments !== undefined
  );
}

function isInsideClass(node) {
  let current = node.parent;
  while (current !== undefined) {
    if (ts.isClassLike(current)) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/** 찾은 수를 허용 목록과 견준다. 늘면 위반이고, 줄면 목록도 줄이게 해 고친 뒤 다시 늘지 않게 한다 */
function applyAllowlist(findings, allowlist, errors) {
  const grouped = new Map();
  for (const finding of findings) {
    const key = `${finding.rule}\u0000${finding.key}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(finding);
  }
  for (const [groupKey, group] of grouped) {
    const [rule, key] = groupKey.split('\u0000');
    const allowed = getAllowedCount(allowlist[rule]?.entries?.[key]);
    if (group.length > allowed) {
      errors.push(...group.map(({ message }) => message));
    } else if (group.length < allowed) {
      errors.push(
        `허용 목록을 줄이세요(${rule}: ${key} ${allowed} → ${group.length}). pnpm check:conventions --shrink-allowlist`,
      );
    }
  }
  for (const [rule, { entries = {} }] of Object.entries(allowlist)) {
    for (const key of Object.keys(entries)) {
      if (!grouped.has(`${rule}\u0000${key}`)) {
        errors.push(
          `허용 목록을 줄이세요(${rule}: ${key}는 이제 없습니다). pnpm check:conventions --shrink-allowlist`,
        );
      }
    }
  }
}

/** 통합 뒤 줄어든 수만 목록에 반영한다. 새 위반이나 늘어난 수는 넣지 않아 검사가 그대로 막는다 */
export function shrinkAllowlist(findings, allowlist) {
  const counts = new Map();
  for (const { rule, key } of findings) {
    const id = `${rule}\u0000${key}`;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return Object.fromEntries(
    Object.entries(allowlist).map(([rule, { entries = {}, ...group }]) => [
      rule,
      {
        ...group,
        entries: Object.fromEntries(
          Object.entries(entries).flatMap(([key, entry]) => {
            const found = counts.get(`${rule}\u0000${key}`) ?? 0;
            const allowed = getAllowedCount(entry);
            if (found === 0) {
              return [];
            }
            const count = Math.min(found, allowed);
            return [[key, typeof entry === 'number' ? count : { ...entry, count }]];
          }),
        ),
      },
    ]),
  );
}

export function collectArchitectureFindings(repositoryRoot, errors) {
  const findings = [];
  const featureEdges = new Map();
  for (const file of ['apps/mobile/src', 'apps/mobile/app'].flatMap((root) =>
    getSourceFiles(repositoryRoot, root),
  )) {
    const relativePath = relative(repositoryRoot, file).replaceAll('\\', '/');
    const sourceFile = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    collectRatchetFindings(sourceFile, relativePath, findings, repositoryRoot);
    if (!isTestSource(relativePath)) {
      checkLowerLayerImports(sourceFile, relativePath, errors, repositoryRoot);
      collectFeatureImports(sourceFile, findings, featureEdges, errors, repositoryRoot);
    }
  }
  collectBidirectionalFindings(featureEdges, findings);
  return findings;
}

export function checkMobileConventions(
  repositoryRoot = REPOSITORY_ROOT,
  allowlist = repositoryRoot === REPOSITORY_ROOT ? loadAllowlist() : EMPTY_ALLOWLIST,
) {
  const errors = [];

  for (const forbiddenPath of FORBIDDEN_ROUTE_PATHS) {
    const hasForbiddenRoute = forbiddenPath.endsWith('.tsx')
      ? existsSync(resolve(repositoryRoot, forbiddenPath))
      : getSourceFiles(repositoryRoot, forbiddenPath).some(
          (file) => !ALLOWED_TODO_COMMENT_ROUTE_FILES.has(relative(repositoryRoot, file)),
        );
    if (hasForbiddenRoute) {
      errors.push(
        `${forbiddenPath} 댓글은 할 일 상세 한 화면에서 이어집니다. 댓글마다 Stack route를 만들지 마세요.`,
      );
    }
  }

  const featureFiles = [
    ...getSourceFiles(repositoryRoot, TODO_COMMENT_ROOT),
    ...getSourceFiles(repositoryRoot, TODO_ROUTE_ROOT),
  ];
  const componentRoot = resolve(repositoryRoot, TODO_COMMENT_COMPONENT_ROOT);
  const routeRoot = resolve(repositoryRoot, TODO_ROUTE_ROOT);
  for (const file of featureFiles) {
    const sourceFile = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    if (file.startsWith(resolve(repositoryRoot, TODO_COMMENT_ROOT))) {
      checkTodoCommentTestLocation(sourceFile, repositoryRoot, errors);
    }
    checkTodoCommentTestPurity(sourceFile, repositoryRoot, errors);
    checkFeatureSource(sourceFile, repositoryRoot, errors);
    if (file.startsWith(componentRoot) || file.startsWith(routeRoot)) {
      checkComponentProps(sourceFile, repositoryRoot, errors);
    }
  }

  for (const file of getSourceFiles(repositoryRoot, 'apps/mobile/src')) {
    const sourceFile = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    checkTodoCheckboxProps(sourceFile, repositoryRoot, errors);
    checkCrossFeatureRelativeImports(sourceFile, repositoryRoot, errors);
    checkOwnFeatureAbsoluteImports(sourceFile, repositoryRoot, errors);
    checkServerErrorReading(sourceFile, repositoryRoot, errors);
    checkCardComponentUsesCard(sourceFile, repositoryRoot, errors);
    checkHerouiSharedNameImports(sourceFile, repositoryRoot, errors);
    checkTestQueryClientFactory(sourceFile, repositoryRoot, errors);
    checkClientOwnedModelImports(sourceFile, repositoryRoot, errors);
    checkSchemaFolderImports(sourceFile, repositoryRoot, errors);
  }

  for (const file of ['apps/mobile/src', 'apps/mobile/app'].flatMap((root) =>
    getSourceFiles(repositoryRoot, root),
  )) {
    const sourceFile = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    checkHermesMissingMethods(sourceFile, repositoryRoot, errors);
    checkSdkImports(sourceFile, repositoryRoot, errors);
    checkFeatureAnalyticsPort(sourceFile, repositoryRoot, errors);
    checkInlineMutationErrorHandlers(sourceFile, repositoryRoot, errors);
    checkCacheHelperPurity(sourceFile, repositoryRoot, errors);
    checkJestModuleMocks(sourceFile, repositoryRoot, errors);
    checkEsToolkitCompatImports(sourceFile, repositoryRoot, errors);
    checkRouteParamConventions(sourceFile, repositoryRoot, errors);
    checkRangeComparisonOrder(sourceFile, repositoryRoot, errors);
    checkPredicateNames(sourceFile, repositoryRoot, errors);
    checkIconPropNames(sourceFile, repositoryRoot, errors);
    checkLoadingNamespaceNames(sourceFile, repositoryRoot, errors);
    checkNamespaceFunctionNames(sourceFile, repositoryRoot, errors);
    checkSpacingPropsWithClassName(sourceFile, repositoryRoot, errors);
  }

  checkFeatureFilePrefixes(repositoryRoot, errors);
  checkSchemaFileNames(repositoryRoot, errors);
  checkMyPageMenuNavigation(repositoryRoot, errors);

  applyAllowlist(collectArchitectureFindings(repositoryRoot, errors), allowlist, errors);

  const nullishRoots = [...STRICT_NULLISH_ROOTS, ...getPackageSourceRoots(repositoryRoot)];
  for (const file of nullishRoots.flatMap((root) => getSourceFiles(repositoryRoot, root))) {
    if (file.endsWith('.d.ts') || file.includes('/generated/')) {
      continue;
    }
    const sourceFile = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    checkStrictNullishComparisons(sourceFile, repositoryRoot, errors);
  }

  return errors;
}

function run() {
  if (process.argv.includes('--shrink-allowlist')) {
    const shrunk = shrinkAllowlist(
      collectArchitectureFindings(REPOSITORY_ROOT, []),
      loadAllowlist(),
    );
    writeFileSync(ALLOWLIST_PATH, `${JSON.stringify(shrunk, null, 2)}\n`);
  }

  const errors = checkMobileConventions();
  if (errors.length === 0) {
    process.stdout.write('모바일 컨벤션 검사에 통과했습니다.\n');
    return;
  }

  process.stderr.write(`모바일 컨벤션 위반 ${errors.length}건을 찾았습니다.\n\n`);
  for (const [index, error] of errors.entries()) {
    process.stderr.write(`${index + 1}. ${error}\n`);
  }
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run();
}
