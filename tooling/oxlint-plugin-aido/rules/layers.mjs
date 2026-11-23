import { getKeyName, getTypeArguments, topLevelDeclarations } from '../ast.mjs';

const CLASS_MEMBER_TYPES = new Set([
  'MethodDefinition',
  'PropertyDefinition',
  'AccessorProperty',
  'TSAbstractMethodDefinition',
  'TSAbstractPropertyDefinition',
  'TSAbstractAccessorProperty',
]);
const NON_PUBLIC_ACCESSIBILITY = new Set(['private', 'protected']);

function getMemberName(member) {
  if (member.key?.type === 'PrivateIdentifier') {
    return `#${member.key.name}`;
  }
  return getKeyName(member) ?? '[계산된 키]';
}

function isPublicMember(member) {
  return (
    CLASS_MEMBER_TYPES.has(member.type) &&
    member.key?.type !== 'PrivateIdentifier' &&
    !NON_PUBLIC_ACCESSIBILITY.has(member.accessibility)
  );
}

function getAnnotation(node) {
  return node?.typeAnnotation?.typeAnnotation ?? null;
}

function getReturnType(functionNode) {
  return functionNode?.returnType?.typeAnnotation ?? null;
}

function getReferenceName(type) {
  return type?.type === 'TSTypeReference' && type.typeName.type === 'Identifier'
    ? type.typeName.name
    : null;
}

function getTypeArgumentList(type) {
  return getTypeArguments(type)?.params ?? [];
}

function getSuperTypeArgumentList(classNode) {
  return (classNode.superTypeArguments ?? classNode.superTypeParameters)?.params ?? [];
}

/** 이 파일 최상위에 선언한 interface·type 별칭(이름 → 선언) */
function collectLocalTypes(program) {
  const types = new Map();
  for (const declaration of topLevelDeclarations(program)) {
    if (
      declaration.type === 'TSInterfaceDeclaration' ||
      declaration.type === 'TSTypeAliasDeclaration'
    ) {
      types.set(declaration.id.name, declaration);
    }
  }
  return types;
}

const AGGREGATE_BASE = 'AggregateRoot';
const STATE_QUESTION_NAME = /^(?:is|has|can)[A-Z]/u;

// Aggregate는 같은 모양이어야 복원·생성 경로와 상태 질문을 이름만 보고 찾는다(apps/api/docs/domain-modeling.md)
const aggregateShape = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: { factories: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const factories = new Set(context.options[0]?.factories ?? ['create', 'reconstitute']);
    const factoryNames = [...factories].join('·');
    let localTypes = new Map();

    function checkProps(node, name) {
      const [, props] = getSuperTypeArgumentList(node);
      const expected = `${name}Props`;
      const declaration = localTypes.get(expected);
      if (getReferenceName(props) === expected && declaration?.type === 'TSInterfaceDeclaration') {
        return;
      }
      context.report({
        node: props ?? node.superClass,
        message: `${name}: Props는 같은 파일의 interface ${expected}로 선언하고 AggregateRoot의 두 번째 타입 인자로 넘긴다.`,
      });
    }

    function checkMember(member, name) {
      if (member.type === 'StaticBlock') {
        context.report({
          node: member,
          message: `${name}: Aggregate에 static 블록을 두지 않는다. static은 ${factoryNames}뿐이다.`,
        });
        return;
      }
      if (!CLASS_MEMBER_TYPES.has(member.type)) {
        return;
      }
      const memberName = getMemberName(member);
      if (member.static) {
        if (!factories.has(memberName)) {
          context.report({
            node: member.key ?? member,
            message: `${name}.${memberName}: Aggregate의 static은 ${factoryNames}뿐이다. 계산은 *.domain-service.ts 함수로, 값은 domain/<slice>.constants.ts로 옮긴다.`,
          });
        }
        return;
      }
      if (member.kind === 'constructor' && !NON_PUBLIC_ACCESSIBILITY.has(member.accessibility)) {
        context.report({
          node: member.key ?? member,
          message: `${name}: Aggregate는 생성자를 열지 않는다. 베이스의 protected constructor를 ${factoryNames} 안에서만 부른다.`,
        });
        return;
      }
      const returnType = getReturnType(member.value);
      if (
        member.kind === 'get' &&
        (STATE_QUESTION_NAME.test(memberName) || returnType?.type === 'TSBooleanKeyword')
      ) {
        context.report({
          node: member.key ?? member,
          message: `${name}.${memberName}: 상태 질문은 getter가 아니라 is*()·has*()·can*() 메서드로 묻는다. getter는 값 꺼내기만 한다.`,
        });
      }
    }

    function checkClass(node) {
      if (node.superClass?.type !== 'Identifier' || node.superClass.name !== AGGREGATE_BASE) {
        return;
      }
      const name = node.id?.name ?? '이름 없는 Aggregate';
      checkProps(node, name);
      for (const member of node.body.body) {
        checkMember(member, name);
      }
    }

    return {
      Program(program) {
        localTypes = collectLocalTypes(program);
      },
      ClassDeclaration: checkClass,
      ClassExpression: checkClass,
    };
  },
};

