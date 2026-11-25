import {
  childNodes,
  getKeyName,
  getMemberNames,
  getPolicyNameOfObject,
  getTypeArguments,
  isFunction,
  isPolicyName,
  topLevelDeclarations,
  unwrap,
} from '../ast.mjs';

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

function collectTypeAliases(program) {
  const aliases = new Map();
  for (const declaration of topLevelDeclarations(program)) {
    if (declaration.type === 'TSTypeAliasDeclaration') {
      aliases.set(declaration.id.name, declaration.typeAnnotation);
    }
  }
  return aliases;
}

function describeNonMethodMember(member) {
  if (member.type === 'SpreadElement') {
    return '펼침(...)을 썼습니다';
  }
  if (member.kind !== 'init') {
    return '접근자(get·set)를 썼습니다';
  }
  if (member.computed) {
    return '계산된 키를 썼습니다';
  }
  const key = getKeyName(member);
  if (member.shorthand) {
    return `모듈 함수를 묶었습니다(${key})`;
  }
  const value = unwrap(member.value);
  if (value.type === 'Identifier') {
    return `별칭(${key}: ${value.name})을 썼습니다`;
  }
  if (isFunction(value)) {
    return `함수 속성(${key}: …)을 썼습니다`;
  }
  return `메서드가 아닌 값(${key})을 넣었습니다`;
}

/** 이 함수의 this를 쓰는지 본다. 화살표는 this를 물려받고 function·class는 새로 만든다 */
function usesThis(node) {
  if (node.type === 'ThisExpression') {
    return true;
  }
  if (
    node.type === 'FunctionExpression' ||
    node.type === 'FunctionDeclaration' ||
    node.type === 'ClassExpression' ||
    node.type === 'ClassDeclaration'
  ) {
    return false;
  }
  for (const child of childNodes(node)) {
    if (usesThis(child)) {
      return true;
    }
  }
  return false;
}

// Policy는 메서드 객체다. 멤버는 `method(model) { … }`로 쓰고 모델 전체를 첫 인자로 받는다(apps/mobile/docs/architecture/model.md#모델과-policy)
const policyFacade = {
  meta: { type: 'suggestion' },
  create(context) {
    let aliases = new Map();

    function checkMember(member, policy) {
      if (member.type !== 'Property' || !member.method || member.computed) {
        context.report({
          node: member,
          message: `${policy}: ${describeNonMethodMember(member)}. Policy 멤버는 메서드(\`name(model) { … }\`)로 쓰고 다른 멤버는 this로 부릅니다.`,
        });
        return;
      }
      if (member.value.returnType == null && usesThis(member.value.body)) {
        context.report({
          node: member.key,
          message: `${policy}.${getKeyName(member)}: this로 다른 메서드를 부르면 반환 타입을 적습니다. 메서드끼리 서로 부르면 추론이 순환합니다.`,
        });
      }
      const fragment = describeFirstParameter(member.value, aliases);
      if (fragment != null) {
        context.report({
          node: member,
          message: `${policy}.${getKeyName(member)}: 첫 인자가 모델 일부(${fragment})입니다. Policy 멤버는 모델 전체(category: TodoCategory)나 모델 목록(readonly TodoCategory[])을 첫 인자로 받아 모델 필드가 바뀌어도 서명이 그대로입니다. 호출부가 모델 일부(폼 값 등)만 가지면 엔티티 규칙이 아니니 Policy 밖 순수 함수로 두세요.`,
        });
      }
    }

    return {
      Program(program) {
        aliases = collectTypeAliases(program);
      },
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || !isPolicyName(node.id.name) || node.init == null) {
          return;
        }
        const object = unwrap(node.init);
        if (object.type !== 'ObjectExpression') {
          context.report({
            node: node.init,
            message: `${node.id.name}: Policy는 객체 리터럴(\`{ method(model) { … } }\`)로 선언합니다.`,
          });
          return;
        }
        for (const member of object.properties) {
          checkMember(member, node.id.name);
        }
      },
    };
  },
};

