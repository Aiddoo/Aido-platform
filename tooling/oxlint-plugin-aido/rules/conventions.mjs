import { getCalleeName, unwrap } from '../ast.mjs';

const REACT_BASE_CLASS = /^(?:React\.)?(?:Pure)?Component$/u;
const ERROR_BASE_CLASS = /Error$/u;

function getSuperClassName(classNode) {
  const target = classNode.superClass;
  if (target == null) {
    return null;
  }
  if (target.type === 'Identifier') {
    return target.name;
  }
  if (target.type === 'MemberExpression' && !target.computed) {
    return `${target.object.name ?? ''}.${target.property.name ?? ''}`;
  }
  return null;
}

// 클래스 메서드는 prototype 메서드라 `this`가 떨어져 나가는 사고가 난다. 화살표 필드로 쓴다.
// React Component·Error 하위 클래스가 재정의하는 메서드와 getter·setter·생성자·override는 둔다
const noClassMethod = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      MethodDefinition(node) {
        if (node.kind !== 'method' || node.override === true) {
          return;
        }
        const classNode = node.parent?.parent;
        const superName = classNode == null ? null : getSuperClassName(classNode);
        if (
          superName != null &&
          (REACT_BASE_CLASS.test(superName) || ERROR_BASE_CLASS.test(superName))
        ) {
          return;
        }
        context.report({
          node: node.key,
          message:
            '클래스 메서드를 쓰지 않는다. 화살표 필드(`name = () => {}`)로 쓴다. React Component·Error 하위 클래스가 재정의하는 메서드만 예외다.',
        });
      },
    };
  },
};

// `{ run() {} }` 축약 메서드 대신 `{ run: () => {} }`로 쓴다. 한 가지 모양만 둔다
const noObjectMethodShorthand = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      Property(node) {
        if (
          node.method === true &&
          node.kind === 'init' &&
          node.parent?.type === 'ObjectExpression'
        ) {
          context.report({
            node: node.key,
            message: '객체 메서드 축약을 쓰지 않는다. 화살표 프로퍼티(`name: () => {}`)로 쓴다.',
          });
        }
      },
    };
  },
};

const DTO_ALIAS_SUFFIX = /(?:Dto|Schema)$/u;

// @aido/api 타입을 다른 이름으로 가져오면 계약 모양인 줄 알 수 있게 Dto·Schema로 끝낸다
const dtoAlias = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      ImportDeclaration(node) {
        if (
          typeof node.source.value !== 'string' ||
          !/^@aido\/api(?:\/|$)/u.test(node.source.value)
        ) {
          return;
        }
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') {
            continue;
          }
          const isType = node.importKind === 'type' || specifier.importKind === 'type';
          const imported =
            specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : specifier.imported.value;
          if (
            isType &&
            imported !== specifier.local.name &&
            !DTO_ALIAS_SUFFIX.test(specifier.local.name)
          ) {
            context.report({
              node: specifier.local,
              message: `${specifier.local.name}: @aido/api 타입을 별칭으로 가져오면 \`Dto\`나 \`Schema\`로 끝낸다(\`${imported} as ${imported}Dto\`).`,
            });
          }
        }
      },
    };
  },
};

const TIME_NAME_TOKEN = /(?:^|_)(?:DURATION|DELAY|TIMEOUT|INTERVAL|TTL)S?(?:_|$)/u;
const TIME_UNIT_SUFFIX = /_(?:MS|SECONDS|MINUTES|HOURS|DAYS)$/u;
const UPPER_SNAKE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;

function isNumericValue(node) {
  const target = unwrap(node);
  switch (target?.type) {
    case 'Literal':
      return typeof target.value === 'number';
    case 'UnaryExpression':
      return isNumericValue(target.argument);
    case 'BinaryExpression':
      return isNumericValue(target.left) && isNumericValue(target.right);
    case 'ArrayExpression':
      return (
        target.elements.length > 0 &&
        target.elements.every((element) => element != null && isNumericValue(element))
      );
    default:
      return false;
  }
}

// 시간을 뜻하는 숫자 상수는 이름 끝에 단위를 붙인다(`SHEET_DELAY_MS`)
const timeConstantUnit = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || node.init == null) {
          return;
        }
        const { name } = node.id;
        if (
          UPPER_SNAKE.test(name) &&
          TIME_NAME_TOKEN.test(name) &&
          !TIME_UNIT_SUFFIX.test(name) &&
          isNumericValue(node.init)
        ) {
          context.report({
            node: node.id,
            message: `${name}: 시간 상수는 이름 끝에 단위(_MS, _SECONDS, _MINUTES, _HOURS, _DAYS)를 붙인다.`,
          });
        }
      },
    };
  },
};

const QUERY_HOOKS = new Set([
  'useQuery',
  'useSuspenseQuery',
  'useInfiniteQuery',
  'useSuspenseInfiniteQuery',
]);

// 한 컴포넌트에 query가 둘 이상일 수 있어 `data`를 그대로 받지 않고 이름을 붙인다
const queryDataAlias = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      VariableDeclarator(node) {
        if (node.id.type !== 'ObjectPattern' || node.init == null) {
          return;
        }
        const init = unwrap(node.init);
        if (init?.type !== 'CallExpression' || !QUERY_HOOKS.has(getCalleeName(init.callee))) {
          return;
        }
        for (const property of node.id.properties) {
          if (
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === 'data' &&
            property.value.type === 'Identifier' &&
            property.value.name === 'data'
          ) {
            context.report({
              node: property,
              message:
                '`{ data }`를 별칭 없이 받지 않는다. `{ data: todos }`처럼 무엇인지 드러나는 이름을 붙인다.',
            });
          }
        }
      },
    };
  },
};

// `ReturnType<typeof useX>` 대신 훅이 돌려주는 모양을 이름 있는 타입으로 선언한다
const noReturnTypeOfHook = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      TSTypeReference(node) {
        if (node.typeName.type !== 'Identifier' || node.typeName.name !== 'ReturnType') {
          return;
        }
        const argument = (node.typeArguments ?? node.typeParameters)?.params?.[0];
        if (
          argument?.type === 'TSTypeQuery' &&
          argument.exprName.type === 'Identifier' &&
          /^use[A-Z]/u.test(argument.exprName.name)
        ) {
          context.report({
            node,
            message: `ReturnType<typeof ${argument.exprName.name}>을 쓰지 않는다. 훅이 돌려주는 모양을 이름 있는 타입으로 선언해 훅과 쓰는 곳이 함께 쓴다.`,
          });
        }
      },
    };
  },
};

export default {
  'no-class-method': noClassMethod,
  'no-object-method-shorthand': noObjectMethodShorthand,
  'dto-alias': dtoAlias,
  'time-constant-unit': timeConstantUnit,
  'query-data-alias': queryDataAlias,
  'no-return-type-of-hook': noReturnTypeOfHook,
};
