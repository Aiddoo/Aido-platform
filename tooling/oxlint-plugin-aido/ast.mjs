// 값을 바꾸지 않고 감싸기만 하는 식: `x as T`, `x satisfies T`, `(x)`, `a?.b`, `x!`
const WRAPPER_TYPES = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'ParenthesizedExpression',
  'ChainExpression',
  'TSNonNullExpression',
]);

export function unwrap(node) {
  let current = node;
  while (current != null && WRAPPER_TYPES.has(current.type)) {
    current = current.expression;
  }
  return current;
}

const POLICY_NAME = /^[A-Z][A-Za-z0-9]*Policy$/u;

export function isPolicyName(name) {
  return name != null && POLICY_NAME.test(name);
}

/** `const XPolicy = { … }`의 객체 리터럴이면 그 Policy 이름. `as const`·`satisfies`로 감싼 것도 본다 */
export function getPolicyNameOfObject(objectNode) {
  let current = objectNode;
  while (WRAPPER_TYPES.has(current.parent?.type) && current.parent.expression === current) {
    current = current.parent;
  }
  const declarator = current.parent;
  if (
    declarator?.type !== 'VariableDeclarator' ||
    declarator.init !== current ||
    declarator.id.type !== 'Identifier' ||
    !isPolicyName(declarator.id.name)
  ) {
    return null;
  }
  return declarator.id.name;
}

/** 식별자·문자열 키의 이름. 계산된 키는 null */
export function getKeyName(node) {
  if (node == null || node.computed === true) {
    return null;
  }
  const { key } = node;
  if (key?.type === 'Identifier') {
    return key.name;
  }
  if (key?.type === 'Literal' && typeof key.value === 'string') {
    return key.value;
  }
  return null;
}

/** `{ a: b }`의 값 속성. 구조 분해 패턴·축약·메서드·접근자는 빼고 */
export function isValueProperty(node) {
  return (
    node.type === 'Property' &&
    node.kind === 'init' &&
    !node.method &&
    !node.shorthand &&
    node.parent?.type === 'ObjectExpression'
  );
}

/** `foo()`·`a.foo()`의 foo */
export function getCalleeName(callee) {
  const target = unwrap(callee);
  if (target?.type === 'Identifier') {
    return target.name;
  }
  if (
    target?.type === 'MemberExpression' &&
    !target.computed &&
    target.property.type === 'Identifier'
  ) {
    return target.property.name;
  }
  return null;
}

/** `object.property` 꼴이면 [object 이름, property 이름] */
export function getMemberNames(node) {
  if (
    node?.type !== 'MemberExpression' ||
    node.computed ||
    node.object.type !== 'Identifier' ||
    node.property.type !== 'Identifier'
  ) {
    return null;
  }
  return [node.object.name, node.property.name];
}

export function isComponentName(name) {
  return name != null && /^\p{Lu}/u.test(name);
}

export function isFunction(node) {
  return node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression';
}

export function getTypeArguments(node) {
  return node.typeArguments ?? node.typeParameters ?? null;
}

/** 이 파일이 import한 이름(기본·이름 import의 지역 이름). 네임스페이스 import는 뺀다 */
export function collectImportedNames(program, { includeNamespace = false } = {}) {
  const names = new Set();
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (specifier.type !== 'ImportNamespaceSpecifier' || includeNamespace) {
        names.add(specifier.local.name);
      }
    }
  }
  return names;
}

export function getImportedName(specifier) {
  const { imported } = specifier;
  return imported.type === 'Identifier' ? imported.name : imported.value;
}

/** 자식 노드. parent 역참조는 따라가지 않는다 */
export function* childNodes(node) {
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') {
      continue;
    }
    if (Array.isArray(value)) {
      yield* value.filter((item) => typeof item?.type === 'string');
    } else if (typeof value?.type === 'string') {
      yield value;
    }
  }
}

/** 최상위 문장. `export` 선언은 안의 선언으로 푼다 */
export function* topLevelDeclarations(program) {
  for (const statement of program.body) {
    if (
      (statement.type === 'ExportNamedDeclaration' ||
        statement.type === 'ExportDefaultDeclaration') &&
      statement.declaration != null
    ) {
      yield statement.declaration;
    } else {
      yield statement;
    }
  }
}
