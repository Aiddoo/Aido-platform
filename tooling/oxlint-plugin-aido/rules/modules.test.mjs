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