/** 이 파일이 선언한 타입 이름(type 별칭·interface). 모델 파일에서는 이것이 그 파일의 모델이다 */
function collectLocalTypeNames(program) {
  const names = new Set();
  for (const declaration of topLevelDeclarations(program)) {
    if (
      declaration.type === 'TSTypeAliasDeclaration' ||
      declaration.type === 'TSInterfaceDeclaration'
    ) {
      names.add(declaration.id.name);
    }
  }
  return names;
}

/** 이 파일의 모델 전체(X)나 모델 목록(readonly X[])인지 본다. `X | null`과 `T extends X`도 모델 전체다 */
function isModelType(type, localTypes, typeParameters) {
  const isModel = (inner) => isModelType(inner, localTypes, typeParameters);
  switch (type.type) {
    case 'TSTypeOperator':
      return type.operator === 'readonly' && isModel(type.typeAnnotation);
    case 'TSArrayType':
      return isModel(type.elementType);
    case 'TSRestType':
      return isModel(type.typeAnnotation);
    case 'TSNamedTupleMember':
      return isModel(type.elementType);
    case 'TSTupleType':
      return type.elementTypes.length > 0 && type.elementTypes.every(isModel);
    case 'TSUnionType': {
      const members = type.types.filter((member) => !isNullishType(member));
      return members.length > 0 && members.every(isModel);
    }
    case 'TSTypeReference': {
      if (type.typeName.type !== 'Identifier') {
        return false;
      }
      const { name } = type.typeName;
      const [elementType] = getTypeArguments(type)?.params ?? [];
      if (ARRAY_TYPE_NAMES.has(name) && elementType != null) {
        return isModel(elementType);
      }
      if (typeParameters.has(name)) {
        const constraint = typeParameters.get(name);
        const outerParameters = new Map([...typeParameters].filter(([key]) => key !== name));
        return constraint != null && isModelType(constraint, localTypes, outerParameters);
      }
      return localTypes.has(name);
    }
    default:
      return false;
  }
}

// Policy는 자기 파일의 모델만 다룬다. 메서드의 첫 인자는 그 파일이 선언한 모델 전체(목록 규칙은 readonly Model[])다
const policyModelParameter = {
  meta: { type: 'suggestion' },
  create(context) {
    let localTypes = new Set();

    return {
      Program(program) {
        localTypes = collectLocalTypeNames(program);
      },
      Property(node) {
        if (!node.method || node.kind !== 'init' || node.parent?.type !== 'ObjectExpression') {
          return;
        }
        const policy = getPolicyNameOfObject(node.parent);
        if (policy == null) {
          return;
        }
        const [parameter] = node.value.params;
        const type = parameter == null ? null : getParameterType(parameter);
        const typeParameters = new Map(
          (node.value.typeParameters?.params ?? []).map((typeParameter) => [
            getTypeParameterName(typeParameter),
            typeParameter.constraint ?? null,
          ]),
        );
        if (type != null && isModelType(type, localTypes, typeParameters)) {
          return;
        }
        context.report({
          node: parameter ?? node.key,
          message: `${policy}.${getKeyName(node)}: 첫 인자는 이 파일이 선언한 모델 전체(목록 규칙은 readonly Model[])입니다. 다른 파일의 모델을 받는 규칙은 그 모델의 Policy로 옮기고, 모델이 아닌 값(날짜 key·수·문자열)만 받으면 Policy 밖 원시 인자 순수 함수로 둡니다.`,
        });
      },
    };
  },
};

function isCallee(node) {
  let current = node;
  while (
    current.parent?.type === 'TSNonNullExpression' ||
    current.parent?.type === 'ChainExpression'
  ) {
    current = current.parent;
  }
  return current.parent?.type === 'CallExpression' && current.parent.callee === current;
}

