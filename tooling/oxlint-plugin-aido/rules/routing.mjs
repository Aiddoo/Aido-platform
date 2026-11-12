import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getCalleeName,
  getKeyName,
  getMemberNames,
  isFunction,
  isValueProperty,
  unwrap,
} from '../ast.mjs';

// route 파일은 useRouteParamsOrRedirect로 검증하고 redirect만 그린다. 값은 안쪽 화면이 같은 스키마의 튜플 훅으로 읽는다
const routeParamsGuard = {
  meta: { type: 'suggestion' },
  create(context) {
    const guardResults = new Set();
    const paramsReads = [];
    return {
      VariableDeclarator(node) {
        if (
          node.id.type === 'Identifier' &&
          node.init?.type === 'CallExpression' &&
          getCalleeName(node.init.callee) === 'useRouteParamsOrRedirect'
        ) {
          guardResults.add(node.id.name);
        }
      },
      CallExpression(node) {
        if (
          getCalleeName(node.callee) === 'safeParse' &&
          node.arguments[0]?.type === 'CallExpression' &&
          getCalleeName(node.arguments[0].callee) === 'useLocalSearchParams'
        ) {
          context.report({
            node,
            message:
              'route params는 useRouteParamsOrRedirect로 검증합니다. 리다이렉트를 직접 만들지 마세요.',
          });
        }
      },
      MemberExpression(node) {
        const names = getMemberNames(node);
        if (names?.[1] === 'params') {
          paramsReads.push({ node, name: names[0] });
        }
      },
      'Program:exit'() {
        for (const { node, name } of paramsReads) {
          if (guardResults.has(name)) {
            context.report({
              node,
              message:
                'route 파일은 검증과 redirect만 합니다. 값은 안쪽 화면이 같은 스키마의 튜플 훅으로 읽습니다.',
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

// 쿼리 키는 queries/{feature}-query-keys.ts에서 만든다
const QUERY_KEY_FILE = /\/queries\/[a-z0-9-]+-query-keys\.ts$/u;

const queryKeyLocation = {
  meta: { type: 'suggestion' },
  create(context) {
    if (QUERY_KEY_FILE.test(context.filename)) {
      return {};
    }
    return {
      Property(node) {
        if (
          isValueProperty(node) &&
          getKeyName(node) === 'queryKey' &&
          node.value.type === 'ArrayExpression'
        ) {
          context.report({
            node,
            message: '쿼리 키는 queries/{feature}-query-keys.ts에서 만듭니다.',
          });
        }
      },
    };
  },
};

const REPORT_UNEXPECTED_ERROR_MODULE = '@src/shared/hooks/use-report-unexpected-error';
const MUTATION_OPTIONS_FACTORY = /MutationOptions$/u;
/** 같은 파일에서 값을 따라갈 수 없는 meta(import·멤버). 선언한 것으로 보고 더 검사하지 않는다 */
const UNRESOLVED = Symbol('unresolved');

const MISSING_MESSAGE =
  'mutationOptions에 meta.errorFeedback을 둡니다. 전역으로 알리면 { feature, fallbackKey?, describe? }, 기능이 실패 이유마다 다르게 보이면(useMutationErrorFeedback) 또는 화면 뒤 작업이면 false입니다.';
const DUPLICATE_FEEDBACK_MESSAGE =
  'meta.errorFeedback이 이미 햅틱·토스트로 알립니다. onError는 롤백과 isHandledByFeature로 뺀 오류만 다룹니다.';
const UNCONDITIONAL_FALLBACK_TOAST_MESSAGE =
  'onError가 조건 없이 기본 문구 토스트를 띄우면 전역 피드백과 겹칩니다. isHandledByFeature로 뺀 오류일 때만 보입니다.';

function findProperty(objectExpression, name) {
  return objectExpression.properties.find(
    (property) => property.type === 'Property' && getKeyName(property) === name,
  );
}

/** `mutationOptions({ … })`의 옵션 객체. 아니면 null */
function getMutationOptions(callExpression) {
  if (callExpression?.type !== 'CallExpression') {
    return null;
  }
  const options = unwrap(callExpression.arguments[0]);
  return getCalleeName(callExpression.callee) === 'mutationOptions' &&
    options?.type === 'ObjectExpression'
    ? options
    : null;
}

/** 객체 리터럴이면 그대로, 같은 파일의 const면 그 값, 따라갈 수 없으면 UNRESOLVED */
function resolveValue(node, declarations) {
  const value = unwrap(node);
  if (value?.type === 'Identifier' && value.name !== 'undefined') {
    const declared = declarations.get(value.name);
    return declared == null ? UNRESOLVED : unwrap(declared);
  }
  if (value?.type === 'MemberExpression') {
    return UNRESOLVED;
  }
  return value ?? null;
}

/** `...useXMutationOptions()`나 그 결과를 담은 const를 펼치면 그 옵션의 meta를 이어받는다 */
function inheritsMutationOptions(options, declarations) {
  return options.properties.some((property) => {
    if (property.type !== 'SpreadElement') {
      return false;
    }
    const spread = unwrap(property.argument);
    const source = spread?.type === 'Identifier' ? unwrap(declarations.get(spread.name)) : spread;
    return (
      source?.type === 'CallExpression' &&
      MUTATION_OPTIONS_FACTORY.test(getCalleeName(source.callee) ?? '')
    );
  });
}

/**
 * 옵션이 정한 오류 피드백. 'missing' | 'unresolved' | 'false' | 전역 피드백 객체
 * `errorFeedback: undefined`와 meta 없이 펼친 재시도 옵션 같은 객체는 빠진 것으로 본다
 */
function getErrorFeedback(options, declarations) {
  const metaProperty = findProperty(options, 'meta');
  if (metaProperty == null) {
    return inheritsMutationOptions(options, declarations) ? 'unresolved' : 'missing';
  }
  const meta = resolveValue(metaProperty.value, declarations);
  if (meta === UNRESOLVED) {
    return 'unresolved';
  }
  if (meta?.type !== 'ObjectExpression') {
    return 'missing';
  }
  const feedbackProperty = findProperty(meta, 'errorFeedback');
  if (feedbackProperty == null) {
    return 'missing';
  }
  const feedback = resolveValue(feedbackProperty.value, declarations);
  if (feedback === UNRESOLVED) {
    return 'unresolved';
  }
  if (feedback?.type === 'Literal' && feedback.value === false) {
    return 'false';
  }
  if (feedback?.type === 'ObjectExpression') {
    return feedback;
  }
  return feedback?.type === 'Identifier' ? 'missing' : 'unresolved';
}

/** onError 함수 몸통에서 조건 없이 도는 호출(맨 위 식 문장, 또는 화살표의 식 몸통) */
function getUnconditionalCalls(onError) {
  if (!isFunction(onError)) {
    return [];
  }
  if (onError.body.type !== 'BlockStatement') {
    const call = unwrap(onError.body);
    return call?.type === 'CallExpression' ? [call] : [];
  }
  return onError.body.body
    .filter(
      (statement) =>
        statement.type === 'ExpressionStatement' && statement.expression.type === 'CallExpression',
    )
    .map((statement) => statement.expression);
}

function isErrorHaptic(call) {
  const [first] = call.arguments;
  return (
    call.callee.type === 'MemberExpression' &&
    getCalleeName(call.callee) === 'notify' &&
    first?.type === 'Literal' &&
    first.value === 'error'
  );
}

function isErrorToast(call) {
  return getMemberNames(call.callee)?.join('.') === 'toast.error';
}

function passesFallbackMessage(call) {
  return call.arguments.some(
    (argument) =>
      unwrap(argument)?.type === 'CallExpression' &&
      getCalleeName(unwrap(argument).callee) === 'getUserFacingMessage',
  );
}

/** 이 노드를 감싼 가장 가까운 onError와 그 안에서 이 노드가 든 맨 위 문장 */
function findEnclosingOnError(node) {
  for (let current = node.parent; current != null; current = current.parent) {
    if (current.type === 'Property' && getKeyName(current) === 'onError') {
      const options = getMutationOptions(current.parent?.parent);
      if (options !== current.parent || !isFunction(current.value)) {
        return null;
      }
      const { body } = current.value;
      const topLevel =
        body.type === 'BlockStatement'
          ? (body.body.find((statement) => isAncestorOrSelf(statement, node)) ?? null)
          : body;
      return { options, topLevel };
    }
  }
  return null;
}

function isAncestorOrSelf(ancestor, node) {
  for (let current = node; current != null; current = current.parent) {
    if (current === ancestor) {
      return true;
    }
  }
  return false;
}

/** 맨 위 문장이 조건 없는 오류 토스트면 그 호출. 이미 다른 검사가 알린다 */
function isUnconditionalErrorToast(statement, onError) {
  const calls = getUnconditionalCalls(onError);
  const call = statement?.type === 'ExpressionStatement' ? statement.expression : unwrap(statement);
  return calls.includes(call) && isErrorToast(call);
}

// mutation 실패는 전역 meta.errorFeedback 한 곳에서 알린다(docs/error-handling.md#mutation-오류-피드백)
const mutationErrorFeedback = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    // 같은 파일의 const. meta·펼친 옵션을 따라가는 데 쓴다
    let declarations = new Map();
    return {
      before() {
        declarations = new Map();
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && node.init != null) {
          declarations.set(node.id.name, node.init);
        }
      },
      ImportDeclaration(node) {
        if (node.source.value === REPORT_UNEXPECTED_ERROR_MODULE) {
          context.report({
            node,
            message:
              'mutation 실패 보고는 meta.errorFeedback이 맡습니다. useReportUnexpectedError를 쓰지 않습니다.',
          });
        }
      },
      CallExpression(node) {
        const options = getMutationOptions(node);
        if (options != null) {
          const feedback = getErrorFeedback(options, declarations);
          if (feedback === 'missing') {
            context.report({ node, message: MISSING_MESSAGE });
          }
          if (typeof feedback !== 'object') {
            return;
          }
          const isHandledByFeature = findProperty(feedback, 'isHandledByFeature') != null;
          const onError = unwrap(findProperty(options, 'onError')?.value);
          for (const call of getUnconditionalCalls(onError)) {
            if (isErrorToast(call) && passesFallbackMessage(call)) {
              context.report({ node: call, message: UNCONDITIONAL_FALLBACK_TOAST_MESSAGE });
            } else if (!isHandledByFeature && (isErrorHaptic(call) || isErrorToast(call))) {
              context.report({ node: call, message: DUPLICATE_FEEDBACK_MESSAGE });
            }
          }
          return;
        }
        if (getCalleeName(node.callee) !== 'getUserFacingMessage') {
          return;
        }
        const enclosing = findEnclosingOnError(node);
        if (enclosing == null) {
          return;
        }
        const feedback = getErrorFeedback(enclosing.options, declarations);
        const onError = unwrap(findProperty(enclosing.options, 'onError')?.value);
        if (
          typeof feedback === 'object' &&
          findProperty(feedback, 'isHandledByFeature') == null &&
          !isUnconditionalErrorToast(enclosing.topLevel, onError)
        ) {
          context.report({ node, message: DUPLICATE_FEEDBACK_MESSAGE });
        }
      },
    };
  },
};

const FORM_VARIABLE_NAMES = new Set(['methods', 'formMethods']);
const FORM_SHAPE_MESSAGE =
  '폼은 변수 form, useForm 제네릭 없이, Controller로 씁니다. FormProvider, useFormContext, FormField, methods, formMethods를 쓰지 않고 form을 props로 넘기세요.';

// 폼은 `form` 하나를 props로 넘기고 입력은 Controller로 잇는다(apps/mobile/docs/architecture/data.md#폼)
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
  'route-params-guard': routeParamsGuard,
  'no-destructured-search-params': noDestructuredSearchParams,
  'no-router-push': noRouterPush,
  'my-page-menu-navigation': myPageMenuNavigation,
  'no-inline-query-options': noInlineQueryOptions,
  'query-key-location': queryKeyLocation,
  'mutation-error-feedback': mutationErrorFeedback,
  'form-shape': formShape,
};
