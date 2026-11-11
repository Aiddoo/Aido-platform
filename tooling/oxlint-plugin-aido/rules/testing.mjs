import { getMemberNames } from '../ast.mjs';

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

export default {
  'no-jest-module-mock': noJestModuleMock,
  'todo-comment-test-location': todoCommentTestLocation,
  'todo-comment-test-purity': todoCommentTestPurity,
};
