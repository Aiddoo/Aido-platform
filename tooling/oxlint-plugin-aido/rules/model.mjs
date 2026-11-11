import {
  getKeyName,
  getMemberNames,
  getTypeArguments,
  isFunction,
  topLevelDeclarations,
  unwrap,
} from '../ast.mjs';

const POLICY_NAME = /Policy$/u;
const MODEL_SCHEMA_NAME = /^[a-z][A-Za-z]*Schema$/u;
// 모델 일부만 받는 모양. 모델에 필드가 늘거나 줄 때마다 Policy 서명과 호출부가 함께 바뀐다
const MODEL_FRAGMENT_UTILITIES = new Set(['Pick', 'Partial', 'Omit', 'Required']);
const ARRAY_TYPE_NAMES = new Set(['ReadonlyArray', 'Array']);

function isNullishType(type) {
  return type.type === 'TSUndefinedKeyword' || type.type === 'TSNullKeyword';
}

function getTypeParameterName(parameter) {
  return typeof parameter.name === 'string' ? parameter.name : parameter.name.name;
}

/**
 * 첫 인자가 모델 전체(또는 모델 목록)가 아니라 일부를 받는지 본다. 같은 파일의 type 별칭과 타입 인자 제약까지 따라간다.
 * 별칭이 객체 리터럴의 합(판별 유니온)이면 상태 모델이라 통과한다
 */
function describeModelFragment(type, context, isAliasUnionMember = false) {
  switch (type.type) {
    case 'TSTypeOperator':
      return type.operator === 'readonly'
        ? describeModelFragment(type.typeAnnotation, context)
        : null;
    case 'TSArrayType':
      return describeModelFragment(type.elementType, context);
    case 'TSRestType':
      return describeModelFragment(type.typeAnnotation, context);
    case 'TSNamedTupleMember':
      return describeModelFragment(type.elementType, context);
    case 'TSTupleType':
      for (const element of type.elementTypes) {
        const fragment = describeModelFragment(element, context);
        if (fragment != null) {
          return fragment;
        }
      }
      return null;
    case 'TSUnionType':
      for (const member of type.types) {
        if (isNullishType(member)) {
          continue;
        }
        const fragment = describeModelFragment(member, context, context.isInAlias);
        if (fragment != null) {
          return fragment;
        }
      }
      return null;
    case 'TSIntersectionType':
      return '교차 타입';
    case 'TSTypeLiteral':
      return isAliasUnionMember ? null : '객체 리터럴 타입';
    case 'TSIndexedAccessType':
      return '모델 필드 타입';
    case 'TSTypeReference':
      return describeTypeReference(type, context);
    default:
      return null;
  }
}

function describeTypeReference(type, context) {
  if (type.typeName.type !== 'Identifier') {
    return null;
  }
  const { name } = type.typeName;
  if (MODEL_FRAGMENT_UTILITIES.has(name)) {
    return `${name}<…>`;
  }
  const [elementType] = getTypeArguments(type)?.params ?? [];
  if (ARRAY_TYPE_NAMES.has(name) && elementType != null) {
    return describeModelFragment(elementType, context);
  }
  if (context.visited.has(name)) {
    return null;
  }
  const constraint = context.typeParameters.get(name);
  if (constraint != null) {
    context.visited.add(name);
    return describeModelFragment(constraint, context);
  }
  const alias = context.aliases.get(name);
  if (alias == null) {
    return null;
  }
  context.visited.add(name);
  const fragment = describeModelFragment(alias, { ...context, isInAlias: true });
  return fragment == null ? null : `${name}(${fragment})`;
}

function getParameterType(parameter) {
  const target = parameter.type === 'AssignmentPattern' ? parameter.left : parameter;
  return target.typeAnnotation?.typeAnnotation ?? null;
}

function describeFirstParameter(declaration, aliases) {
  const [parameter] = declaration.params;
  if (parameter == null) {
    return null;
  }
  const type = getParameterType(parameter);
  if (type == null) {
    const target = parameter.type === 'AssignmentPattern' ? parameter.left : parameter;
    return target.type === 'ObjectPattern' ? '구조 분해한 객체' : null;
  }
  const typeParameters = new Map(
    (declaration.typeParameters?.params ?? [])
      .filter((typeParameter) => typeParameter.constraint != null)
      .map((typeParameter) => [getTypeParameterName(typeParameter), typeParameter.constraint]),
  );
  return describeModelFragment(type, {
    aliases,
    typeParameters,
    visited: new Set(),
    isInAlias: false,
  });
}

