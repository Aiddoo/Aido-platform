import { getCalleeName, getImportedName, unwrap } from '../ast.mjs';

// 정해진 층·파일에서만 쓰는 것. 규칙은 쓰임만 찾고 허용 경로는 .oxlintrc.json의 overrides가 끈다

function isTypeImport(declaration, specifier) {
  return declaration.importKind === 'type' || specifier.importKind === 'type';
}

/** 값으로 import한 이름 중 names에 든 specifier */
function* findValueImports(declaration, names) {
  for (const specifier of declaration.specifiers) {
    if (
      specifier.type === 'ImportSpecifier' &&
      names.has(getImportedName(specifier)) &&
      !isTypeImport(declaration, specifier)
    ) {
      yield specifier;
    }
  }
}

const TRACK_NAMES = new Set(['useTrack', 'track']);
const ANALYTICS_MODULE = /(?:^|\/)analytics(?:\/(?:use-)?track)?$|^\.\/(?:use-)?track$/u;

// 추적은 mutation 콜백·컴포넌트·훅이 한다. api·service·repository·store·mapper·model·cache는 추적하지 않는다
const trackLocation = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    const message =
      '이 층은 추적하지 않습니다. 서버가 확정한 결과는 mutation onSuccess·onError, 보여짐·누름은 컴포넌트·훅에서 useTrack으로 보냅니다.';
    return {
      ImportDeclaration(node) {
        if (!ANALYTICS_MODULE.test(node.source.value)) {
          return;
        }
        for (const specifier of findValueImports(node, TRACK_NAMES)) {
          context.report({ node: specifier, message });
        }
      },
      CallExpression(node) {
        if (getCalleeName(node.callee) === 'trackEvent') {
          context.report({ node, message });
        }
      },
    };
  },
};

function isQueryClientType(annotation) {
  const type = annotation?.typeAnnotation;
  return (
    type?.type === 'TSTypeReference' &&
    type.typeName.type === 'Identifier' &&
    type.typeName.name === 'QueryClient'
  );
}

function isUseQueryClientCall(node) {
  return node?.type === 'CallExpression' && getCalleeName(node.callee) === 'useQueryClient';
}

// queryClient의 메서드는 cache helper와 앱 조립만 부른다. 화면·훅은 queryClient를
// helper(invalidate{X}·set{X}InCache·refresh{Feature})에 넘기기만 한다. queryClient라는 이름과
// useQueryClient()·QueryClient 타입으로 받은 이름을 본다
const queryClientLocation = {
  meta: { type: 'suggestion' },
  create(context) {
    const clientNames = new Set(['queryClient']);
    const memberCalls = [];
    function report(node, method) {
      context.report({
        node,
        message: `queryClient.${method}: queryClient는 queries/*-cache.ts의 helper와 bootstrap만 만집니다. 화면·훅은 helper(invalidate{X}·set{X}InCache·refresh{Feature})에 넘기세요.`,
      });
    }
    return {
      VariableDeclarator(node) {
        if (
          node.id.type === 'Identifier' &&
          (isUseQueryClientCall(unwrap(node.init)) || isQueryClientType(node.id.typeAnnotation))
        ) {
          clientNames.add(node.id.name);
        }
      },
      Identifier(node) {
        if (node.parent.type !== 'VariableDeclarator' && isQueryClientType(node.typeAnnotation)) {
          clientNames.add(node.name);
        }
      },
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'QueryClient') {
          report(node, 'constructor');
        }
      },
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type !== 'MemberExpression' ||
          callee.computed ||
          callee.property.type !== 'Identifier'
        ) {
          return;
        }
        const object = unwrap(callee.object);
        if (isUseQueryClientCall(object)) {
          report(node, callee.property.name);
        } else if (object.type === 'Identifier') {
          memberCalls.push({ node, name: object.name, method: callee.property.name });
        }
      },
      'Program:exit'() {
        for (const { node, name, method } of memberCalls) {
          if (clientNames.has(name)) {
            report(node, method);
          }
        }
      },
    };
  },
};

const STORAGE_KEY_PREFIX = 'aido_';

function getLeadingText(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral') {
    return node.quasis[0].value.cooked ?? '';
  }
  return null;
}