// Policy 메서드는 this로 서로를 부른다. 호출 없이 값으로 넘기면 this가 끊겨 부르는 순간에 터진다
const noUnboundPolicyMethod = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    function reportDestructuring(pattern, source) {
      const policy = unwrap(source);
      if (
        pattern.type === 'ObjectPattern' &&
        policy?.type === 'Identifier' &&
        isPolicyName(policy.name)
      ) {
        context.report({
          node: pattern,
          message: `${policy.name}의 메서드를 구조 분해로 꺼내지 않습니다. this가 끊깁니다. \`${policy.name}.method(model)\`로 부르세요.`,
        });
      }
    }

    return {
      MemberExpression(node) {
        if (
          node.object.type !== 'Identifier' ||
          !isPolicyName(node.object.name) ||
          isCallee(node)
        ) {
          return;
        }
        const method = node.computed ? '…' : node.property.name;
        context.report({
          node,
          message: `${node.object.name}.${method}를 호출 없이 값으로 넘기지 않습니다. this가 끊깁니다. 화살표로 감싸세요(\`(model) => ${node.object.name}.${method}(model)\`).`,
        });
      },
      VariableDeclarator(node) {
        if (node.init != null) {
          reportDestructuring(node.id, node.init);
        }
      },
      AssignmentExpression(node) {
        reportDestructuring(node.left, node.right);
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
            !isPolicyName(id.name) &&
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

const MODEL_MODULE = /\.model$/u;
// 값을 감싸기만 하는 타입. 안의 타입 인자가 원시 값이면 원시 값이다
const VALUE_WRAPPER_TYPES = new Set([
  'Array',
  'ReadonlyArray',
  'Readonly',
  'Partial',
  'Required',
  'Pick',
  'Omit',
  'Record',
  'Set',
  'ReadonlySet',
  'Map',
  'ReadonlyMap',
  'NonNullable',
]);
const PLAIN_TYPE_NODES = new Set([
  'TSStringKeyword',
  'TSNumberKeyword',
  'TSBooleanKeyword',
  'TSBigIntKeyword',
  'TSNullKeyword',
  'TSUndefinedKeyword',
  'TSUnknownKeyword',
  'TSNeverKeyword',
  'TSLiteralType',
  'TSTemplateLiteralType',
  'TSFunctionType',
  // 모델의 칸 하나(Todo['visibility'])는 값이다
  'TSIndexedAccessType',
]);
// 객체 모양을 만드는 zod 생성자·메서드. 이 밖(enum·string·int·iso·brand 등)은 원시 값 스키마다
const OBJECT_SCHEMA_METHODS = new Set([
  'object',
  'strictObject',
  'looseObject',
  'discriminatedUnion',
  'intersection',
  'record',
  'array',
  'tuple',
  'map',
  'set',
  'extend',
  'safeExtend',
  'pick',
  'omit',
  'partial',
  'required',
  'merge',
]);

function collectModelFileScope(program) {
  const scope = {
    imports: new Map(),
    aliases: new Map(),
    interfaces: new Map(),
    schemas: new Map(),
  };
  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration') {
      for (const specifier of statement.specifiers) {
        scope.imports.set(specifier.local.name, statement.source.value);
      }
    }
  }
  for (const declaration of topLevelDeclarations(program)) {
    if (declaration.type === 'TSTypeAliasDeclaration') {
      scope.aliases.set(declaration.id.name, declaration.typeAnnotation);
    } else if (declaration.type === 'TSInterfaceDeclaration') {
      scope.interfaces.set(declaration.id.name, declaration);
    } else if (declaration.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type === 'Identifier' && declarator.init != null) {
          scope.schemas.set(declarator.id.name, declarator.init);
        }
      }
    }
  }
  return scope;
}