// Policy는 모듈 함수를 같은 이름으로 모으기만 한다. 멤버는 모델 전체를 첫 인자로 받는다(.claude/architecture.md#모델과-policy)
const policyFacade = {
  meta: { type: 'suggestion' },
  create(context) {
    const functions = new Map();
    const aliases = new Map();

    function report(node, policy, problem) {
      context.report({
        node,
        message: `${policy}: ${problem}. Facade는 모듈 수준 함수를 같은 이름으로 모으기만 합니다.`,
      });
    }

    function checkMember(member, policy) {
      if (member.type !== 'Property' || member.kind !== 'init') {
        return;
      }
      if (member.method) {
        report(member, policy, '메서드를 Facade 안에 정의했습니다');
        return;
      }
      const value = unwrap(member.value);
      const key = getKeyName(member);
      if (value.type === 'Identifier' && value.name !== key) {
        report(member, policy, `별칭(${key}: ${value.name})을 썼습니다`);
        return;
      }
      if (isFunction(value)) {
        report(member, policy, '함수를 Facade 안에 정의했습니다');
        return;
      }
      const declaration = value.type === 'Identifier' ? functions.get(value.name) : undefined;
      const fragment = declaration == null ? null : describeFirstParameter(declaration, aliases);
      if (fragment != null) {
        context.report({
          node: member,
          message: `${policy}.${value.name}: 첫 인자가 모델 일부(${fragment})입니다. Policy 멤버는 모델 전체(category: TodoCategory)나 모델 목록(readonly TodoCategory[])을 첫 인자로 받아 모델 필드가 바뀌어도 서명이 그대로입니다. 호출부가 모델 일부(폼 값 등)만 가지면 엔티티 규칙이 아니니 Policy 밖 순수 함수로 두세요.`,
        });
      }
    }

    return {
      Program(program) {
        for (const declaration of topLevelDeclarations(program)) {
          if (declaration.type === 'FunctionDeclaration' && declaration.id != null) {
            functions.set(declaration.id.name, declaration);
          } else if (declaration.type === 'TSTypeAliasDeclaration') {
            aliases.set(declaration.id.name, declaration.typeAnnotation);
          }
        }
      },
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || !POLICY_NAME.test(node.id.name)) {
          return;
        }
        const object = unwrap(node.init);
        if (object?.type !== 'ObjectExpression') {
          return;
        }
        for (const member of object.properties) {
          checkMember(member, node.id.name);
        }
      },
    };
  },
};

// 모델 파일은 클라이언트 모델 스키마(*Schema)·타입·순수 함수·Policy만 내보낸다. 상수는 constants/로 간다
const modelExports = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      ExportNamedDeclaration(node) {
        if (node.declaration?.type !== 'VariableDeclaration') {
          return;
        }
        for (const declarator of node.declaration.declarations) {
          const { id } = declarator;
          if (
            id.type === 'Identifier' &&
            !POLICY_NAME.test(id.name) &&
            !MODEL_SCHEMA_NAME.test(id.name)
          ) {
            context.report({
              node: declarator,
              message: `${id.name}: 모델 파일은 클라이언트 모델 스키마(*Schema)·타입·순수 함수·Policy만 내보냅니다. 상수는 constants/{feature}.constants.ts로 옮기세요.`,
            });
          }
        }
      },
    };
  },
};

function isInsideClass(node) {
  for (let current = node.parent; current != null; current = current.parent) {
    if (current.type === 'ClassDeclaration' || current.type === 'ClassExpression') {
      return true;
    }
  }
  return false;
}

// 모델은 Facade의 this가 아니라 함수를 직접 부른다
const noThisOutsideClass = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      ThisExpression(node) {
        if (!isInsideClass(node)) {
          context.report({
            node,
            message: '모델에서 this를 쓰지 않습니다. Facade가 아니라 함수를 직접 부르세요.',
          });
        }
      },
    };
  },
};

const CLOCK_CALLS = new Set(['Date.now', 'performance.now']);

// 모델·mapper는 시각을 인자(now)로 받는다. 안에서 시계를 읽으면 같은 입력이 다른 결과를 내 테스트와 캐시가 흔들린다
const noClockRead = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    const message =
      '모델·mapper는 시계를 읽지 않습니다. 지금·오늘은 인자(now: Instant, today: DateKey)로 받습니다.';
    return {
      CallExpression(node) {
        const names = getMemberNames(node.callee);
        if (names != null && CLOCK_CALLS.has(names.join('.'))) {
          context.report({ node, message });
        }
      },
      NewExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'Date' &&
          node.arguments.length === 0
        ) {
          context.report({ node, message });
        }
      },
      MemberExpression(node) {
        if (getMemberNames(node)?.join('.') === 'Temporal.Now') {
          context.report({ node, message });
        }
      },
    };
  },
};

export default {
  'policy-facade': policyFacade,
  'model-exports': modelExports,
  'no-this-outside-class': noThisOutsideClass,
  'no-clock-read': noClockRead,
};
