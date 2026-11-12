import { collectImportedNames, isComponentName, isFunction } from '../ast.mjs';

const DEFAULT_FORBIDDEN_SUFFIXES = [
  'Body',
  'Bodies',
  'Frame',
  'Frames',
  'Section',
  'Sections',
  'Block',
  'Blocks',
  'Wrapper',
  'Wrappers',
];

function getMemberPropertyName(node) {
  return node?.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier'
    ? node.property.name
    : null;
}

// 역할이 드러나지 않는 조각 이름(Body, Frame, Section, Blocks, Wrapper)을 막는다.
// standaloneNames는 네임스페이스 조각(`X.Header`)이 아닌 선언에만 건다
const componentName = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: {
          suffixes: { type: 'array', items: { type: 'string' } },
          standaloneNames: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const suffixes = context.options[0]?.suffixes ?? DEFAULT_FORBIDDEN_SUFFIXES;
    const standaloneNames = new Set(context.options[0]?.standaloneNames ?? []);
    function check(node, name, isStandalone) {
      if (!isComponentName(name)) {
        return;
      }
      const suffix = suffixes.find((candidate) => name.endsWith(candidate));
      if (suffix != null || (isStandalone && standaloneNames.has(name))) {
        context.report({
          node,
          message: `${name}: 위치·틀을 말하는 컴포넌트 이름(${[...suffixes, ...standaloneNames].join(', ')})을 쓰지 않습니다. 역할이 드러나는 이름을 짓거나 스크린에 펼치세요.`,
        });
      }
    }
    return {
      FunctionDeclaration(node) {
        check(node, node.id?.name ?? null, true);
      },
      VariableDeclarator(node) {
        if (
          node.id.type === 'Identifier' &&
          (isFunction(node.init) || node.init?.type === 'CallExpression')
        ) {
          check(node, node.id.name, true);
        }
      },
      AssignmentExpression(node) {
        if (node.operator === '=' && isFunction(node.right)) {
          check(node, getMemberPropertyName(node.left), false);
        }
      },
    };
  },
};

const XXX_OF_NAME = /^[a-z][A-Za-z0-9]*[a-z0-9]Of$/u;
// `getLimitFromError`·`toPlanFromDraft`처럼 값을 만드는 동사 뒤에 출처를 붙이는 꼴. `removeTodoFromList`·`openFromReentry`처럼
// 동작이 일어나는 곳을 말하는 이름은 뜻이 달라 둔다
const XXX_FROM_NAME =
  /^(?:get|to|create|find|with|calculate|parse|format|resolve|use)[A-Z][A-Za-z0-9]*From[A-Z][A-Za-z0-9]*$/u;
const TRY_NAME = /^try[A-Z]/u;

const functionName = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    function check(node, id) {
      if (id?.type !== 'Identifier') {
        return;
      }
      if (XXX_OF_NAME.test(id.name)) {
        context.report({
          node,
          message: `${id.name}: xxxOf 대신 동사로 시작하는 이름을 씁니다.`,
        });
      }
      if (XXX_FROM_NAME.test(id.name) || TRY_NAME.test(id.name)) {
        context.report({
          node,
          message: `${id.name}: xxxFrom·tryX 대신 동사로 시작하고 결과를 말하는 이름을 씁니다(없으면 null은 find*, 변환은 to*).`,
        });
      }
    }
    return {
      FunctionDeclaration(node) {
        check(node, node.id);
      },
      VariableDeclarator(node) {
        check(node, node.id);
      },
    };
  },
};

// 판별 이름은 긍정으로 짓고 허용을 묻는 판별은 can*으로 쓴다(apps/mobile/docs/architecture/model.md#모델과-policy).
// 가져온 이름과 구조 분해는 라이브러리와 서버 계약이 정한 이름이라 선언만 검사한다.
const FORBIDDEN_PREDICATE_NAME = /^(?:isNot[A-Z]|hasNo[A-Z]|is(?:[A-Z]\w*)?(?:Allowed|Eligible)$)/u;
// OS 권한 상태의 이름 그대로다
const OS_STATE_PREDICATE_NAMES = new Set(['isNotDetermined']);
const SIGNATURE_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
  'TSFunctionType',
  'TSConstructorType',
  'TSCallSignatureDeclaration',
  'TSConstructSignatureDeclaration',
  'TSMethodSignature',
]);

function getParameterName(parameter) {
  switch (parameter.type) {
    case 'Identifier':
      return parameter;
    case 'AssignmentPattern':
    case 'RestElement':
      return getParameterName(
        parameter.type === 'RestElement' ? parameter.argument : parameter.left,
      );
    case 'TSParameterProperty':
      return getParameterName(parameter.parameter);
    default:
      return null;
  }
}

