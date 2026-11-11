import { getCalleeName, getMemberNames, isFunction, unwrap } from '../ast.mjs';

const STRICT_EQUALITY = new Set(['===', '!==']);

function isNullish(node) {
  return (
    (node.type === 'Literal' && node.value === null && node.raw === 'null') ||
    (node.type === 'Identifier' && node.name === 'undefined')
  );
}

// "없음" 판단은 == null로 한다. null과 undefined의 뜻이 달라 엄격하게 비교하면 그 줄에서 이유와 함께 끈다
const noStrictNullish = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      BinaryExpression(node) {
        if (STRICT_EQUALITY.has(node.operator) && (isNullish(node.left) || isNullish(node.right))) {
          context.report({
            node,
            message:
              '"없음" 판단은 == null / != null로 쓰세요. null과 undefined의 뜻이 달라 엄격하게 비교해야 하면 그 줄 위에 // oxlint-disable-next-line aido/no-strict-nullish -- <이유>를 남기세요. (docs/conventions/nullish.md)',
          });
        }
      },
    };
  },
};

const ORDER_OPERATORS = new Set(['<', '<=', '>', '>=']);

function isOrderComparison(node) {
  return node.type === 'BinaryExpression' && ORDER_OPERATORS.has(node.operator);
}

function getAndOperands(node) {
  if (node.type === 'LogicalExpression' && node.operator === '&&') {
    return [...getAndOperands(node.left), ...getAndOperands(node.right)];
  }
  return [node];
}

function isBoundOnRight(comparison) {
  return comparison.operator === '<' || comparison.operator === '<=';
}

function isNumberLiteral(node) {
  return node.type === 'Literal' && typeof node.value === 'number';
}

// 수직선 순서로 읽히게 범위 비교는 `min <= x && x <= max`로 쓴다
const rangeComparisonOrder = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    function isRangeInWrongOrder(first, second) {
      if (isBoundOnRight(first) === isBoundOnRight(second)) {
        return false;
      }
      const text = (node) => context.sourceCode.getText(node);
      if (text(first.left) === text(second.left)) {
        return !isNumberLiteral(first.left);
      }
      return text(first.right) === text(second.right) && !isNumberLiteral(first.right);
    }

    return {
      LogicalExpression(node) {
        const isChainRoot =
          node.operator === '&&' &&
          !(node.parent.type === 'LogicalExpression' && node.parent.operator === '&&');
        if (!isChainRoot) {
          return;
        }
        const operands = getAndOperands(node);
        for (const [index, operand] of operands.entries()) {
          const next = operands[index + 1];
          if (
            next != null &&
            isOrderComparison(operand) &&
            isOrderComparison(next) &&
            isRangeInWrongOrder(operand, next)
          ) {
            context.report({
              node: operand,
              message: '범위 비교는 왼쪽에서 오른쪽으로 읽히게 `min <= x && x <= max`로 쓰세요.',
            });
          }
        }
      },
    };
  },
};

const COMPONENT_WRAPPERS = new Set(['memo', 'forwardRef']);

function isModuleArrowValue(value) {
  if (isFunction(value)) {
    return true;
  }
  if (value.type !== 'CallExpression' || !COMPONENT_WRAPPERS.has(getCalleeName(value.callee))) {
    return false;
  }
  const [render] = value.arguments;
  return render != null && unwrap(render).type === 'ArrowFunctionExpression';
}

// 모듈 수준 함수는 function 선언이다. 화살표는 Service 필드, 컴포넌트 안 핸들러, 인라인 콜백만 쓴다
const functionDeclaration = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    function check(statement) {
      if (statement?.type !== 'VariableDeclaration') {
        return;
      }
      for (const declarator of statement.declarations) {
        const value = unwrap(declarator.init);
        if (value != null && isModuleArrowValue(value)) {
          context.report({
            node: declarator,
            message: '모듈 수준 함수는 function 선언으로 씁니다.',
          });
        }
      }
    }
    return {
      Program(program) {
        for (const statement of program.body) {
          check(statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement);
        }
      },
    };
  },
};

function hasDefaultValue(pattern) {
  switch (pattern?.type) {
    case 'AssignmentPattern':
      return true;
    case 'TSParameterProperty':
      return hasDefaultValue(pattern.parameter);
    case 'RestElement':
      return hasDefaultValue(pattern.argument);
    case 'ObjectPattern':
      return pattern.properties.some((property) =>
        hasDefaultValue(property.type === 'Property' ? property.value : property),
      );
    case 'ArrayPattern':
      return pattern.elements.some(hasDefaultValue);
    default:
      return false;
  }
}

function isWorkletDirective(statement) {
  return (
    statement.type === 'ExpressionStatement' &&
    statement.expression.type === 'Literal' &&
    statement.expression.value === 'worklet'
  );
}

// Reanimated가 모듈 값을 잡아 주지 않아 worklet의 매개변수 기본값은 UI 스레드에서 죽는다
const workletParamDefault = {
  meta: { type: 'problem' },
  createOnce(context) {
    function check(node) {
      if (
        node.body?.type === 'BlockStatement' &&
        node.body.body.some(isWorkletDirective) &&
        node.params.some(hasDefaultValue)
      ) {
        context.report({
          node,
          message:
            'worklet 함수의 매개변수 기본값은 Reanimated가 모듈 값을 잡아 주지 않아 UI 스레드에서 오류가 납니다. 호출부가 값을 넘기세요.',
        });
      }
    }
    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    };
  },
};

const ROLE_CONSTANTS = new Set(['USER_ROLE', 'PREMIUM_SOURCE']);

// 역할과 프리미엄 출처 판별은 domains의 Policy가 한다
const noRoleComparison = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      BinaryExpression(node) {
        if (
          STRICT_EQUALITY.has(node.operator) &&
          [node.left, node.right].some((side) => ROLE_CONSTANTS.has(getMemberNames(side)?.[0]))
        ) {
          context.report({ node, message: '역할과 프리미엄 출처 판별은 Policy에 둡니다.' });
        }
      },
    };
  },
};

export default {
  'no-strict-nullish': noStrictNullish,
  'range-comparison-order': rangeComparisonOrder,
  'function-declaration': functionDeclaration,
  'worklet-param-default': workletParamDefault,
  'no-role-comparison': noRoleComparison,
};
