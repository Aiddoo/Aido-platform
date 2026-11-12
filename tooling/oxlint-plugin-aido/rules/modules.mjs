import { collectImportedNames } from '../ast.mjs';

const RE_EXPORT_MESSAGE =
  '다시 내보내지 않는다. 쓰는 곳이 정의 파일을 import한다. 재수출은 정해진 공개 진입 파일(서버 *.public.ts·Drizzle schema 묶음)에서만 한다.';

function getLocalName(specifier) {
  const { local } = specifier;
  return local.type === 'Identifier' ? local.name : local.value;
}

// 경로를 바꾸면 import를 정의 파일로 옮겨야 해 결합만 늘리는 재수출을 막는다
const noReExport = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: { checkDefaultExport: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const checkDefaultExport = context.options[0]?.checkDefaultExport ?? false;
    let importedNames = new Set();
    return {
      Program(program) {
        importedNames = collectImportedNames(program, { includeNamespace: true });
      },
      ExportAllDeclaration(node) {
        context.report({ node, message: RE_EXPORT_MESSAGE });
      },
      ExportNamedDeclaration(node) {
        if (node.source != null) {
          context.report({ node, message: RE_EXPORT_MESSAGE });
          return;
        }
        const reExported = node.specifiers
          .map(getLocalName)
          .filter((name) => importedNames.has(name));
        if (reExported.length > 0) {
          context.report({ node, message: `${reExported.join(', ')}: ${RE_EXPORT_MESSAGE}` });
        }
      },
      ExportDefaultDeclaration(node) {
        if (
          checkDefaultExport &&
          node.declaration.type === 'Identifier' &&
          importedNames.has(node.declaration.name)
        ) {
          context.report({ node, message: `${node.declaration.name}: ${RE_EXPORT_MESSAGE}` });
        }
      },
    };
  },
};

// barrel(index.ts)을 두지 않는다. 쓰는 곳이 정의 파일을 import한다(다른 Context는 *.public.ts만)
const noBarrelFile = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      Program(program) {
        context.report({
          node: program,
          message:
            'barrel(index.ts)을 두지 않는다. 쓰는 곳이 정의 파일을 import한다(다른 Context는 *.public.ts만).',
        });
      },
    };
  },
};

const MEMBER_TYPES = [
  'MethodDefinition',
  'PropertyDefinition',
  'AccessorProperty',
  'TSAbstractMethodDefinition',
  'TSAbstractPropertyDefinition',
  'TSAbstractAccessorProperty',
  'TSParameterProperty',
];

// 비공개는 `#` 하나다. protected는 하위 클래스 확장점인 shared/domain 기반 클래스와 프레임워크 메서드 재정의만 쓴다
const noMemberAccessibility = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: { allowProtected: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const allowProtected = context.options[0]?.allowProtected ?? false;
    function check(node) {
      const { accessibility } = node;
      if (
        accessibility == null ||
        (accessibility === 'protected' && (allowProtected || node.override === true))
      ) {
        return;
      }
      context.report({
        node,
        message: `'${accessibility}' 멤버 키워드는 쓰지 않는다. 비공개는 '#' 필드·메서드로 둔다.`,
      });
    }
    return Object.fromEntries(MEMBER_TYPES.map((type) => [type, check]));
  },
};

// pgEnum 값은 @aido/api/vocabulary 또는 소유 slice domain/*.constants.ts의 튜플에서 유도한다
const noPgEnumLiteral = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      CallExpression(node) {
        const [name, values] = node.arguments;
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'pgEnum' &&
          (name?.type === 'Literal' || name?.type === 'TemplateLiteral') &&
          values?.type === 'ArrayExpression'
        ) {
          context.report({
            node,
            message: `pgEnum(${context.sourceCode.getText(name)}) 값을 리터럴 배열로 적었다. @aido/api/vocabulary 또는 소유 slice domain/*.constants.ts의 튜플에서 유도한다.`,
          });
        }
      },
    };
  },
};

const CODED_EXCEPTIONS = new Set(['ApplicationException', 'DomainException']);

// 같은 코드의 details 모양이 흩어지면 공개 details 등록이 빠진다(VERIFY_0753). 만드는 곳을 *.errors.ts로 모은다
const noInlineCodedException = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && CODED_EXCEPTIONS.has(node.callee.name)) {
          context.report({
            node,
            message: `${node.callee.name}을 바로 만들지 않는다. slice <slice>.errors.ts의 이름 있는 생성 함수로 만든다(거부는 application, 불변식은 domain).`,
          });
        }
      },
    };
  },
};

export default {
  'no-re-export': noReExport,
  'no-barrel-file': noBarrelFile,
  'no-member-accessibility': noMemberAccessibility,
  'no-pg-enum-literal': noPgEnumLiteral,
  'no-inline-coded-exception': noInlineCodedException,
};