const predicateName = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    function check(identifier) {
      if (
        identifier?.type === 'Identifier' &&
        FORBIDDEN_PREDICATE_NAME.test(identifier.name) &&
        !OS_STATE_PREDICATE_NAMES.has(identifier.name)
      ) {
        context.report({
          node: identifier,
          message: `${identifier.name}: 판별 이름은 긍정으로 짓고(isNot*, hasNo* 금지), 허용을 묻는 판별은 can*으로 쓰세요(is*Allowed, is*Eligible 금지). 값이 뒤집히면 호출부를 하나씩 확인하세요.`,
        });
      }
    }
    function checkKey(node) {
      if (!node.computed) {
        check(node.key);
      }
    }
    const visitor = {
      FunctionDeclaration(node) {
        check(node.id);
      },
      VariableDeclarator(node) {
        check(node.id);
      },
      MethodDefinition(node) {
        if (node.kind === 'method') {
          checkKey(node);
        }
      },
      TSMethodSignature(node) {
        if (node.kind === 'method') {
          checkKey(node);
        }
      },
      TSAbstractMethodDefinition: checkKey,
      TSPropertySignature: checkKey,
      PropertyDefinition: checkKey,
      TSAbstractPropertyDefinition: checkKey,
      Property(node) {
        if (node.parent.type === 'ObjectExpression' && !node.shorthand && node.kind === 'init') {
          checkKey(node);
        }
      },
    };
    for (const type of SIGNATURE_TYPES) {
      const previous = visitor[type];
      visitor[type] = (node) => {
        previous?.(node);
        for (const parameter of node.params ?? []) {
          check(getParameterName(parameter));
        }
      };
    }
    return visitor;
  },
};

// 폼 값은 *FormValues, mutation 인자는 *Variables다. Params는 route 값에만 쓴다
const typeName = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: { suffixes: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const suffixes = context.options[0]?.suffixes ?? ['FormInput'];
    function check(node) {
      const { name } = node.id;
      if (suffixes.some((suffix) => name.endsWith(suffix))) {
        context.report({
          node,
          message: `${name}: 폼 값은 *FormValues, mutation 인자는 *Variables로 짓습니다. Params는 route 값에만 씁니다.`,
        });
      }
    }
    return { TSInterfaceDeclaration: check, TSTypeAliasDeclaration: check };
  },
};

function isIconComponentType(type, sourceCode) {
  switch (type?.type) {
    case 'TSUnionType':
      return type.types.some((member) => isIconComponentType(member, sourceCode));
    case 'TSTypeReference':
      return type.typeName.type === 'Identifier' && type.typeName.name === 'StyledIcon';
    case 'TSTypeQuery':
      return sourceCode.getText(type.exprName).endsWith('Icon');
    default:
      return false;
  }
}

// 아이콘 컴포넌트를 받는 prop은 `Icon: StyledIcon`, 그려 둔 요소는 `icon: ReactNode`다
const iconPropName = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      TSPropertySignature(node) {
        if (
          !node.computed &&
          node.key.type === 'Identifier' &&
          isIconComponentType(node.typeAnnotation?.typeAnnotation, context.sourceCode) &&
          !/^(?:[A-Z][A-Za-z]*)?Icon$/u.test(node.key.name)
        ) {
          context.report({
            node: node.key,
            message: `${node.key.name}: 아이콘 컴포넌트를 받는 prop은 \`Icon: StyledIcon\`으로 쓰세요. 그려 둔 요소를 받으면 \`icon: ReactNode\`입니다.`,
          });
        }
      },
    };
  },
};

// 로딩 자리 조각은 `X.Loading`(행마다면 `X.Item.Loading`)으로 건다
const loadingNamespaceName = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      AssignmentExpression(node) {
        const property = node.operator === '=' ? getMemberPropertyName(node.left) : null;
        if (isComponentName(property) && property.endsWith('Skeleton')) {
          context.report({
            node: node.left.property,
            message: `${property}: 로딩 자리 조각은 \`X.Loading\`으로 거세요. 행마다 다르면 \`X.Item.Loading\`처럼 그 행에 겁니다.`,
          });
        }
      },
    };
  },
};

// `X.Y = function Z`에서 Z는 Y와 같다. `.Error`는 ErrorFallback, 가져온 이름을 가리면 다른 이름을 쓴다
const namespaceFunctionName = {
  meta: { type: 'suggestion' },
  create(context) {
    let importedNames = new Set();
    return {
      Program(program) {
        importedNames = collectImportedNames(program);
      },
      AssignmentExpression(node) {
        const property = node.operator === '=' ? getMemberPropertyName(node.left) : null;
        if (
          !isComponentName(property) ||
          node.right.type !== 'FunctionExpression' ||
          node.right.id == null
        ) {
          return;
        }
        const functionName = node.right.id.name;
        const isAllowed =
          functionName === property ||
          (property === 'Error' && functionName === 'ErrorFallback') ||
          importedNames.has(property);
        if (!isAllowed) {
          context.report({
            node: node.right.id,
            message: `${functionName}: 네임스페이스 조각의 함수 이름은 속성 이름(\`${property}\`)과 같게 쓰세요. \`.Error\`는 \`ErrorFallback\`, 가져온 이름을 가리면 다른 이름을 씁니다.`,
          });
        }
      },
    };
  },
};

export default {
  'component-name': componentName,
  'function-name': functionName,
  'predicate-name': predicateName,
  'type-name': typeName,
  'icon-prop-name': iconPropName,
  'loading-namespace-name': loadingNamespaceName,
  'namespace-function-name': namespaceFunctionName,
};
