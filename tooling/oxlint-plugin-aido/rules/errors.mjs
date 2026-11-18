import { unwrap } from '../ast.mjs';

/** 오류 값이 흔히 받는 이름. 타입 정보 없이 오류 객체를 알아보는 기준이다 */
const ERROR_NAMES = new Set(['error', 'err', 'e', 'failure', 'cause', 'rejection']);
/** `apiError`·`serverError`처럼 Error로 끝나는 이름도 오류 값으로 본다 */
const ERROR_NAME_SUFFIX = /[a-z]Error$/;
/** 서버가 준 판정 값. 기능은 이 값을 직접 읽지 않고 이름 있는 판별 함수로 읽는다 */
const ERROR_FIELDS = new Set(['status', 'statusCode', 'details', 'serverCode']);

const MESSAGE =
  '오류의 status·details·serverCode는 domains/{feature}.error.ts의 이름 있는 판별 함수로만 읽습니다(ErrorCode·공유 details 스키마). 상태 비교와 details 모양이 기능 곳곳에 흩어지지 않게 합니다(apps/mobile/docs/error-handling.md).';

/** `a.b`·`a['b']`의 b. 계산된 값이 문자열 리터럴이 아니면 null */
function getPropertyName(member) {
  if (!member.computed) {
    return member.property.type === 'Identifier' ? member.property.name : null;
  }
  return member.property.type === 'Literal' && typeof member.property.value === 'string'
    ? member.property.value
    : null;
}

/** 구조 분해 `{ status }`·`{ 'status': s }`의 키 이름 */
function getPatternKeyName(property) {
  if (property.type !== 'Property') {
    return null;
  }
  if (property.key.type === 'Identifier' && !property.computed) {
    return property.key.name;
  }
  return property.key.type === 'Literal' && typeof property.key.value === 'string'
    ? property.key.value
    : null;
}

/** `error.x`·`result.error.x`처럼 오류 값을 가리키는 식인지 */
function isErrorValue(node) {
  if (node == null) {
    return false;
  }
  if (node.type === 'Identifier') {
    return ERROR_NAMES.has(node.name) || ERROR_NAME_SUFFIX.test(node.name);
  }
  return node.type === 'MemberExpression' && getPropertyName(node) === 'error';
}

// 서버 오류 판별은 *.error.ts 하나에 둔다. 어디에 거는지는 .oxlintrc.json overrides가 정한다
const noErrorFieldAccess = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      MemberExpression(node) {
        if (ERROR_FIELDS.has(getPropertyName(node)) && isErrorValue(node.object)) {
          context.report({ node, message: MESSAGE });
        }
      },
      // `const { status } = error`처럼 구조 분해로 꺼내도 같다
      VariableDeclarator(node) {
        if (node.id.type !== 'ObjectPattern' || !isErrorValue(node.init)) {
          return;
        }
        for (const property of node.id.properties) {
          if (ERROR_FIELDS.has(getPatternKeyName(property))) {
            context.report({ node: property, message: MESSAGE });
          }
        }
      },
    };
  },
};

const ERROR_BASE_NAME = /(?:Error|Exception)$/u;
const BUILT_IN_ERRORS = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
  'EvalError',
  'URIError',
  'AggregateError',
]);

// 오류의 코드·details·재시도 판단은 *.errors.ts 한 곳에서 정한다. 어디에 거는지는 .oxlintrc.json overrides가 정한다
const errorClassLocation = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: { inlineThrow: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const checksInlineThrow = context.options[0]?.inlineThrow ?? false;
    function checkClass(node) {
      const base = node.superClass;
      if (base?.type !== 'Identifier' || !ERROR_BASE_NAME.test(base.name)) {
        return;
      }
      context.report({
        node: node.id ?? node,
        message: `${node.id?.name ?? '이름 없는 오류 클래스'}: 오류 클래스(${base.name} 하위)는 *.errors.ts에만 선언한다. 재시도 판단용 내부 오류(*RetryableError·*ConflictError)도 같다.`,
      });
    }
    return {
      ClassDeclaration: checkClass,
      ClassExpression: checkClass,
      ThrowStatement(node) {
        const thrown = unwrap(node.argument);
        if (
          !checksInlineThrow ||
          (thrown?.type !== 'NewExpression' && thrown?.type !== 'CallExpression') ||
          thrown.callee.type !== 'Identifier' ||
          !BUILT_IN_ERRORS.has(thrown.callee.name)
        ) {
          return;
        }
        context.report({
          node: thrown,
          message: `throw new ${thrown.callee.name}(…)를 바로 쓰지 않는다. application·domain의 오류는 <slice>.errors.ts의 이름 있는 생성 함수로 만든다.`,
        });
      },
    };
  },
};

export default {
  'no-error-field-access': noErrorFieldAccess,
  'error-class-location': errorClassLocation,
};
