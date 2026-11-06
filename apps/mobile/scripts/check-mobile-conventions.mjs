#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
    } catch {
      // 이 패키지의 의존성이 설치되지 않은 범위다. 다음 패키지에서 찾는다.
    }
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
const TODO_COMMENT_NAVIGATION_OWNER = `${TODO_COMMENT_ROOT}/hooks/use-todo-comment-route.ts`;
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
  'apps/mobile/src/features/app-config/whats-new/utils/',
  'apps/mobile/src/features/device/coachmark/components/',
  'apps/mobile/src/features/device/coachmark/constants/',
  'apps/mobile/src/features/device/coachmark/domains/',
  'apps/mobile/src/features/device/coachmark/hooks/',
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
  'apps/mobile/src/features/notification/domains/notification-badge.model.ts',
  'apps/mobile/src/features/notification/domains/notification.model.ts',
  'apps/mobile/src/features/notification/domains/push-permission.model.ts',
  'apps/mobile/src/features/billing/subscription/domains/customer-info.model.ts',
  'apps/mobile/src/features/billing/subscription/domains/entitlement.model.ts',
  'apps/mobile/src/features/engagement/comment/domains/todo-comment.model.ts',
  'apps/mobile/src/features/planning/todo/domains/todo-repeat.model.ts',
  'apps/mobile/src/features/voice/domains/',
  'apps/mobile/src/features/planning/category/components/',
  'apps/mobile/src/features/planning/category/constants/',
  'apps/mobile/src/features/planning/category/domains/',
  'apps/mobile/src/features/planning/category/hooks/',
  'apps/mobile/src/features/planning/category/queries/',
];
/** Zod 스키마를 feature의 schemas/ 폴더로 모은 feature */
const SCHEMA_FOLDER_FEATURE_PATHS = [
  'apps/mobile/src/features/notes/memo/',
  'apps/mobile/src/features/support/inquiry/',
  'apps/mobile/src/features/insights/achievement/',
  'apps/mobile/src/features/device/activation/',
  'apps/mobile/src/features/identity/preference/',
  'apps/mobile/src/features/identity/user/',
  'apps/mobile/src/features/identity/consent/',
  'apps/mobile/src/features/identity/auth/components/',
  'apps/mobile/src/features/identity/auth/domains/',
  'apps/mobile/src/features/identity/auth/hooks/',
  'apps/mobile/src/features/identity/auth/queries/',
  'apps/mobile/src/features/identity/auth/utils/',
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
  'apps/mobile/src/features/device/store-review/',
  'apps/mobile/src/features/planning/category/',
  // route 훅과 스키마는 공용 useRouteParams로 옮기는 작업이 맡아 그 폴더는 뺀다
  'apps/mobile/src/features/social/moderation/apis/',
  'apps/mobile/src/features/social/moderation/components/',
  'apps/mobile/src/features/social/moderation/constants/',
  'apps/mobile/src/features/social/moderation/domains/',
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
  'apps/mobile/src/features/assistant/suggestion/utils/',
  'apps/mobile/src/features/social/friend/apis/',
  'apps/mobile/src/features/social/friend/components/',
  'apps/mobile/src/features/social/friend/constants/',
  'apps/mobile/src/features/social/friend/queries/',
  'apps/mobile/src/features/social/friend/utils/',
  'apps/mobile/src/features/social/nudge/constants/',
  'apps/mobile/src/features/social/nudge/queries/',
  'apps/mobile/src/features/social/nudge/utils/',
];
const SHARED_CONTRACT_MODULE = '@aido/api';
const SHARED_CONTRACT_CONTRACTS_PREFIX = `${SHARED_CONTRACT_MODULE}/contracts/`;

const STRICT_NULLISH_ROOTS = ['apps/api/src', 'apps/mobile/src', 'apps/mobile/app'];
const STRICT_NULLISH_ALLOW_MARKER = 'nullish-strict:';
const STRICT_EQUALITY_OPERATORS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
]);

