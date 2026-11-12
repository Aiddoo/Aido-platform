import { getCalleeName, getMemberNames, isFunction } from '../ast.mjs';

const MODULE_MOCK_METHODS = new Set(['mock', 'doMock', 'setMock']);

function isAppModule(moduleName) {
  return (
    moduleName.startsWith('@src/') || moduleName.startsWith('.') || moduleName.startsWith('@/')
  );
}

function getStringValue(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  return null;
}

// 모듈 mock은 어댑터 테스트의 SDK와 jest.setup·moduleNameMapper의 네이티브 모듈만 쓴다. 허용 목록은 두지 않는다
const noJestModuleMock = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: { allowPackages: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const allowPackages = context.options[0]?.allowPackages ?? false;
    return {
      CallExpression(node) {
        const names = getMemberNames(node.callee);
        const moduleName = getStringValue(node.arguments[0]);
        if (
          names?.[0] !== 'jest' ||
          !MODULE_MOCK_METHODS.has(names[1]) ||
          moduleName == null ||
          (allowPackages && !isAppModule(moduleName))
        ) {
          return;
        }
        context.report({
          node,
          message: `${moduleName}를 jest.mock하지 않습니다. 포트 stub과 createTestDi, renderScreen을 쓰고, 네이티브 모듈은 jest.setup이나 moduleNameMapper에 둡니다.`,
        });
      },
    };
  },
};

const RENDER_SCREEN_MODULE = '@src/testing/render';
const UI_TEST_MODULE_PREFIXES = [
  '@shopify/flash-list',
  '@src/shared/ui',
  '@testing-library/',
  'expo-router',
  'heroui-native',
  'react-native',
];

function isRenderScreenImport(statement) {
  return statement.type === 'ImportDeclaration' && statement.source.value === RENDER_SCREEN_MODULE;
}

function isUiTestModule(moduleName) {
  return (
    moduleName === 'react' ||
    moduleName.startsWith('react/') ||
    UI_TEST_MODULE_PREFIXES.some((prefix) => moduleName.startsWith(prefix)) ||
    moduleName.includes('/components/') ||
    moduleName.includes('/hooks/') ||
    moduleName.includes('/providers/') ||
    moduleName.includes('/testing/render')
  );
}

// 댓글 테스트는 model, service/mapper, 순수 navigation·util·view-model 옆에 둔다. 컴포넌트 옆 테스트는 공용 renderScreen로만 쓴다
const todoCommentTestLocation = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: { allowRenderScreen: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const allowRenderScreen = context.options[0]?.allowRenderScreen ?? false;
    return {
      Program(program) {
        if (allowRenderScreen && program.body.some(isRenderScreenImport)) {
          return;
        }
        context.report({
          node: program,
          message:
            '댓글 클라이언트 테스트는 model, service/mapper, pure navigation/util/view-model에만 둡니다. 컴포넌트 동작은 공용 renderScreen로만 확인하고, hook, Provider, Query Options 배선을 테스트 코드로 복제하지 마세요.',
        });
      },
    };
  },
};

// 댓글 model/service/util 테스트에는 TSX나 React Native UI 배선을 넣지 않는다
const todoCommentTestPurity = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      Program(program) {
        const importsUi = program.body.some(
          (statement) =>
            statement.type === 'ImportDeclaration' &&
            (isUiTestModule(statement.source.value) || isRenderScreenImport(statement)),
        );
        if (context.filename.endsWith('x') || importsUi) {
          context.report({
            node: program,
            message:
              '댓글 model/service/util 테스트에는 TSX나 React Native UI 배선을 넣지 마세요. UI 동작은 native 검증 행렬에서 확인합니다.',
          });
        }
      },
    };
  },
};

const DATE_OBJECTS = new Set(['Date', 'global.Date', 'globalThis.Date']);

/** `jest.spyOn(대상, '메서드')`의 대상과 메서드 이름을 고친 이유 */
function describeSpyTarget(target, methodName, sourceCode) {
  const targetText = sourceCode.getText(target);
  if (DATE_OBJECTS.has(targetText) && methodName === 'now') {
    return 'Date.now를 spy하지 않습니다. 시각은 인자(now)로 넘기거나 setupFakeTimersPerTest의 시스템 시각을 씁니다.';
  }
  if (targetText === 'AppState') {
    return 'AppState를 spy하지 않습니다. createAppLifecycleGatewayStub(initial)의 emit(state)로 앱 수명을 흘립니다.';
  }
  if (methodName === 'invalidateQueries') {
    return 'invalidateQueries를 spy하지 않습니다. 무효화 뒤 캐시 상태(getQueryState·isInvalidated)로 단언합니다.';
  }
  return null;
}

// 시간·앱 수명·캐시는 내부 호출 횟수가 아니라 stub과 캐시 상태로 확인한다
const testSpyTarget = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      CallExpression(node) {
        const names = getMemberNames(node.callee);
        const [target, method] = node.arguments;
        if (names?.[0] !== 'jest' || names[1] !== 'spyOn' || target == null) {
          return;
        }
        const message = describeSpyTarget(target, getStringValue(method), context.sourceCode);
        if (message != null) {
          context.report({ node, message });
        }
      },
    };
  },
};