// 기기 저장 키 문자열(aido_…)은 저장 값 정의(*-storage.schema.ts)와 남은 repository에만 둔다
const storageKeyLocation = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    function check(node) {
      if (getLeadingText(node)?.startsWith(STORAGE_KEY_PREFIX)) {
        context.report({
          node,
          message:
            '기기 저장 키 문자열은 schemas/{name}-storage.schema.ts의 defineStoredValue나 repositories/에만 둡니다. 키를 밖으로 내보내지 말고 저장 값 정의를 쓰세요.',
        });
      }
    }
    return { Literal: check, TemplateLiteral: check };
  },
};

const COMPARISON_OPERATORS = new Set(['===', '!==', '==', '!=', '<', '<=', '>', '>=']);
const STATUS_PROPERTY_NAMES = new Set(['status', 'statusCode']);
const STATUS_CONSTANT_NAME = /^[A-Z][A-Z0-9_]*_STATUS(?:_CODE)?$/u;
const HTTP_STATUS_MESSAGE =
  'HTTP 상태 숫자를 직접 쓰지 않습니다. @aido/api/errors의 HttpStatus(HttpStatus.NOT_FOUND)를 쓰고, 상태 해석은 shared/infra/http가 합니다.';

function isHttpStatusNumber(node) {
  return (
    node?.type === 'Literal' &&
    typeof node.value === 'number' &&
    100 <= node.value &&
    node.value <= 599
  );
}

function isStatusRead(node) {
  if (node.type === 'Identifier') {
    return STATUS_PROPERTY_NAMES.has(node.name);
  }
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    STATUS_PROPERTY_NAMES.has(node.property.name)
  );
}

// `error.status === 404`와 `NOT_FOUND_STATUS = 404`는 HttpStatus로 쓴다
const httpStatusLiteral = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      BinaryExpression(node) {
        if (!COMPARISON_OPERATORS.has(node.operator)) {
          return;
        }
        const { left, right } = node;
        if (
          (isStatusRead(left) && isHttpStatusNumber(right)) ||
          (isStatusRead(right) && isHttpStatusNumber(left))
        ) {
          context.report({ node, message: HTTP_STATUS_MESSAGE });
        }
      },
      SwitchCase(node) {
        if (isStatusRead(node.parent.discriminant) && isHttpStatusNumber(node.test)) {
          context.report({ node: node.test, message: HTTP_STATUS_MESSAGE });
        }
      },
      VariableDeclarator(node) {
        if (
          node.id.type === 'Identifier' &&
          STATUS_CONSTANT_NAME.test(node.id.name) &&
          isHttpStatusNumber(unwrap(node.init))
        ) {
          context.report({ node, message: `${node.id.name}: ${HTTP_STATUS_MESSAGE}` });
        }
      },
    };
  },
};

function createReactNativeImportRule(name, message) {
  const names = new Set([name]);
  return {
    meta: { type: 'suggestion' },
    createOnce(context) {
      return {
        ImportDeclaration(node) {
          if (node.source.value !== 'react-native') {
            return;
          }
          for (const specifier of findValueImports(node, names)) {
            context.report({ node: specifier, message });
          }
        },
      };
    },
  };
}

// 앱 수명은 AppLifecycleGateway 포트(shared/infra 어댑터)와 useOnAppForeground로 듣는다
const appStateLocation = createReactNativeImportRule(
  'AppState',
  'react-native의 AppState를 직접 듣지 않습니다. AppLifecycleGateway 포트나 useOnAppForeground를 쓰세요(테스트는 createAppLifecycleGatewayStub).',
);

// Android 뒤로 가기는 useAndroidBackHandler 하나가 화면 포커스와 묶어 듣는다
const backHandlerLocation = createReactNativeImportRule(
  'BackHandler',
  'react-native의 BackHandler를 직접 듣지 않습니다. shared/hooks의 useAndroidBackHandler({ isEnabled, onBack })를 쓰세요.',
);

export default {
  'track-location': trackLocation,
  'query-client-location': queryClientLocation,
  'storage-key-location': storageKeyLocation,
  'http-status-literal': httpStatusLiteral,
  'app-state-location': appStateLocation,
  'back-handler-location': backHandlerLocation,
};