// 네이티브·외부 SDK는 shared/infra에서만 import한다(.claude/architecture.md#portadapterdi).
const SDK_MODULES = [
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
  '@sentry/react-native',
  '@react-native-firebase/app',
  '@react-native-firebase/analytics',
];
const SDK_INFRA_ROOT = 'apps/mobile/src/shared/infra/';
// 규칙을 넣기 전부터 있던 위반. 출시 후 첫 스택에서 모두 옮겨 비운다. 새 위반을 여기 더하지 않는다.
const SDK_IMPORT_ALLOWLIST = new Map([
  ['apps/mobile/app/_layout.tsx', ['expo-updates']],
  ['apps/mobile/app/auth/[provider].tsx', ['expo-web-browser']],
  ['apps/mobile/src/bootstrap/hooks/use-widget-app-entry.ts', ['expo-linking']],
  ['apps/mobile/src/bootstrap/providers/query-provider.tsx', ['expo-application', 'expo-updates']],
  [
    'apps/mobile/src/features/identity/auth/apis/auth.service.ts',
    ['expo-linking', 'expo-web-browser', 'expo-apple-authentication', 'expo-crypto'],
  ],
  [
    'apps/mobile/src/features/app-config/whats-new/apis/native-app-version.ts',
    ['expo-application'],
  ],
  ['apps/mobile/src/features/notification/apis/device-id.repository.ts', ['expo-secure-store']],
  [
    'apps/mobile/src/features/notification/apis/device-id.service.ts',
    ['expo-application', 'expo-crypto'],
  ],
  ['apps/mobile/src/features/notification/hooks/use-notification-navigation.ts', ['expo-linking']],
  [
    'apps/mobile/src/features/billing/subscription/hooks/use-open-subscription-management.ts',
    ['expo-linking', 'expo-application'],
  ],
  [
    'apps/mobile/src/features/engagement/comment/components/todo-comment-composer/todo-comment-form.tsx',
    ['expo-crypto'],
  ],
  ['apps/mobile/src/features/weather/components/weather-hero.tsx', ['expo-localization']],
  [
    'apps/mobile/src/features/weather/components/weather-scene/weather-scene-canvas.tsx',
    ['expo-device'],
  ],
  ['apps/mobile/src/features/weather/hooks/use-temperature-unit.ts', ['expo-localization']],
  ['apps/mobile/src/features/weather/hooks/use-weather-location.ts', ['expo-linking']],
  [
    'apps/mobile/src/features/device/widget/bridge/android-widget-task-handler.ts',
    ['expo-linking', 'expo-crypto'],
  ],
  ['apps/mobile/src/shared/config/device.ts', ['expo-device']],
  ['apps/mobile/src/shared/config/env.ts', ['expo-device']],
  ['apps/mobile/src/shared/hooks/use-open-url.ts', ['expo-linking', 'expo-web-browser']],
  ['apps/mobile/src/shared/hooks/use-share-view.ts', ['expo-sharing']],
  ['apps/mobile/src/shared/hooks/use-stable-feed-foreground.ts', ['expo-linking']],
  ['apps/mobile/src/shared/i18n/device-language.ts', ['expo-localization']],
  ['apps/mobile/src/shared/providers/language-provider.tsx', ['expo-localization']],
  ['apps/mobile/src/shared/providers/local-date-provider.tsx', ['expo-localization']],
  [
    'apps/mobile/src/shared/ui/query-error-boundary/query-error-actions.tsx',
    ['expo-application', 'expo-linking'],
  ],
  ['apps/mobile/src/shared/utils/device-headers.ts', ['expo-device']],
]);

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