const USE_CASE_NAME = /UseCase$/u;

// UseCase 하나가 행동 하나다. 공개 메서드가 둘이면 조립·권한·트랜잭션 경계가 섞인다
const useCaseSingleExecute = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    function check(node) {
      const name = node.id?.name;
      if (name == null || !USE_CASE_NAME.test(name)) {
        return;
      }
      let hasExecute = false;
      for (const member of node.body.body) {
        if (!isPublicMember(member) || member.kind === 'constructor') {
          continue;
        }
        const memberName = getMemberName(member);
        if (memberName === 'execute' && member.kind === 'method' && !member.static) {
          hasExecute = true;
          continue;
        }
        context.report({
          node: member.key ?? member,
          message: `${name}.${memberName}: UseCase의 공개 멤버는 execute 하나다. 다른 행동은 UseCase를 하나 더 만들고, 내부 단계는 # 메서드로 둔다.`,
        });
      }
      if (!hasExecute) {
        context.report({
          node: node.id,
          message: `${name}: UseCase는 공개 메서드 execute(command) 하나로 실행한다.`,
        });
      }
    }
    return { ClassDeclaration: check, ClassExpression: check };
  },
};

const RAW_IDENTIFIER_TYPES = new Map([
  ['TSStringKeyword', 'string'],
  ['TSNumberKeyword', 'number'],
  ['TSBigIntKeyword', 'bigint'],
]);
const IDENTIFIER_NAME = /^(?:id|.+Id)$/u;
const IDENTIFIER_LIST_NAME = /^(?:ids|.+Ids)$/u;
const LIST_TYPE_NAMES = new Set(['Array', 'ReadonlyArray', 'Set', 'ReadonlySet']);

function describeRawIdentifier(type) {
  if (type == null) {
    return null;
  }
  if (RAW_IDENTIFIER_TYPES.has(type.type)) {
    return RAW_IDENTIFIER_TYPES.get(type.type);
  }
  if (type.type === 'TSUnionType') {
    return type.types.map(describeRawIdentifier).find((raw) => raw != null) ?? null;
  }
  return null;
}

function describeRawIdentifierList(type) {
  switch (type?.type) {
    case 'TSArrayType': {
      const raw = describeRawIdentifier(type.elementType);
      return raw == null ? null : `${raw}[]`;
    }
    case 'TSTypeOperator':
      return describeRawIdentifierList(type.typeAnnotation);
    case 'TSUnionType':
      return type.types.map(describeRawIdentifierList).find((raw) => raw != null) ?? null;
    case 'TSTypeReference': {
      const [element] = getTypeArgumentList(type);
      const raw = LIST_TYPE_NAMES.has(getReferenceName(type))
        ? describeRawIdentifier(element)
        : null;
      return raw == null ? null : `${getReferenceName(type)}<${raw}>`;
    }
    default:
      return null;
  }
}

function describeRawIdentifierField(name, type) {
  if (name == null) {
    return null;
  }
  if (IDENTIFIER_NAME.test(name)) {
    return describeRawIdentifier(type);
  }
  if (IDENTIFIER_LIST_NAME.test(name)) {
    return describeRawIdentifierList(type);
  }
  return null;
}

/** 타입 안의 객체 필드(TSPropertySignature)를 찾는다. 같은 파일의 interface·type 별칭은 한 번씩 따라간다 */
function forEachTypeField(type, localTypes, visit, visited = new Set()) {
  const walk = (inner) => forEachTypeField(inner, localTypes, visit, visited);
  const walkMembers = (members) => {
    for (const member of members) {
      if (member.type === 'TSPropertySignature') {
        visit(member, getKeyName(member), getAnnotation(member));
        walk(getAnnotation(member));
      }
    }
  };
  switch (type?.type) {
    case 'TSTypeLiteral':
      walkMembers(type.members);
      return;
    case 'TSUnionType':
    case 'TSIntersectionType':
      for (const member of type.types) {
        walk(member);
      }
      return;
    case 'TSArrayType':
      walk(type.elementType);
      return;
    case 'TSTypeOperator':
      walk(type.typeAnnotation);
      return;
    case 'TSTupleType':
      for (const element of type.elementTypes) {
        walk(element.type === 'TSNamedTupleMember' ? element.elementType : element);
      }
      return;
    case 'TSTypeReference': {
      for (const argument of getTypeArgumentList(type)) {
        walk(argument);
      }
      const name = getReferenceName(type);
      const declaration = name == null ? null : localTypes.get(name);
      if (declaration == null || visited.has(name)) {
        return;
      }
      visited.add(name);
      if (declaration.type === 'TSInterfaceDeclaration') {
        walkMembers(declaration.body.body);
      } else {
        walk(declaration.typeAnnotation);
      }
      return;
    }
    default:
      return;
  }
}

