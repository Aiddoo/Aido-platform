import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { getCalleeName, getKeyName, getMemberNames, isFunction, isValueProperty } from '../ast.mjs';

// 시트 route는 safeParse로 검증하고 Redirect만 한다. 대상은 시트가 같은 스키마의 route 훅으로 읽는다
const sheetRouteParams = {
  meta: { type: 'suggestion' },
  create(context) {
    const safeParseResults = new Set();
    const dataReads = [];
    return {
      VariableDeclarator(node) {
        if (
          node.id.type === 'Identifier' &&
          node.init?.type === 'CallExpression' &&
          node.init.callee.type === 'MemberExpression' &&
          !node.init.callee.computed &&
          node.init.callee.property.name === 'safeParse'
        ) {
          safeParseResults.add(node.id.name);
        }
      },
      MemberExpression(node) {
        const names = getMemberNames(node);
        if (names?.[1] === 'data') {
          dataReads.push({ node, name: names[0] });
        }
      },
      'Program:exit'() {
        if (!context.sourceCode.text.includes('<SheetRouteScreen')) {
          return;
        }
        for (const { node, name } of dataReads) {
          if (safeParseResults.has(name)) {
            context.report({
              node,
              message:
                '시트 route는 safeParse로 검증하고 Redirect만 합니다. 대상은 시트가 같은 스키마의 route 훅으로 읽습니다.',
            });
          }
        }
      },
    };
  },
};

// URL 값은 schemas/의 스키마로 parse한 값을 쓴다
const noDestructuredSearchParams = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      VariableDeclarator(node) {
        if (
          node.id.type === 'ObjectPattern' &&
          node.init?.type === 'CallExpression' &&
          node.init.callee.type === 'Identifier' &&
          node.init.callee.name === 'useLocalSearchParams'
        ) {
          context.report({
            node,
            message:
              'useLocalSearchParams 결과를 구조 분해하지 마세요. schemas/의 스키마로 parse한 값을 씁니다.',
          });
        }
      },
    };
  },
};

// 댓글 위치는 use-todo-comment-params가 search로만 바꾼다(.claude/todo-comments.md)
const noRouterPush = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      CallExpression(node) {
        const names = getMemberNames(node.callee);
        if (names?.[0] === 'router' && names[1] === 'push') {
          context.report({
            node,
            message:
              '댓글 화면은 직접 push하지 않습니다. 댓글 위치는 use-todo-comment-params가 search로만 바꿉니다.',
          });
        }
      },
    };
  },
};

const MY_PAGE_MENU_PANE = 'src/bootstrap/navigation/my-page-menu-pane.tsx';
const ROUTER_NAVIGATION_METHODS = new Set(['push', 'navigate', 'replace', 'dismissTo']);
const paneCache = new Map();

/** 마이 탭 메뉴 칸이 그리는 feature 컴포넌트 파일. 메뉴 칸 파일이 바뀌면 다시 읽는다 */
function getMenuPaneComponentFiles(root) {
  const panePath = resolve(root, MY_PAGE_MENU_PANE);
  if (!existsSync(panePath)) {
    return new Set();
  }
  const modifiedAt = statSync(panePath).mtimeMs;
  const cached = paneCache.get(panePath);
  if (cached?.modifiedAt === modifiedAt) {
    return cached.files;
  }
  const files = new Set();
  for (const [, moduleName] of readFileSync(panePath, 'utf8').matchAll(
    /from\s+['"](@src\/features\/[^'"]*\/components\/[^'"]+)['"]/gu,
  )) {
    const file = ['.tsx', '.ts']
      .map((extension) => resolve(root, `src/${moduleName.slice('@src/'.length)}${extension}`))
      .find((candidate) => existsSync(candidate));
    if (file != null) {
      files.add(file);
    }
  }
  paneCache.set(panePath, { modifiedAt, files });
  return files;
}

