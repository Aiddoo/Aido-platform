import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { PlopTypes } from '@turbo/gen';

const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ID_TYPES = ['serial', 'cuid'] as const;
const TEMPLATE_ROOT = 'templates/api-slice';

function validateKebabCase(input: string): true | string {
  return KEBAB_CASE.test(input) ? true : 'kebab-case로 입력하세요 (예: memos)';
}

// [생성 경로, 템플릿 경로]. 경로의 {{…}}는 plop이 답으로 채운다
const SLICE_FILES: ReadonlyArray<readonly [string, string]> = [
  ['domain/{{aggregate}}.aggregate.ts', 'domain/aggregate.ts.hbs'],
  ['domain/{{aggregate}}-id.vo.ts', 'domain/id.vo.ts.hbs'],
  ['domain/{{aggregate}}-name.vo.ts', 'domain/name.vo.ts.hbs'],
  ['application/ports/{{aggregate}}.repository.port.ts', 'application/repository.port.ts.hbs'],
  [
    'application/ports/{{aggregate}}.repository.port.spec.ts',
    'application/repository.port.spec.ts.hbs',
  ],
  ['application/{{slice}}.lock-keys.ts', 'application/lock-keys.ts.hbs'],
  ['application/{{slice}}.log-events.ts', 'application/log-events.ts.hbs'],
  ['application/use-cases/create-{{aggregate}}.use-case.ts', 'application/create.use-case.ts.hbs'],
  [
    'application/use-cases/create-{{aggregate}}.use-case.spec.ts',
    'application/create.use-case.spec.ts.hbs',
  ],
  ['application/use-cases/list-{{slice}}.use-case.ts', 'application/list.use-case.ts.hbs'],
  [
    'application/use-cases/list-{{slice}}.use-case.spec.ts',
    'application/list.use-case.spec.ts.hbs',
  ],
  [
    'infrastructure/persistence/drizzle-{{aggregate}}.repository.ts',
    'infrastructure/drizzle.repository.ts.hbs',
  ],
  ['infrastructure/persistence/{{aggregate}}-row.mapper.ts', 'infrastructure/row.mapper.ts.hbs'],
  ['presentation/http/v1/{{aggregate}}.controller.ts', 'presentation/controller.ts.hbs'],
  ['presentation/http/v1/{{aggregate}}.dto.ts', 'presentation/dto.ts.hbs'],
  ['presentation/http/v1/{{aggregate}}-response.mapper.ts', 'presentation/response.mapper.ts.hbs'],
  ['{{context}}-{{slice}}.module.ts', 'module.ts.hbs'],
  ['{{context}}-{{slice}}.providers.ts', 'providers.ts.hbs'],
  ['{{context}}-{{slice}}.public.ts', 'public.ts.hbs'],
];

const TEST_FILES: ReadonlyArray<readonly [string, string]> = [
  ['fixtures/{{context}}/{{aggregate}}.fixture.ts', 'test/fixture.ts.hbs'],
  ['doubles/{{context}}/in-memory-{{aggregate}}.repository.ts', 'test/in-memory.repository.ts.hbs'],
  ['contracts/{{context}}/{{aggregate}}-repository.contract.ts', 'test/repository.contract.ts.hbs'],
  [
    'integration/{{context}}/{{slice}}/drizzle-{{aggregate}}.repository.integration-spec.ts',
    'test/repository.integration-spec.ts.hbs',
  ],
];

const CONTRACT_FILES: ReadonlyArray<readonly [string, string]> = [
  ['contracts/{{aggregate}}/index.ts', 'contracts/index.ts.hbs'],
  ['contracts/{{aggregate}}/v1/{{aggregate}}.request.ts', 'contracts/request.ts.hbs'],
  ['contracts/{{aggregate}}/v1/{{aggregate}}.response.ts', 'contracts/response.ts.hbs'],
  ['vocabulary/{{aggregate}}.constants.ts', 'contracts/constants.ts.hbs'],
];

interface IdTemplateData {
  readonly isSerial: boolean;
  readonly idTsType: 'number' | 'string';
}

function addFiles(
  baseDirectory: string,
  files: ReadonlyArray<readonly [string, string]>,
  data: IdTemplateData,
): PlopTypes.ActionType[] {
  return files.map(([path, templateFile]) => ({
    type: 'add',
    path: `${baseDirectory}/${path}`,
    templateFile: `${TEMPLATE_ROOT}/${templateFile}`,
    data,
    abortOnFail: true,
  }));
}

const MODULE_ARRAYS = ['imports', 'exports'] as const;

