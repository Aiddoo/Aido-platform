/** 오류 값이 흔히 받는 이름. 타입 정보 없이 오류 객체를 알아보는 기준이다 */
const ERROR_NAMES = new Set(['error', 'err', 'failure', 'cause', 'rejection']);
/** 서버가 준 판정 값. 기능은 이 값을 직접 읽지 않고 이름 있는 판별 함수로 읽는다 */
const ERROR_FIELDS = new Set(['status', 'statusCode', 'details', 'serverCode']);

const MESSAGE =
  '오류의 status·details·serverCode는 domains/{feature}.error.ts의 이름 있는 판별 함수로만 읽습니다(ErrorCode·공유 details 스키마). 상태 비교와 details 모양이 기능 곳곳에 흩어지지 않게 합니다(apps/mobile/docs/error-handling.md).';

/** `a.b`의 b. 계산된 접근(`a[b]`)이면 null */
function getPropertyName(member) {
  return !member.computed && member.property.type === 'Identifier' ? member.property.name : null;
}

/** `error.x`·`result.error.x`처럼 오류 값을 가리키는 식인지 */
function isErrorValue(node) {
  if (node.type === 'Identifier') {
    return ERROR_NAMES.has(node.name);
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
    };
  },
};

export default {
  'no-error-field-access': noErrorFieldAccess,
};