const TIMER_NAMES = new Set(['setTimeout', 'setImmediate']);

/** 타이머 호출을 감싼 가장 가까운 함수가 `new Promise(executor)`의 executor면 그 `new Promise` */
function findSleepingPromise(timerCall) {
  let current = timerCall.parent;
  while (current != null && !isFunction(current) && current.type !== 'FunctionDeclaration') {
    current = current.parent;
  }
  const promise = current?.parent;
  return promise?.type === 'NewExpression' &&
    promise.callee.type === 'Identifier' &&
    promise.callee.name === 'Promise' &&
    promise.arguments[0] === current
    ? promise
    : null;
}

// 실제 시간을 기다리면 테스트가 느리고 순서에 따라 흔들린다
const noRealSleep = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!TIMER_NAMES.has(getCalleeName(node.callee))) {
          return;
        }
        const promise = findSleepingPromise(node);
        if (promise != null) {
          context.report({
            node: promise,
            message:
              '테스트에서 실제 시간을 기다리지 않습니다. setupFakeTimersPerTest와 await jest.advanceTimersByTimeAsync(ms)를 쓰거나 findBy*로 결과를 기다립니다.',
          });
        }
      },
    };
  },
};

const STYLE_MATCHERS = new Set(['toHaveStyle']);

// 표시·배치는 기기에서 확인하고 테스트는 동작과 결과를 본다. 스타일을 단언하면 디자인을 바꿀 때마다 테스트가 깨진다
const noStyleAssertion = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    const message =
      '스타일을 단언하지 않습니다. 표시·배치는 기기에서 확인하고 테스트는 동작과 사용자 결과를 봅니다.';
    return {
      MemberExpression(node) {
        if (node.computed || node.property.type !== 'Identifier') {
          return;
        }
        const isStyleMatcher =
          STYLE_MATCHERS.has(node.property.name) && node.parent.type === 'CallExpression';
        const isPropsStyle =
          node.property.name === 'style' &&
          node.object.type === 'MemberExpression' &&
          !node.object.computed &&
          node.object.property.name === 'props';
        if (isStyleMatcher || isPropsStyle) {
          context.report({ node, message });
        }
      },
      CallExpression(node) {
        const names = getMemberNames(node.callee);
        if (names?.[0] === 'StyleSheet' && names[1] === 'flatten') {
          context.report({ node, message });
        }
      },
    };
  },
};

const TEST_FUNCTIONS = new Set(['it', 'test']);
const GWT_LABEL = /^(Given|When|Then)\b/u;
const REQUIRED_LABELS = ['When', 'Then'];

function isEachMember(node) {
  return (
    node?.type === 'MemberExpression' &&
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'each'
  );
}

/** `it(…)`·`test(…)`, `it.each(table)(…)`, `it.each`…`(…)`의 it·test */
function getTestFunctionName(callee) {
  if (callee.type === 'Identifier') {
    return callee.name;
  }
  if (callee.type === 'CallExpression' && isEachMember(callee.callee)) {
    return callee.callee.object.name;
  }
  if (callee.type === 'TaggedTemplateExpression' && isEachMember(callee.tag)) {
    return callee.tag.object.name;
  }
  return null;
}

// 테스트 본문은 `// Given`·`// When`·`// Then` 한 줄 주석으로 나눈다. 준비가 없으면 Given만 생략한다.
// 합본(`// When / Then`)과 꼬리 설명(`// Then 저장된다`)은 쓰지 않는다(docs/conventions/testing.md#2-형식)
const testGwtComments = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!TEST_FUNCTIONS.has(getTestFunctionName(node.callee))) {
          return;
        }
        const callback = node.arguments.slice(1).find(isFunction);
        if (callback == null || callback.body.type !== 'BlockStatement') {
          return;
        }
        const labels = new Set();
        for (const comment of context.sourceCode.getCommentsInside(callback.body)) {
          const text = comment.value.trim();
          const label = comment.type === 'Line' ? GWT_LABEL.exec(text)?.[1] : null;
          if (label == null) {
            continue;
          }
          if (text !== label) {
            context.report({
              node: comment,
              message: `// ${text}: Given·When·Then 주석은 한 단어만 쓴다. 합본과 꼬리 설명을 쓰지 않고 줄을 나눈다.`,
            });
            return;
          }
          labels.add(label);
        }
        const missing = REQUIRED_LABELS.filter((label) => !labels.has(label));
        if (missing.length > 0) {
          context.report({
            node,
            message: `테스트 본문을 // When·// Then 주석으로 나눈다(빠짐: ${missing.join(', ')}). 준비가 있으면 // Given을 앞에 둔다.`,
          });
        }
      },
    };
  },
};

export default {
  'no-jest-module-mock': noJestModuleMock,
  'todo-comment-test-location': todoCommentTestLocation,
  'todo-comment-test-purity': todoCommentTestPurity,
  'test-spy-target': testSpyTarget,
  'no-real-sleep': noRealSleep,
  'no-style-assertion': noStyleAssertion,
  'test-gwt-comments': testGwtComments,
};