function toPascalCase(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Context Module이 이미 있으면 새 slice Module을 imports·exports에 더한다. 없으면 add 액션이 만든다.
function appendSliceToContextModule(
  contextModulePath: string,
  context: string,
  slice: string,
): string {
  const sliceModule = `${toPascalCase(context)}${toPascalCase(slice)}Module`;
  const source = readFileSync(contextModulePath, 'utf8');
  if (source.includes(sliceModule)) {
    return `${contextModulePath}에 ${sliceModule}이 이미 있다`;
  }

  const importLine = `import { ${sliceModule} } from "./${slice}/${context}-${slice}.module.js";`;
  const lastImport = [...source.matchAll(/^import .*;$/gm)].at(-1);
  if (lastImport?.index == null) {
    throw new Error(`${contextModulePath}에서 import 위치를 찾지 못했다`);
  }
  const importEnd = lastImport.index + lastImport[0].length;
  let next = `${source.slice(0, importEnd)}\n${importLine}${source.slice(importEnd)}`;

  for (const key of MODULE_ARRAYS) {
    const pattern = new RegExp(`(${key}: \\[)([^\\]]*)(\\])`);
    if (!pattern.test(next)) {
      throw new Error(`${contextModulePath}에서 ${key} 배열을 찾지 못했다`);
    }
    next = next.replace(pattern, (_match, open: string, items: string, close: string) => {
      const kept = items.trim().replace(/,$/, '');
      return `${open}${kept === '' ? '' : `${kept}, `}${sliceModule}${close}`;
    });
  }

  writeFileSync(contextModulePath, next);
  return `${contextModulePath}에 ${sliceModule}을 더했다`;
}

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setGenerator('api-slice', {
    description: '규칙대로 서버 slice(도메인·UseCase·저장소·HTTP·테스트)와 계약 뼈대를 만든다',
    prompts: [
      {
        type: 'input',
        name: 'context',
        message: 'Bounded Context (kebab-case, 예: notes)',
        validate: validateKebabCase,
      },
      {
        type: 'input',
        name: 'slice',
        message: 'slice (kebab-case 복수, 예: memos)',
        validate: validateKebabCase,
      },
      {
        type: 'input',
        name: 'aggregate',
        message: 'Aggregate (kebab-case 단수, 예: memo)',
        validate: validateKebabCase,
      },
      {
        type: 'list',
        name: 'idType',
        message: 'id 종류 (serial: DB 시퀀스, cuid: 앱이 만드는 문자열)',
        choices: [...ID_TYPES],
      },
    ],
    actions: (answers) => {
      const isSerial = answers?.idType === 'serial';
      const data: IdTemplateData = { isSerial, idTsType: isSerial ? 'number' : 'string' };

      const context = String(answers?.context);
      const slice = String(answers?.slice);
      const contextModulePath = join(
        plop.getDestBasePath(),
        `apps/api/src/modules/${context}/${context}.module.ts`,
      );
      const contextModuleActions: PlopTypes.ActionType[] = existsSync(contextModulePath)
        ? [() => appendSliceToContextModule(contextModulePath, context, slice)]
        : [
            {
              type: 'add',
              path: 'apps/api/src/modules/{{context}}/{{context}}.module.ts',
              templateFile: `${TEMPLATE_ROOT}/context.module.ts.hbs`,
              abortOnFail: true,
            },
          ];

      return [
        ...addFiles('apps/api/src/modules/{{context}}/{{slice}}', SLICE_FILES, data),
        ...contextModuleActions,
        ...addFiles('apps/api/test', TEST_FILES, data),
        ...addFiles('packages/api/src', CONTRACT_FILES, data),
        {
          type: 'add',
          path: 'apps/api/src/platform/database/schema/{{context}}.schema.ts',
          templateFile: `${TEMPLATE_ROOT}/schema.ts.hbs`,
          data,
          skipIfExists: true,
        },
        {
          type: 'append',
          path: 'apps/api/src/platform/database/schema/tables.schema.ts',
          template: 'export * from "./{{context}}.schema.js";',
          unique: true,
        },
        {
          type: 'modify',
          path: 'packages/api/src/index.ts',
          pattern: /(\nexport \* from "\.\/vocabulary\/index\.js";)/,
          template: '\nexport * from "./contracts/{{aggregate}}/index.js";$1',
        },
        {
          type: 'append',
          path: 'packages/api/src/vocabulary/index.ts',
          template: 'export * from "./{{aggregate}}.constants.js";',
          unique: true,
        },
        () =>
          [
            '다음을 직접 마무리한다:',
            '1. platform/database/schema/<context>.schema.ts에 테이블이 있는지 확인하고 pnpm db:generate',
            '2. app.module.ts에는 <Context>Module(modules/<context>/<context>.module.ts)만 import한다. slice Module을 직접 넣지 않는다',
            '3. pnpm --filter @aido/api build && pnpm format && pnpm check',
          ].join('\n'),
      ];
    },
  });
}