/** 스키마 식이 원시 값(열거·문자열·수·브랜드)을 만드는지 본다. 다른 모델 파일에서 가져온 스키마는 모델로 본다 */
function isPlainSchema(expression, scope, visited) {
  const node = unwrap(expression);
  if (node.type === 'Identifier') {
    if (visited.has(node.name)) {
      return true;
    }
    const local = scope.schemas.get(node.name);
    if (local != null) {
      return isPlainSchema(local, scope, new Set([...visited, node.name]));
    }
    return !MODEL_MODULE.test(scope.imports.get(node.name) ?? '');
  }
  if (node.type === 'MemberExpression') {
    return isPlainSchema(node.object, scope, visited);
  }
  if (node.type !== 'CallExpression') {
    return true;
  }
  const callee = unwrap(node.callee);
  if (callee.type !== 'MemberExpression' || callee.computed) {
    return true;
  }
  const method = callee.property.name;
  if (OBJECT_SCHEMA_METHODS.has(method)) {
    return false;
  }
  const receiver = unwrap(callee.object);
  if (receiver.type === 'Identifier' && receiver.name === 'z') {
    const [options] = node.arguments;
    if (method === 'union' && options?.type === 'ArrayExpression') {
      return options.elements.every(
        (element) => element != null && isPlainSchema(element, scope, visited),
      );
    }
    const wrapsSchema = method === 'nullable' || method === 'optional' || method === 'nullish';
    return wrapsSchema && options != null ? isPlainSchema(options, scope, visited) : true;
  }
  return isPlainSchema(receiver, scope, visited);
}

function getInferredSchemaName(type) {
  const { typeName } = type;
  if (
    typeName.type !== 'TSQualifiedName' ||
    typeName.left.type !== 'Identifier' ||
    typeName.left.name !== 'z'
  ) {
    return null;
  }
  const [argument] = getTypeArguments(type)?.params ?? [];
  if (argument?.type !== 'TSTypeQuery' || argument.exprName.type !== 'Identifier') {
    return null;
  }
  return argument.exprName.name;
}

function isPlainMember(member, scope, typeParameters, visited) {
  if (member.type !== 'TSPropertySignature') {
    return member.type === 'TSMethodSignature';
  }
  const type = member.typeAnnotation?.typeAnnotation;
  return type != null && isPlainValueType(type, scope, typeParameters, visited);
}

/** 모델이 아닌 값(날짜 key·수·문자열·열거와 그 목록, 그런 값만 담은 이름 붙인 인자 묶음)인지 본다 */
function isPlainValueType(type, scope, typeParameters, visited) {
  if (PLAIN_TYPE_NODES.has(type.type)) {
    return true;
  }
  const isPlain = (inner) => isPlainValueType(inner, scope, typeParameters, visited);
  switch (type.type) {
    case 'TSUnionType':
    case 'TSIntersectionType':
      return type.types.every(isPlain);
    case 'TSArrayType':
      return isPlain(type.elementType);
    case 'TSTypeOperator':
      return type.operator === 'keyof' || isPlain(type.typeAnnotation);
    case 'TSRestType':
    case 'TSOptionalType':
      return isPlain(type.typeAnnotation);
    case 'TSNamedTupleMember':
      return isPlain(type.elementType);
    case 'TSTupleType':
      return type.elementTypes.every(isPlain);
    case 'TSTypeLiteral':
      return type.members.every((member) => isPlainMember(member, scope, typeParameters, visited));
    case 'TSTypeReference':
      return isPlainTypeReference(type, scope, typeParameters, visited);
    default:
      return false;
  }
}

function isPlainTypeReference(type, scope, typeParameters, visited) {
  const schemaName = getInferredSchemaName(type);
  if (schemaName != null) {
    return isPlainSchema({ type: 'Identifier', name: schemaName }, scope, new Set());
  }
  if (type.typeName.type !== 'Identifier') {
    return false;
  }
  const { name } = type.typeName;
  const typeArguments = getTypeArguments(type)?.params ?? [];
  const hasPlainArguments = () =>
    typeArguments.every((argument) => isPlainValueType(argument, scope, typeParameters, visited));
  if (typeParameters.has(name)) {
    const constraint = typeParameters.get(name);
    return constraint == null || isPlainValueType(constraint, scope, typeParameters, visited);
  }
  if (VALUE_WRAPPER_TYPES.has(name)) {
    return hasPlainArguments();
  }
  if (visited.has(name)) {
    return true;
  }
  const nextVisited = new Set([...visited, name]);
  const alias = scope.aliases.get(name);
  if (alias != null) {
    return isPlainValueType(alias, scope, typeParameters, nextVisited);
  }
  const declaration = scope.interfaces.get(name);
  if (declaration != null) {
    return (
      (declaration.extends ?? []).length === 0 &&
      declaration.body.body.every((member) =>
        isPlainMember(member, scope, typeParameters, nextVisited),
      )
    );
  }
  if (MODEL_MODULE.test(scope.imports.get(name) ?? '')) {
    return false;
  }
  return hasPlainArguments();
}

