import { createRuleTester } from '../rule-tester.mjs';
import rules from './conventions.mjs';

const tester = createRuleTester();

tester.run('no-class-method', rules['no-class-method'], {
  valid: [
    'class A { run = () => {}; }',
    'class A { constructor() {} get value() { return 1; } set value(v) {} }',
    'class A extends Error { toString() { return ""; } }',
    'class A extends ApiError { name() { return ""; } }',
    'class A extends React.Component { render() { return null; } }',
    'class A extends Component { componentDidCatch() {} }',
    'class A extends Base { override run() {} }',
  ],
  invalid: [
    { code: 'class A { run() {} }', errors: 1 },
    { code: 'class A { static create() {} }', errors: 1 },
    { code: 'class A extends Base { run() {} }', errors: 1 },
  ],
});

tester.run('no-object-method-shorthand', rules['no-object-method-shorthand'], {
  valid: [
    'const a = { run: () => {} };',
    'const a = { run: function run() {} };',
    'const a = { get value() { return 1; } };',
    'const { run } = a;',
  ],
  invalid: [
    { code: 'const a = { run() {} };', errors: 1 },
    { code: 'const a = { async load() {} };', errors: 1 },
    { code: 'const a = { *gen() {} };', errors: 1 },
  ],
});

tester.run('dto-alias', rules['dto-alias'], {
  valid: [
    "import type { TodoResponse } from '@aido/api/contracts';",
    "import type { TodoResponse as TodoResponseDto } from '@aido/api/contracts';",
    "import type { TodoSchema as TodoRequestSchema } from '@aido/api';",
    "import { x as y } from 'other';",
    "import { todoSchema as remoteTodo } from '@aido/api';",
  ],
  invalid: [
    { code: "import type { TodoResponse as TodoDTO } from '@aido/api/contracts';", errors: 1 },
    { code: "import { type TodoResponse as Todo } from '@aido/api';", errors: 1 },
  ],
});

tester.run('time-constant-unit', rules['time-constant-unit'], {
  valid: [
    'const SHEET_DELAY_MS = 300;',
    'const CACHE_TTL_MINUTES = 5;',
    'const RETRY_INTERVAL_SECONDS = 30;',
    'const MAX_COUNT = 3;',
    'const SHEET_DELAY = getDelay();',
    'const sheetDelay = 300;',
  ],
  invalid: [
    { code: 'const SHEET_ANIMATION_DURATION = 300;', errors: 1 },
    { code: 'const STORE_PREMIUM_SYNC_DELAYS = [1000, 3000];', errors: 1 },
    { code: 'const REQUEST_TIMEOUT = 10 * 1000;', errors: 1 },
  ],
});

tester.run('query-data-alias', rules['query-data-alias'], {
  valid: [
    'const { data: todos } = useQuery(options);',
    'const { data: todos, isPending } = useSuspenseQuery(options);',
    'const { data } = useMutation(options);',
    'const { data } = parse(input);',
    'const query = useQuery(options);',
  ],
  invalid: [
    { code: 'const { data } = useQuery(options);', errors: 1 },
    { code: 'const { data, isPending } = useSuspenseQuery(options);', errors: 1 },
    { code: 'const { data } = useInfiniteQuery(options);', errors: 1 },
  ],
});

tester.run('no-return-type-of-hook', rules['no-return-type-of-hook'], {
  valid: [
    'type Result = ReturnType<typeof getValue>;',
    'type Result = Awaited<ReturnType<typeof load>>;',
    'type Hook = typeof useDatePicker;',
  ],
  invalid: [
    { code: 'type Picker = ReturnType<typeof useDatePicker>;', errors: 1 },
    { code: 'function f(picker: ReturnType<typeof useVoiceCaptureSession>) {}', errors: 1 },
  ],
});

tester.run('no-restating-comment', rules['no-restating-comment'], {
  valid: [
    '// 잠금 순서가 바뀌면 교착이 난다\nconst x = 1;',
    '/** 출시 앱 1.14 이하가 이 칸을 필수로 읽는다 */\nconst y = 2;',
    'const email = "user@example.com";',
    '// a - b 비교\nconst z = 3;',
  ],
  invalid: [
    {
      code: '/**\n * 메모를 만든다\n * @param input 입력\n */\nfunction create(input) {}',
      errors: 1,
    },
    { code: '/**\n * @returns 결과\n */\nfunction read() {}', errors: 1 },
    { code: '/**\n * @example\n * create()\n */\nfunction create() {}', errors: 1 },
    { code: '// ========================\nconst a = 1;', errors: 1 },
    { code: '// ─── 조회 ───\nconst b = 1;', errors: 1 },
  ],
});
