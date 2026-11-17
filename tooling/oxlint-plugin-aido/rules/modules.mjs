import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { collectImportedNames } from '../ast.mjs';

const RE_EXPORT_MESSAGE =
  '다시 내보내지 않는다. 쓰는 곳이 정의 파일을 import한다. 재수출은 정해진 공개 진입 파일(서버 *.public.ts·Drizzle schema 묶음, 앱 shared 공개 면)에서만 한다.';

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

const CODED_EXCEPTIONS = new Set([
  'ApplicationException',
  'DomainException',
  'ErrorCodedException',
]);

const INLINE_MESSAGE = (name) =>
  `${name}을 바로 만들지 않는다. slice <slice>.errors.ts의 이름 있는 생성 함수로 만든다(거부는 application, 불변식은 domain).`;

// 같은 코드의 details 모양이 흩어지면 공개 details 등록이 빠진다(VERIFY_0753). 만드는 곳을 *.errors.ts로 모은다
const noInlineCodedException = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    // 이 파일에서 코드 예외 클래스를 가리키는 이름(별칭 import 포함)
    let exceptionNames = new Set(CODED_EXCEPTIONS);
    const checkSubclass = (node) => {
      const base = node.superClass;
      // 바탕 클래스 둘(ApplicationException·DomainException)은 ErrorCodedException을 잇는 정의 자리다
      const isBaseDefinition = node.id != null && CODED_EXCEPTIONS.has(node.id.name);
      if (base?.type === 'Identifier' && exceptionNames.has(base.name) && !isBaseDefinition) {
        context.report({
          node,
          message: `${base.name}을 잇는 예외 클래스를 만들지 않는다. 코드와 details는 slice <slice>.errors.ts의 생성 함수가 정한다.`,
        });
      }
    };
    return {
      before() {
        exceptionNames = new Set(CODED_EXCEPTIONS);
      },
      ImportSpecifier(node) {
        const imported =
          node.imported.type === 'Identifier' ? node.imported.name : node.imported.value;
        if (CODED_EXCEPTIONS.has(imported)) {
          exceptionNames.add(node.local.name);
        }
      },
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && exceptionNames.has(node.callee.name)) {
          context.report({ node, message: INLINE_MESSAGE(node.callee.name) });
        }
      },
      ClassDeclaration: checkSubclass,
      ClassExpression: checkSubclass,
    };
  },
};

const MODULE_CONTEXT = /^(.*)\/src\/modules\/([^/]+)\//u;
const SCHEMA_SOURCE = /(?:^|\/)platform\/database\/schema\//u;
const SCHEMA_FILE = /^(.+)\.schema\.ts$/u;
const TABLE_DECLARATION = /export const (\w+) = pgTable\(/gu;
const tableOwnersCache = new Map();

/** 서버 src의 schema/<context>.schema.ts가 선언한 테이블 → 그 Context. platform·outbound 같은 Context 밖 schema는 뺀다 */
function readTableOwners(sourceRoot) {
  const schemaDirectory = join(sourceRoot, 'platform/database/schema');
  const modulesDirectory = join(sourceRoot, 'modules');
  if (!existsSync(schemaDirectory) || !existsSync(modulesDirectory)) {
    return new Map();
  }
  const schemaFiles = readdirSync(schemaDirectory).filter((file) => SCHEMA_FILE.test(file));
  const signature = schemaFiles
    .map((file) => `${file}:${statSync(join(schemaDirectory, file)).mtimeMs}`)
    .join('|');
  const cached = tableOwnersCache.get(schemaDirectory);
  if (cached?.signature === signature) {
    return cached.owners;
  }
  const contexts = new Set(readdirSync(modulesDirectory));
  const owners = new Map();
  for (const file of schemaFiles) {
    const owner = SCHEMA_FILE.exec(file)?.[1];
    if (owner == null || !contexts.has(owner)) {
      continue;
    }
    const text = readFileSync(join(schemaDirectory, file), 'utf8');
    for (const [, table] of text.matchAll(TABLE_DECLARATION)) {
      owners.set(table, owner);
    }
  }
  tableOwnersCache.set(schemaDirectory, { signature, owners });
  return owners;
}

const foreignTableMessage = (table, owner) =>
  `${table}: ${owner} Context의 테이블이다. 그 Context의 *.public.ts가 연 조회 조각(<noun>.query-fragment.ts)·포트를 쓴다.`;

// 다른 Context의 테이블을 import하거나 db.query.<table>로 읽지 않는다. 소유 Context가 연 조각·포트만 붙인다(architecture.md#의존-규칙과-강제)
const noForeignContextTable = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    const match = MODULE_CONTEXT.exec(context.filename);
    if (match == null) {
      return {};
    }
    const [, packageRoot, currentContext] = match;
    const owners = readTableOwners(join(packageRoot, 'src'));
    const foreignOwner = (name) => {
      const owner = owners.get(name);
      return owner == null || owner === currentContext ? null : owner;
    };
    return {
      ImportDeclaration(node) {
        if (!SCHEMA_SOURCE.test(node.source.value)) {
          return;
        }
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') {
            continue;
          }
          const name =
            specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : specifier.imported.value;
          const owner = foreignOwner(name);
          if (owner != null) {
            context.report({ node: specifier, message: foreignTableMessage(name, owner) });
          }
        }
      },
      MemberExpression(node) {
        const { object, property } = node;
        const isRelationalQuery =
          !node.computed &&
          property.type === 'Identifier' &&
          object.type === 'MemberExpression' &&
          !object.computed &&
          object.property.type === 'Identifier' &&
          object.property.name === 'query';
        const owner = isRelationalQuery ? foreignOwner(property.name) : null;
        if (owner != null) {
          context.report({ node: property, message: foreignTableMessage(property.name, owner) });
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
  'no-foreign-context-table': noForeignContextTable,
};
