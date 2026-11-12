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

function pascalFromKebab(name) {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function camelFromKebab(name) {
  const pascal = pascalFromKebab(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function collectExportedNames(program) {
  const names = new Set();
  for (const statement of program.body) {
    if (statement.type === 'ExportDefaultDeclaration') {
      const declaration = statement.declaration;
      if (declaration.type === 'Identifier') {
        names.add(declaration.name);
      } else if (declaration.id != null) {
        names.add(declaration.id.name);
      }
    }
    if (statement.type !== 'ExportNamedDeclaration') {
      continue;
    }
    const { declaration } = statement;
    if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type === 'Identifier') {
          names.add(declarator.id.name);
        }
      }
    } else if (declaration?.id != null) {
      names.add(declaration.id.name);
    }
    for (const specifier of statement.specifiers) {
      const { exported } = specifier;
      names.add(exported.type === 'Identifier' ? exported.name : exported.value);
    }
  }
  return names;
}

const HOOK_FILE = /\/hooks\/(use-[a-z0-9]+(?:-[a-z0-9]+)*)\.tsx?$/u;
const COMPONENT_FILE = /\/components\/([a-z0-9]+(?:-[a-z0-9]+)*)\.tsx$/u;
const PARAMS_BUNDLE = /-params$/u;

// hooks/use-foo-bar.ts는 useFooBar를, components/foo-bar.tsx는 FooBar를 내보낸다.
// `use-*-params.ts`는 route 튜플 훅 묶음이라 이름을 파일에서 정하지 않는다
const fileExportName = {
  meta: { type: 'suggestion' },
  create(context) {
    const filename = context.filename.replaceAll('\\', '/');
    const hookFile = HOOK_FILE.exec(filename)?.[1];
    const componentFile = COMPONENT_FILE.exec(filename)?.[1];
    return {
      Program(program) {
        let expected = null;
        if (hookFile != null && !PARAMS_BUNDLE.test(hookFile)) {
          expected = camelFromKebab(hookFile);
        } else if (componentFile != null) {
          expected = pascalFromKebab(componentFile);
        }
        if (expected == null || collectExportedNames(program).has(expected)) {
          return;
        }
        context.report({
          node: program,
          message: `파일 이름과 내보내는 이름이 맞아야 한다. 이 파일은 \`${expected}\`를 내보내거나 파일 이름을 바꾼다.`,
        });
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

function hasKeyword(union, type) {
  return union.types.some((member) => member.type === type);
}

function findOwnerName(node) {
  let current = node.parent;
  while (current != null) {
    if (
      (current.type === 'TSTypeAliasDeclaration' || current.type === 'TSInterfaceDeclaration') &&
      current.id != null
    ) {
      return current.id.name;
    }
    if (current.type === 'VariableDeclarator' && current.id.type === 'Identifier') {
      return current.id.name;
    }
    current = current.parent;
  }
  return null;
}

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'TSDeclareFunction',
]);

// "없음"을 두 가지로 적지 않는다. 선택 입력은 `?: T`, 값이 없을 수 있는 필수 입력은 `T | null`이다.
// PATCH 요청처럼 "안 보냄"과 "지움"이 달라 둘 다 필요한 스키마는 allowedNames로 이름을 적는다
const noDoubleNullish = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: { allowedNames: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const allowedNames = new Set(context.options[0]?.allowedNames ?? []);
    function report(node, text) {
      const owner = findOwnerName(node);
      if (owner != null && allowedNames.has(owner)) {
        return;
      }
      context.report({
        node,
        message: `${text}: 없음을 두 가지로 적지 않는다. 선택 입력은 \`?: T\`, 값이 없을 수 있는 필수 입력은 \`T | null\`로 한쪽만 쓴다.`,
      });
    }
    return {
      TSUnionType(node) {
        if (hasKeyword(node, 'TSNullKeyword') && hasKeyword(node, 'TSUndefinedKeyword')) {
          report(node, 'T | null | undefined');
        }
      },
      TSPropertySignature(node) {
        const type = node.typeAnnotation?.typeAnnotation;
        if (
          node.optional === true &&
          type?.type === 'TSUnionType' &&
          hasKeyword(type, 'TSNullKeyword')
        ) {
          report(node, '?: T | null');
        }
      },
      Identifier(node) {
        const type = node.typeAnnotation?.typeAnnotation;
        if (
          FUNCTION_TYPES.has(node.parent?.type) &&
          node.optional === true &&
          type?.type === 'TSUnionType' &&
          hasKeyword(type, 'TSNullKeyword')
        ) {
          report(node, '인자?: T | null');
        }
      },
    };
  },
};

export default {
  'no-class-method': noClassMethod,
  'no-object-method-shorthand': noObjectMethodShorthand,
  'file-export-name': fileExportName,
  'dto-alias': dtoAlias,
  'time-constant-unit': timeConstantUnit,
  'query-data-alias': queryDataAlias,
  'no-return-type-of-hook': noReturnTypeOfHook,
  'no-double-nullish': noDoubleNullish,
};
