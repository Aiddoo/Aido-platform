import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';

import { createRuleTester } from '../rule-tester.mjs';
import rules from './routing.mjs';

const tester = createRuleTester();

tester.run('sheet-route-params', rules['sheet-route-params'], {
  valid: [
    `const parsed = schema.safeParse(params);
if (!parsed.success) { return <Redirect href="/" />; }
return <SheetRouteScreen />;`,
    `const parsed = schema.safeParse(params);
const id = parsed.data;`,
  ],
  invalid: [
    {
      code: `const parsed = schema.safeParse(params);
const id = parsed.data.todoId;
return <SheetRouteScreen />;`,
      errors: 1,
    },
  ],
});

tester.run('no-destructured-search-params', rules['no-destructured-search-params'], {
  valid: ['const params = useLocalSearchParams();'],
  invalid: [{ code: 'const { todoId } = useLocalSearchParams();', errors: 1 }],
});

tester.run('no-router-push', rules['no-router-push'], {
  valid: ['router.replace(href);', 'navigation.push(href);'],
  invalid: [{ code: "router.push('/todo');", errors: 1 }],
});

const root = mkdtempSync(join(tmpdir(), 'aido-my-page-'));
after(() => rmSync(root, { recursive: true, force: true }));
mkdirSync(join(root, 'src/bootstrap/navigation'), { recursive: true });
mkdirSync(join(root, 'src/features/identity/user/components'), { recursive: true });
writeFileSync(
  join(root, 'src/bootstrap/navigation/my-page-menu-pane.tsx'),
  "import { ProfileEditor } from '@src/features/identity/user/components/profile-editor';\n",
);
writeFileSync(join(root, 'src/features/identity/user/components/profile-editor.tsx'), '');

tester.run('my-page-menu-navigation', rules['my-page-menu-navigation'], {
  valid: [
    {
      code: "router.push('/settings');",
      filename: join(root, 'src/features/identity/user/components/other-screen.tsx'),
    },
    {
      code: "navigate('/settings');",
      filename: join(root, 'src/features/identity/user/components/profile-editor.tsx'),
    },
  ],
  invalid: [
    {
      code: "router.replace('/settings');",
      filename: join(root, 'src/features/identity/user/components/profile-editor.tsx'),
      errors: 1,
    },
  ],
});

tester.run('no-inline-query-options', rules['no-inline-query-options'], {
  valid: ['useSuspenseQuery(useGetTodoQueryOptions(todoId));'],
  invalid: [
    { code: 'useQuery({ queryKey, queryFn });', errors: 1 },
    { code: 'ReactQuery.useMutation({ mutationFn });', errors: 1 },
  ],
});

tester.run('query-key-location', rules['query-key-location'], {
  valid: [
    'useQuery({ queryKey: todoQueryKeys.detail(todoId) });',
    "const keys = { queryKey: ['todos'] as const };",
    'const { queryKey: [scope] } = query;',
  ],
  invalid: [{ code: "useQuery({ queryKey: ['todos', todoId] });", errors: 1 }],
});

tester.run('mutation-on-error', rules['mutation-on-error'], {
  valid: [
    'useMutation({ onError: (error) => { haptics.error(); } });',
    'useMutation({ onError: function onError() {} });',
    'useMutation({ onError });',
  ],
  invalid: [{ code: 'useMutation({ onError: showFailure });', errors: 1 }],
});

tester.run('form-shape', rules['form-shape'], {
  valid: ['const form = useForm({ resolver });'],
  invalid: [
    { code: 'const form = useForm<TodoFormValues>({ resolver });', errors: 1 },
    { code: 'const methods = useForm({ resolver });', errors: 1 },
    { code: 'const formMethods = createForm();', errors: 1 },
  ],
});