const FACTORY_NAME = /^create[A-Z]/u;

function hasLiteralDefault(parameter) {
  return parameter.type === 'AssignmentPattern' && unwrap(parameter.right).type === 'Literal';
}

// 모델을 받는 규칙의 입구는 Policy 하나다. Policy 밖에서 내보내는 함수는 create* 팩토리, 스키마를 만드는 *Schema, 원시 인자 순수 함수뿐이다
const modelFunctionExports = {
  meta: { type: 'suggestion' },
  create(context) {
    let scope = null;

    return {
      Program(program) {
        scope = collectModelFileScope(program);
      },
      ExportNamedDeclaration(node) {
        const declaration = node.declaration;
        if (declaration?.type !== 'FunctionDeclaration' || declaration.id == null) {
          return;
        }
        const { name } = declaration.id;
        const [parameter] = declaration.params;
        if (FACTORY_NAME.test(name) || MODEL_SCHEMA_NAME.test(name) || parameter == null) {
          return;
        }
        const type = getParameterType(parameter);
        if (type == null && hasLiteralDefault(parameter)) {
          return;
        }
        const typeParameters = new Map(
          (declaration.typeParameters?.params ?? []).map((typeParameter) => [
            getTypeParameterName(typeParameter),
            typeParameter.constraint ?? null,
          ]),
        );
        if (type != null && isPlainValueType(type, scope, typeParameters, new Set())) {
          return;
        }
        context.report({
          node: parameter,
          message: `${name}: 모델을 첫 인자로 받는 함수를 낱개로 export하지 않습니다. Policy 메서드로 옮겨 \`XPolicy.${name}(model)\`로 부르거나, 모델이 아닌 값(날짜 key·수·문자열)만 받는 순수 함수로 바꾸세요. 새 값을 만드는 create*만 예외입니다.`,
        });
      },
    };
  },
};

function findThisOwner(node) {
  for (let current = node.parent; current != null; current = current.parent) {
    if (current.type === 'FunctionExpression' || current.type === 'FunctionDeclaration') {
      return current;
    }
    if (current.type === 'ClassDeclaration' || current.type === 'ClassExpression') {
      return current;
    }
  }
  return null;
}

function isPolicyMethod(functionNode) {
  const property = functionNode.parent;
  return (
    property?.type === 'Property' &&
    property.method === true &&
    property.parent?.type === 'ObjectExpression' &&
    getPolicyNameOfObject(property.parent) != null
  );
}

function isInsideClass(node) {
  for (let current = node.parent; current != null; current = current.parent) {
    if (current.type === 'ClassDeclaration' || current.type === 'ClassExpression') {
      return true;
    }
  }
  return false;
}

// 모델의 this는 Policy 메서드가 같은 Policy의 다른 메서드를 부를 때만 쓴다
const noThisOutsideClass = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      ThisExpression(node) {
        const owner = findThisOwner(node);
        if (owner?.type === 'FunctionExpression' && isPolicyMethod(owner)) {
          return;
        }
        if (!isInsideClass(node)) {
          context.report({
            node,
            message:
              '모델에서 this는 Policy 메서드 안에서만 씁니다(`this.other(model)`). 그 밖에서는 함수를 직접 부르세요.',
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
  'policy-model-parameter': policyModelParameter,
  'no-unbound-policy-method': noUnboundPolicyMethod,
  'model-exports': modelExports,
  'model-function-exports': modelFunctionExports,
  'no-this-outside-class': noThisOutsideClass,
  'no-clock-read': noClockRead,
};
