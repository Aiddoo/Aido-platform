#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = resolve(MOBILE_ROOT, '../..');
const TODO_COMMENT_ROOT = 'apps/mobile/src/features/todo-comment';
const TODO_COMMENT_COMPONENT_ROOT = `${TODO_COMMENT_ROOT}/presentations/components`;
const TODO_COMMENT_TEST_ROOTS = [
  `${TODO_COMMENT_ROOT}/models/`,
  `${TODO_COMMENT_ROOT}/services/`,
  `${TODO_COMMENT_ROOT}/presentations/navigation/`,
  `${TODO_COMMENT_ROOT}/presentations/utils/`,
  `${TODO_COMMENT_ROOT}/presentations/view-models/`,
];
const TODO_COMMENT_UI_TEST_MODULE_PREFIXES = [
  '@shopify/flash-list',
  '@src/shared/ui',
  '@testing-library/',
  'expo-router',
  'heroui-native',
  'react-native',
];
const TODO_ROUTE_ROOT = 'apps/mobile/app/(app)/todo/[todoId]';
const FORBIDDEN_ROUTE_PATHS = [
  'apps/mobile/app/(app)/todo/[todoId]/_layout.tsx',
  'apps/mobile/app/(app)/todo/[todoId]/comment',
];
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

function checkTodoCommentTestLocation(file, repositoryRoot, errors) {
  const relativePath = relative(repositoryRoot, file).replaceAll('\\', '/');
  if (!/\.(?:spec|test)\.[cm]?[jt]sx?$/u.test(relativePath)) {
    return;
  }
  if (TODO_COMMENT_TEST_ROOTS.some((root) => relativePath.startsWith(root))) {
    return;
  }

  errors.push(
    `${relativePath} 댓글 클라이언트 테스트는 model, service/mapper, pure navigation/util/view-model에만 둡니다. 컴포넌트, hook, Provider, Query Options 배선을 테스트 코드로 복제하지 마세요.`,
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
      node.expression.name.text === 'push'
    ) {
      errors.push(
        `${getLocation(sourceFile, node, repositoryRoot)} 댓글 답글은 새 화면을 push하지 않습니다. 같은 할 일 화면에서 작성 대상만 바꾸세요.`,
      );
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
      : getSourceFiles(repositoryRoot, forbiddenPath).length > 0;
    if (hasForbiddenRoute) {
      errors.push(
        `${forbiddenPath} 댓글은 할 일 화면 하나에서 이어집니다. 댓글마다 Stack route를 만들지 마세요.`,
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
    if (file.startsWith(resolve(repositoryRoot, TODO_COMMENT_ROOT))) {
      checkTodoCommentTestLocation(file, repositoryRoot, errors);
    }
    const sourceFile = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
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
