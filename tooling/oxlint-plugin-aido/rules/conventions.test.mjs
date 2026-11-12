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

tester.run('file-export-name', rules['file-export-name'], {
  valid: [
    {
      code: 'export function useFooBar() {}',
      filename: '/repo/src/features/a/b/hooks/use-foo-bar.ts',
    },
    {
      code: 'export const useFooBar = () => 1;',
      filename: '/repo/src/features/a/b/hooks/use-foo-bar.tsx',
    },
    {
      code: 'export function useTodoId() {}',
      filename: '/repo/src/features/a/b/hooks/use-todo-params.ts',
    },
    {
      code: 'export function FooBar() { return null; }',
      filename: '/repo/src/features/a/b/components/foo-bar.tsx',
    },
    {
      code: 'function FooBar() { return null; }\nexport default FooBar;',
      filename: '/repo/src/features/a/b/components/foo-bar.tsx',
    },
    {
      code: 'export const FooBar = Object.assign(Root, { Item });',
      filename: '/repo/src/features/a/b/components/foo-bar.tsx',
    },
    { code: 'export const x = 1;', filename: '/repo/src/features/a/b/utils/foo-bar.ts' },
    {
      code: 'export const x = 1;',
      filename: '/repo/src/features/a/b/components/foo-bar.test.tsx',
    },
  ],
  invalid: [
    {
      code: 'export function useBarFoo() {}',
      filename: '/repo/src/features/a/b/hooks/use-foo-bar.ts',
      errors: 1,
    },
    {
      code: 'export function Bar() { return null; }',
      filename: '/repo/src/features/a/b/components/foo-bar.tsx',
      errors: 1,
    },
    {
      code: 'const x = 1;',
      filename: '/repo/src/features/a/b/components/foo-bar.tsx',
      errors: 1,
    },
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

tester.run('no-double-nullish', rules['no-double-nullish'], {
  valid: [
    'type Props = { description?: string };',
    'type Props = { trigger: Layout | null };',
    'function f(a?: string) {}',
    'function f(a: string | null) {}',
    {
      code: 'type UpdateTodoRequest = { dueDate?: string | null };',
      options: [{ allowedNames: ['UpdateTodoRequest'] }],
    },
  ],
  invalid: [
    { code: 'type Props = { description?: string | null };', errors: 1 },
    { code: 'interface Props { height: number | null | undefined }', errors: 1 },
    { code: 'function f(a?: string | null) {}', errors: 1 },
    { code: 'const f = (a?: string | null) => a;', errors: 1 },
    {
      code: 'type Options = { until?: Date | null };',
      options: [{ allowedNames: ['UpdateTodoRequest'] }],
      errors: 1,
    },
  ],
});