function checkSdkImports(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName).replaceAll('\\', '/');
  if (relativePath.startsWith(SDK_INFRA_ROOT) || isTestSource(relativePath)) {
    return;
  }
  const allowed = SDK_IMPORT_ALLOWLIST.get(relativePath) ?? [];
  for (const statement of sourceFile.statements) {
    if (
      !(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) ||
      statement.moduleSpecifier === undefined ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const sdk = getSdkModule(statement.moduleSpecifier.text);
    if (sdk !== undefined && !allowed.includes(sdk)) {
      errors.push(
        `${getLocation(sourceFile, statement, repositoryRoot)} ${sdk}는 shared/infra에서만 import합니다. 포트와 어댑터를 거쳐 DI 훅으로 받으세요. 라이브러리가 React 훅이면 경계 훅 파일 하나에 둡니다(.claude/architecture.md#portadapterdi).`,
      );
    }
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

function importsModule(sourceFile, moduleName) {
  return sourceFile.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === moduleName,
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
    importsModule(sourceFile, RENDER_UI_MODULE)
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
        `${getLocation(sourceFile, node, repositoryRoot)} 테스트에서 new QueryClient를 직접 만들지 말고 @src/shared/__tests__/query-client의 createTestQueryClient를 쓰세요.`,
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
      isTodoCommentUiTestModule(statement.moduleSpecifier.text),
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
        `${getLocation(sourceFile, node, repositoryRoot)} 댓글 화면은 직접 push하지 않습니다. 댓글 위치는 use-todo-comment-route가 search로만 바꿉니다.`,
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

function isWireContractModule(moduleName) {
  return (
    moduleName === SHARED_CONTRACT_MODULE || moduleName.startsWith(SHARED_CONTRACT_CONTRACTS_PREFIX)
  );
}

function checkClientOwnedModelImports(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName).replaceAll('\\', '/');
  if (
    relativePath.includes('.test.') ||
    !CLIENT_OWNED_MODEL_PATHS.some((path) => relativePath.startsWith(path))
  ) {
    return;
  }
  for (const statement of sourceFile.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      isWireContractModule(statement.moduleSpecifier.text)
    ) {
      errors.push(
        `${getLocation(sourceFile, statement, repositoryRoot)} 클라이언트 모델은 요청·응답 계약(${statement.moduleSpecifier.text})을 import하지 않습니다. 모델이 자기 Zod 스키마를 갖고 apis/*.mapper.ts가 DTO를 모델로 바꿔야 서버가 바뀌어도 mapper만 고칩니다. 용어 튜플·상수는 @aido/api/vocabulary, 오류 코드는 @aido/api/errors에서 가져오세요.`,
      );
    }
  }
}

function checkSchemaFolderImports(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName).replaceAll('\\', '/');
  if (
    relativePath.includes('.test.') ||
    relativePath.includes('/schemas/') ||
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
        `${getLocation(sourceFile, statement, repositoryRoot)} Zod 스키마는 feature의 schemas/ 폴더에 둡니다.`,
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

/**
 * 허용 표시는 비교가 있는 문장 바로 위 주석부터 비교가 있는 줄 사이에 둔다.
 * 문장 하나 안의 여러 PATCH 필드는 그 위 표시 하나로 설명할 수 있다.
 */
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
const ROUTE_PARAMS_HOOK = 'apps/mobile/src/shared/hooks/use-route-params.ts';
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
function checkRouteParamConventions(sourceFile, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, sourceFile.fileName).replaceAll('\\', '/');
  if (isTestSource(relativePath)) {
    return;
  }

  function visit(node) {
    if (
      isRouterSetParamsCall(node) &&
      relativePath !== ROUTE_PARAMS_HOOK &&
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

const HERMES_MISSING_METHODS = new Map([
  ['toSorted', 'es-toolkit의 sortBy'],
  ['fromAsync', 'for await'],
]);

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

export function checkMobileConventions(repositoryRoot = REPOSITORY_ROOT) {
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
    checkEsToolkitCompatImports(sourceFile, repositoryRoot, errors);
    checkRouteParamConventions(sourceFile, repositoryRoot, errors);
  }

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
