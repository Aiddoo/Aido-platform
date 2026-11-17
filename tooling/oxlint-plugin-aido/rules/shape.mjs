import { getKeyName } from '../ast.mjs';

const MEMBER_GROUPS = [
  'static 팩토리',
  '필드',
  '생성자',
  'public getter',
  'public 메서드',
  '# 비공개 getter·메서드',
];
const MEMBER_ORDER = MEMBER_GROUPS.join(' → ');
const FIELD_TYPES = new Set([
  'PropertyDefinition',
  'AccessorProperty',
  'TSAbstractPropertyDefinition',
  'TSAbstractAccessorProperty',
]);
const METHOD_TYPES = new Set(['MethodDefinition', 'TSAbstractMethodDefinition']);
const NON_PUBLIC_ACCESSIBILITY = new Set(['private', 'protected']);

function getMemberName(member) {
  if (member.type === 'StaticBlock') {
    return 'static 블록';
  }
  if (member.key?.type === 'PrivateIdentifier') {
    return `#${member.key.name}`;
  }
  return getKeyName(member) ?? '[계산된 키]';
}

function getMemberGroup(member) {
  if (member.type === 'StaticBlock' || member.static === true) {
    return 0;
  }
  if (FIELD_TYPES.has(member.type)) {
    return 1;
  }
  if (!METHOD_TYPES.has(member.type)) {
    return null;
  }
  if (member.kind === 'constructor') {
    return 2;
  }
  if (
    member.key?.type === 'PrivateIdentifier' ||
    NON_PUBLIC_ACCESSIBILITY.has(member.accessibility)
  ) {
    return 5;
  }
  return member.kind === 'get' || member.kind === 'set' ? 3 : 4;
}

// 클래스를 위에서 아래로 읽으면 만드는 법 → 상태 → 공개 면 → 구현 순서로 보이게 한다
const memberOrder = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    function check(node) {
      let latest = null;
      for (const member of node.body.body) {
        const group = getMemberGroup(member);
        if (group == null) {
          continue;
        }
        if (latest != null && group < latest.group) {
          context.report({
            node: member.key ?? member,
            message: `${getMemberName(member)}(${MEMBER_GROUPS[group]})는 ${latest.name}(${MEMBER_GROUPS[latest.group]})보다 앞에 둔다. 순서: ${MEMBER_ORDER}.`,
          });
          continue;
        }
        latest = { group, name: getMemberName(member) };
      }
    }
    return { ClassDeclaration: check, ClassExpression: check };
  },
};

function isThisParameter(parameter) {
  return parameter.type === 'Identifier' && parameter.name === 'this';
}

// @Param()·@Body()·@CurrentUser()처럼 Nest가 요청에서 채우는 인자는 호출하는 쪽이 넘기지 않는다
function isDecoratedParameter(parameter) {
  const target = parameter.type === 'AssignmentPattern' ? parameter.left : parameter;
  return (parameter.decorators?.length ?? 0) > 0 || (target.decorators?.length ?? 0) > 0;
}

// Nest는 데코레이터를 단 클래스의 생성자 인자 타입으로 의존성을 주입한다. 그 생성자는 인자 수가 의존성 수다
function isInjectedConstructor(node) {
  const method = node.parent;
  if (method?.type !== 'MethodDefinition' || method.kind !== 'constructor') {
    return false;
  }
  const classNode = method.parent?.parent;
  return (classNode?.decorators?.length ?? 0) > 0;
}

// 내장 max-params는 생성자·데코레이터 인자를 뺄 옵션이 없어 Nest가 채우는 것만 빼고 같은 기준으로 센다
const maxParams = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: { max: { type: 'integer', minimum: 0 } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const max = context.options[0]?.max ?? 3;
    function check(node) {
      const count = node.params.filter(
        (parameter) => !isThisParameter(parameter) && !isDecoratedParameter(parameter),
      ).length;
      if (count <= max || isInjectedConstructor(node)) {
        return;
      }
      context.report({
        node,
        message: `인자가 ${count}개다. ${max}개 이하로 두고, 넘으면 이름 붙은 객체 하나로 받는다(Nest가 주입하는 생성자와 데코레이터 인자는 세지 않는다).`,
      });
    }
    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
      TSDeclareFunction: check,
      TSEmptyBodyFunctionExpression: check,
    };
  },
};

export default {
  'member-order': memberOrder,
  'max-params': maxParams,
};
