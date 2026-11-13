import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';

import { createRuleTester } from '../rule-tester.mjs';
import rules from './routing.mjs';

const tester = createRuleTester();

tester.run('route-params-guard', rules['route-params-guard'], {
  valid: [
    `const route = useRouteParamsOrRedirect(schema, { fallbackHref: '/feed' });
if (route.redirect != null) { return route.redirect; }
return <Screen />;`,
    'const [{ todoId }] = useRouteParams(schema);',
  ],
  invalid: [
    {
      code: `const route = useRouteParamsOrRedirect(schema, { fallbackHref: '/feed' });
const id = route.params.todoId;`,
      errors: 1,
    },
    { code: 'const parsed = schema.safeParse(useLocalSearchParams());', errors: 1 },
  ],
});

tester.run('no-destructured-search-params', rules['no-destructured-search-params'], {
  valid: ['const params = useLocalSearchParams();'],
  invalid: [{ code: 'const { todoId } = useLocalSearchParams();', errors: 1 }],
});

tester.run('route-setter-location', rules['route-setter-location'], {
  valid: [
    'const [{ todoId }] = useRouteParams(schema);',
    'const [params] = useRouteParams(schema);',
    'const [view, setView] = useView(key, schema);',
    'const [sort, setSort] = useTodoCommentSort();',
  ],
  invalid: [
    { code: 'const [{ startVoiceNote }, setParams] = useRouteParams(schema);', errors: 1 },
    { code: 'const [, update] = useRouteParams(schema);', errors: 1 },
    { code: 'const setParams = useRouteParams(schema)[1];', errors: 1 },
  ],
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
    {
      code: "queryOptions<Memo>({ queryKey: [...MEMO_QUERY_KEYS.all, 'detail', { memoId }] });",
      filename: '/repo/apps/mobile/src/features/notes/memo/queries/memo-query-keys.ts',
    },
  ],
  invalid: [
    { code: "useQuery({ queryKey: ['todos', todoId] });", errors: 1 },
    {
      code: "queryOptions<Memo>({ queryKey: [...MEMO_QUERY_KEYS.all, 'detail', { memoId }] });",
      filename: '/repo/apps/mobile/src/features/notes/memo/constants/memo-query-keys.ts',
      errors: 1,
    },
    {
      code: "useQuery({ queryKey: ['memo', 'list'] });",
      filename: '/repo/apps/mobile/src/features/notes/memo/queries/memo.queries.ts',
      errors: 1,
    },
  ],
});

const GLOBAL_FEEDBACK =
  "{ errorFeedback: { feature: 'auth', fallbackKey: 'auth:toasts.linkFailed' } }";
const HANDLED_FEEDBACK =
  "{ errorFeedback: { feature: 'auth', fallbackKey: 'auth:toasts.linkFailed', isHandledByFeature: isLoginCancelledError } }";

tester.run('mutation-error-feedback', rules['mutation-error-feedback'], {
  valid: [
    // 전역 피드백 + 롤백만 하는 onError
    `mutationOptions({
      mutationFn,
      onError: (_error, _variables, context) => rollback(context),
      meta: { errorFeedback: { feature: 'todo', fallbackKey: 'todo:toast.addFailedRetry' } },
    });`,
    // 기능이 뺀 오류는 onError가 조건 아래에서 직접 보인다
    `mutationOptions({
      onError: (error) => {
        if (isLoginCancelledError(error)) {
          haptics.notify('error');
          toast.error(getUserFacingMessage(error));
        }
      },
      meta: ${HANDLED_FEEDBACK},
    });`,
    // 기능이 모든 실패를 직접 보인다
    `mutationOptions({
      onError: (error) => toast.error(getUserFacingMessage(error)),
      meta: { errorFeedback: false },
    });`,
    // 옵션 훅의 결과를 펼치면 그 meta를 이어받는다
    `const updatePreferenceOptions = useUpdatePreferenceMutationOptions();
    mutationOptions({ ...updatePreferenceOptions, onSuccess: askPermission });`,
    'mutationOptions({ ...useUpdatePreferenceMutationOptions(), onSuccess: askPermission });',
    // 같은 파일의 const meta를 따라간다
    `const SILENT = { errorFeedback: false } as const;
    mutationOptions({ mutationFn, meta: SILENT });`,
    // 따라갈 수 없는 meta(import·멤버)는 선언한 것으로 본다
    'mutationOptions({ mutationFn, meta: FEEDBACK.todo });',
    'mutationOptions({ mutationFn, meta: SHARED_META });',
    // 호출부 mutate 콜백은 옵션이 아니다
    'mutation.mutate(values, { onError: (error) => toast.error(getUserFacingMessage(error)) });',
  ],
  invalid: [
    { code: 'mutationOptions({ mutationFn });', errors: 1 },
    { code: 'mutationOptions({ mutationFn, meta: { persist: true } });', errors: 1 },
    { code: 'mutationOptions({ mutationFn, meta: { errorFeedback: undefined } });', errors: 1 },
    // 재시도 옵션처럼 mutation 옵션 훅이 아닌 객체를 펼쳐도 meta는 생기지 않는다
    { code: 'mutationOptions({ ...planInProgressRetryOptions, mutationFn });', errors: 1 },
    {
      code: `const META = { persist: true };
      mutationOptions({ mutationFn, meta: META });`,
      errors: 1,
    },
    // 전역 피드백인데 조건 없이 햅틱·토스트를 더한다
    {
      code: `mutationOptions({ onError: () => { haptics.notify('error'); }, meta: ${GLOBAL_FEEDBACK} });`,
      errors: 1,
    },
    {
      code: `mutationOptions({ onError: () => toast.error(t('auth:toasts.linkFailed')), meta: ${GLOBAL_FEEDBACK} });`,
      errors: 1,
    },
    {
      code: `mutationOptions({
        onError: (error) => {
          haptics.notify('error');
          toast.error(getUserFacingMessage(error), { fallback: t('auth:toasts.linkFailed') });
        },
        meta: ${GLOBAL_FEEDBACK},
      });`,
      errors: 2,
    },
    // 조건 아래라도 isHandledByFeature 없이 기본 문구를 쓰면 겹친다
    {
      code: `mutationOptions({
        onError: (error) => { if (isRetry(error)) { toast.error(getUserFacingMessage(error)); } },
        meta: ${GLOBAL_FEEDBACK},
      });`,
      errors: 1,
    },
    // isHandledByFeature가 있어도 조건 없는 기본 문구 토스트는 모든 오류에 겹친다
    {
      code: `mutationOptions({
        onError: (error) => { toast.error(getUserFacingMessage(error)); },
        meta: ${HANDLED_FEEDBACK},
      });`,
      errors: 1,
    },
    {
      code: "import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';",
      errors: 1,
    },
  ],
});

tester.run('form-shape', rules['form-shape'], {
  valid: ['const form = useForm({ resolver });'],
  invalid: [
    { code: 'const form = useForm<TodoFormValues>({ resolver });', errors: 1 },
    { code: 'const methods = useForm({ resolver });', errors: 1 },
    { code: 'const formMethods = createForm();', errors: 1 },
  ],
});
