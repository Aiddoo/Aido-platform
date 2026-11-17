import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';

import { createRuleTester } from '../rule-tester.mjs';
import rules from './modules.mjs';

const tester = createRuleTester();

tester.run('no-re-export', rules['no-re-export'], {
  valid: [
    'export const memoSchema = z.object({});',
    'const local = 1;\nexport { local };',
    "import thing from './thing';\nexport default thing;",
  ],
  invalid: [
    { code: "export { MemoPolicy } from './memo.model';", errors: 1 },
    { code: "export type { Memo } from './memo.model';", errors: 1 },
    { code: "export * from './memo.model';", errors: 1 },
    { code: "export * as memo from './memo.model';", errors: 1 },
    { code: "import { MemoPolicy } from './memo.model';\nexport { MemoPolicy };", errors: 1 },
    { code: "import * as memo from './memo.model';\nexport { memo as model };", errors: 1 },
    {
      code: "import thing from './thing';\nexport default thing;",
      options: [{ checkDefaultExport: true }],
      errors: 1,
    },
  ],
});

tester.run('no-barrel-file', rules['no-barrel-file'], {
  valid: [],
  invalid: [{ code: 'export const value = 1;', errors: 1 }],
});

tester.run('no-member-accessibility', rules['no-member-accessibility'], {
  valid: [
    'class Memo { #title = ""; get title() { return this.#title; } }',
    'class Memo extends Base { protected override validate() {} }',
    { code: 'abstract class Entity { protected raise() {} }', options: [{ allowProtected: true }] },
  ],
  invalid: [
    { code: 'class Memo { private title = ""; }', errors: 1 },
    { code: 'class Memo { public save() {} }', errors: 1 },
    { code: 'class Memo { protected validate() {} }', errors: 1 },
    { code: 'class Memo { constructor(private readonly repository: Repository) {} }', errors: 1 },
    { code: 'abstract class Memo { protected abstract validate(): void; }', errors: 1 },
    { code: 'class Memo { public static readonly LIMIT = 1; }', errors: 1 },
  ],
});

tester.run('no-pg-enum-literal', rules['no-pg-enum-literal'], {
  valid: ["export const memoStatus = pgEnum('memo_status', MEMO_STATUSES);"],
  invalid: [
    { code: "export const memoStatus = pgEnum('memo_status', ['DRAFT', 'DONE']);", errors: 1 },
  ],
});

tester.run('no-inline-coded-exception', rules['no-inline-coded-exception'], {
  valid: [
    'throw memoNotFound(memoId);',
    'const error = new Error("boom");',
    'if (error instanceof ApplicationException) { throw error; }',
    'export class ApplicationException extends ErrorCodedException {}',
    'export class DomainException extends ErrorCodedException {}',
    'class Repository extends BaseRepository {}',
  ],
  invalid: [
    { code: 'throw new ApplicationException(ErrorCode.MEMO_2001, { memoId });', errors: 1 },
    { code: 'throw new DomainException(ErrorCode.SYS_0002, { field: "title" });', errors: 1 },
    { code: 'const e = new ApplicationException(code, undefined, { cause });', errors: 1 },
    { code: 'throw new ErrorCodedException(ErrorCode.SYS_0001);', errors: 1 },
    {
      code: [
        "import { ApplicationException as Rejected } from '@/shared/application/application.exception';",
        'throw new Rejected(ErrorCode.MEMO_2001);',
      ].join('\n'),
      errors: 1,
    },
    { code: 'class MemoNotFound extends ApplicationException {}', errors: 1 },
    { code: 'const Invalid = class extends DomainException {};', errors: 1 },
  ],
});

const serverRoot = mkdtempSync(join(tmpdir(), 'aido-foreign-context-table-'));
after(() => rmSync(serverRoot, { recursive: true, force: true }));
const schemaDirectory = join(serverRoot, 'src/platform/database/schema');
mkdirSync(schemaDirectory, { recursive: true });
for (const moduleContext of ['planning', 'identity', 'notes']) {
  mkdirSync(join(serverRoot, 'src/modules', moduleContext), { recursive: true });
}
writeFileSync(join(schemaDirectory, 'planning.schema.ts'), 'export const todo = pgTable(\n');
writeFileSync(join(schemaDirectory, 'identity.schema.ts'), 'export const user = pgTable(\n');
writeFileSync(
  join(schemaDirectory, 'outbound.schema.ts'),
  'export const outboundCall = pgTable(\n',
);
const notesReader = join(
  serverRoot,
  'src/modules/notes/memos/infrastructure/persistence/reader.ts',
);
const planningFragment = join(
  serverRoot,
  'src/modules/planning/todos/infrastructure/persistence/todo.query-fragment.ts',
);

tester.run('no-foreign-context-table', rules['no-foreign-context-table'], {
  valid: [
    {
      code: "import { todo } from '#api/platform/database/schema/index';\ndb.query.todo.findMany();",
      filename: planningFragment,
    },
    {
      code: "import { outboundCall } from '#api/platform/database/schema/index';",
      filename: notesReader,
    },
    {
      code: "import { todoOwners } from '#api/modules/planning/todos/planning-todos-queries.public';",
      filename: notesReader,
    },
    { code: 'search.query.user.trim();', filename: join(serverRoot, 'src/platform/http/a.ts') },
  ],
  invalid: [
    {
      code: "import { todo, user } from '#api/platform/database/schema/index';",
      filename: notesReader,
      errors: 2,
    },
    {
      code: "import type { user } from '#api/platform/database/schema/identity.schema';",
      filename: notesReader,
      errors: 1,
    },
    {
      code: 'const row = db.query.user.findFirst({ where: { id } });',
      filename: planningFragment,
      errors: 1,
    },
  ],
});