function getParameterTarget(parameter) {
  if (parameter.type === 'TSParameterProperty') {
    return getParameterTarget(parameter.parameter);
  }
  if (parameter.type === 'AssignmentPattern') {
    return parameter.left;
  }
  if (parameter.type === 'RestElement') {
    return parameter.argument;
  }
  return parameter;
}

// 포트는 Aggregate·UseCase와 같은 말(id VO)로 말한다. 원시 id는 다른 Aggregate의 id와 섞여도 컴파일러가 못 막는다.
// 공급자가 준 id도 같다. technicalIds는 어느 Aggregate도 소유하지 않는 전달 봉투 id(이벤트 id)에만 파일 단위로 준다
const portIdValueObject = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: { technicalIds: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const technicalIds = new Set(context.options[0]?.technicalIds ?? []);
    let localTypes = new Map();
    let reported = new Set();

    function report(node, name, raw) {
      if (reported.has(node)) {
        return;
      }
      reported.add(node);
      context.report({
        node,
        message: `${name}: 포트의 식별자는 원시값(${raw})이 아니라 id VO(UserId·TodoId…)로 주고받는다. 공급자가 준 id도 slice domain의 공급자 이름 없는 VO(PushTicketId·StoreCustomerId)로 감싼다. 원시값은 presentation·어댑터 경계에서 VO로 바꾼다.`,
      });
    }

    function visitField(node, name, type) {
      if (technicalIds.has(name)) {
        return;
      }
      const raw = describeRawIdentifierField(name, type);
      if (raw != null) {
        report(node, name, raw);
      }
    }

    return {
      Program(program) {
        localTypes = collectLocalTypes(program);
        reported = new Set();
      },
      TSAbstractMethodDefinition(node) {
        const { value } = node;
        for (const parameter of value.params) {
          const target = getParameterTarget(parameter);
          const type = getAnnotation(target);
          if (target.type === 'Identifier') {
            visitField(target, target.name, type);
          }
          forEachTypeField(type, localTypes, visitField);
        }
        forEachTypeField(getReturnType(value), localTypes, visitField);
      },
    };
  },
};

const FIND_NAME = /^find(?:[A-Z]|$)/u;
const PROMISE_NAMES = new Set(['Promise', 'PromiseLike']);
const COLLECTION_TYPE_NAMES = new Set([
  'Array',
  'ReadonlyArray',
  'Map',
  'ReadonlyMap',
  'Set',
  'ReadonlySet',
  'Record',
]);
const ABSENT_TYPES = new Set(['TSUndefinedKeyword', 'TSVoidKeyword']);

function unwrapPromise(type) {
  const [resolved] = getTypeArgumentList(type);
  return PROMISE_NAMES.has(getReferenceName(type)) && resolved != null ? resolved : type;
}

function isCollection(type, localTypes, visited = new Set()) {
  switch (type?.type) {
    case 'TSArrayType':
    case 'TSTupleType':
      return true;
    case 'TSTypeOperator':
      return isCollection(type.typeAnnotation, localTypes, visited);
    case 'TSTypeReference': {
      const name = getReferenceName(type);
      if (COLLECTION_TYPE_NAMES.has(name)) {
        return true;
      }
      const declaration = name == null ? null : localTypes.get(name);
      if (declaration?.type !== 'TSTypeAliasDeclaration' || visited.has(name)) {
        return false;
      }
      visited.add(name);
      return isCollection(declaration.typeAnnotation, localTypes, visited);
    }
    default:
      return false;
  }
}

// find*는 "없으면 null" 한 모양이다. undefined와 섞이면 호출부가 == null과 ===를 오가며 판단이 갈린다(conventions.md#repository-메서드)
const portReturnShape = {
  meta: { type: 'suggestion' },
  create(context) {
    let localTypes = new Map();
    return {
      Program(program) {
        localTypes = collectLocalTypes(program);
      },
      TSAbstractMethodDefinition(node) {
        const name = getMemberName(node);
        const returnType = getReturnType(node.value);
        if (!FIND_NAME.test(name) || returnType == null) {
          return;
        }
        const resolved = unwrapPromise(returnType);
        const members = resolved.type === 'TSUnionType' ? resolved.types : [resolved];
        if (members.some((member) => ABSENT_TYPES.has(member.type))) {
          context.report({
            node: node.value.returnType,
            message: `${name}: find*는 없을 때 null을 돌려준다(T | null). undefined·void를 쓰지 않는다.`,
          });
          return;
        }
        if (
          !members.some((member) => member.type === 'TSNullKeyword') &&
          !isCollection(resolved, localTypes)
        ) {
          context.report({
            node: node.value.returnType,
            message: `${name}: find*는 T | null을 돌려준다. 늘 값이 있으면 get*·count*·list*처럼 다른 동사로 짓는다.`,
          });
        }
      },
    };
  },
};

export default {
  'aggregate-shape': aggregateShape,
  'use-case-single-execute': useCaseSingleExecute,
  'port-id-value-object': portIdValueObject,
  'port-return-shape': portReturnShape,
};