// 마이 탭 메뉴 칸의 항목은 useMyPageMenuNavigate로만 연다. 직접 push하면 넓은 화면에서 오른쪽 칸을 바꾸지 않고 위에 쌓인다
const myPageMenuNavigation = {
  meta: { type: 'problem' },
  create(context) {
    const featuresIndex = context.filename.lastIndexOf('/src/features/');
    if (featuresIndex === -1) {
      return {};
    }
    const root = context.filename.slice(0, featuresIndex);
    if (!getMenuPaneComponentFiles(root).has(context.filename)) {
      return {};
    }
    return {
      MemberExpression(node) {
        const names = getMemberNames(node);
        if (names?.[0] === 'router' && ROUTER_NAVIGATION_METHODS.has(names[1])) {
          context.report({
            node,
            message: `마이 탭 메뉴 칸의 항목은 router.${names[1]} 대신 useMyPageMenuNavigate로 엽니다. 넓은 화면에서 오른쪽 칸을 바꾸고 선택 표시를 맞춥니다.`,
          });
        }
      },
    };
  },
};

const QUERY_HOOK_NAMES = new Set([
  'useInfiniteQuery',
  'useMutation',
  'useQuery',
  'useSuspenseQuery',
]);

// 조회·변경 옵션은 queries의 옵션 훅이 소유한다
const noInlineQueryOptions = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      CallExpression(node) {
        const name = getCalleeName(node.callee);
        if (QUERY_HOOK_NAMES.has(name) && node.arguments[0]?.type === 'ObjectExpression') {
          context.report({
            node,
            message: `${name} 옵션을 컴포넌트나 훅 안에 인라인으로 만들지 마세요. presentations/queries의 옵션 팩토리가 소유해야 합니다.`,
          });
        }
      },
    };
  },
};

// 쿼리 키는 constants/{feature}-query-keys.ts에서 만든다
const queryKeyLocation = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      Property(node) {
        if (
          isValueProperty(node) &&
          getKeyName(node) === 'queryKey' &&
          node.value.type === 'ArrayExpression'
        ) {
          context.report({
            node,
            message: '쿼리 키는 constants/{feature}-query-keys.ts에서 만듭니다.',
          });
        }
      },
    };
  },
};

// 실패 처리를 묶은 함수(`onError: showFailure`)는 호출부에서 햅틱·토스트·보고가 보이지 않는다
const mutationOnError = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      Property(node) {
        if (isValueProperty(node) && getKeyName(node) === 'onError' && !isFunction(node.value)) {
          context.report({
            node,
            message:
              'mutation onError는 햅틱·토스트를 그 자리에 나란히 적습니다. 실패 처리 함수로 묶지 않습니다.',
          });
        }
      },
    };
  },
};

const FORM_VARIABLE_NAMES = new Set(['methods', 'formMethods']);
const FORM_SHAPE_MESSAGE =
  '폼은 변수 form, useForm 제네릭 없이, Controller로 씁니다. FormProvider, useFormContext, FormField, methods, formMethods를 쓰지 않고 form을 props로 넘기세요.';

// 폼은 `form` 하나를 props로 넘기고 입력은 Controller로 잇는다(.claude/architecture.md#폼)
const formShape = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && FORM_VARIABLE_NAMES.has(node.id.name)) {
          context.report({ node, message: FORM_SHAPE_MESSAGE });
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'useForm' &&
          (node.typeArguments ?? node.typeParameters) != null
        ) {
          context.report({ node, message: FORM_SHAPE_MESSAGE });
        }
      },
    };
  },
};

export default {
  'sheet-route-params': sheetRouteParams,
  'no-destructured-search-params': noDestructuredSearchParams,
  'no-router-push': noRouterPush,
  'my-page-menu-navigation': myPageMenuNavigation,
  'no-inline-query-options': noInlineQueryOptions,
  'query-key-location': queryKeyLocation,
  'mutation-on-error': mutationOnError,
  'form-shape': formShape,
};
