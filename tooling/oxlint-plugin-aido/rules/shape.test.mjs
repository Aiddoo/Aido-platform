import { createRuleTester } from '../rule-tester.mjs';
import rules from './shape.mjs';

const tester = createRuleTester();

tester.run('member-order', rules['member-order'], {
  valid: [
    `abstract class Memo extends AggregateRoot<MemoId, MemoProps> {
  static create() {}
  static reconstitute() {}
  readonly #cache = new Map();
  constructor() { super(); }
  get content() { return this.props.content; }
  set content(value) {}
  isPinned() { return true; }
  abstract rewrite(): boolean;
  get #title() { return ''; }
  #touch() {}
  protected override validate() {}
}`,
    'class Empty {}',
  ],
  invalid: [
    {
      code: 'class Memo { rewrite() {} static create() {} }',
      errors: [{ message: /create\(static 팩토리\)는 rewrite\(public 메서드\)보다 앞에 둔다/ }],
    },
    {
      code: 'class MemoController { constructor() {} readonly #logger = new Logger(); }',
      errors: [{ message: /#logger\(필드\)는 constructor\(생성자\)보다 앞에 둔다/ }],
    },
    {
      code: 'class Memo { #touch() {} get content() {} save() {} }',
      errors: [
        { message: /content\(public getter\)는 #touch\(# 비공개 getter·메서드\)보다/ },
        { message: /save\(public 메서드\)는 #touch/ },
      ],
    },
    {
      code: 'class Memo { rewrite() {} get content() {} }',
      errors: [{ message: /content\(public getter\)는 rewrite\(public 메서드\)보다 앞에 둔다/ }],
    },
  ],
});

tester.run('max-params', rules['max-params'], {
  valid: [
    'function plan(first, second, third) {}',
    'function bind(this: Memo, first, second, third) {}',
    '@Injectable()\nclass MemoAdapter { constructor(a: A, b: B, c: C, d: D) {} }',
    { code: 'const plan = (first, second) => {};', options: [{ max: 2 }] },
  ],
  invalid: [
    {
      code: 'function plan(first, second, third, fourth) {}',
      errors: [{ message: /인자가 4개다/ }],
    },
    { code: 'const plan = (first, second, third, fourth) => {};', errors: 1 },
    { code: 'class MemoEvent { constructor(a, b, c, d) {} }', errors: 1 },
    {
      code: '@Controller()\nclass MemoController { list(@Param() a, @Body() b, @Query() c, @CurrentUser() d) {} }',
      errors: 1,
    },
    { code: 'abstract class MemoPort { abstract plan(a, b, c, d): void; }', errors: 1 },
    { code: 'declare function plan(a, b, c, d): void;', errors: 1 },
  ],
});
