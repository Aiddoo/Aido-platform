import { createRuleTester } from '../rule-tester.mjs';
import rules from './naming.mjs';

const tester = createRuleTester();

tester.run('component-name', rules['component-name'], {
  valid: [
    'function TodoRow() {}',
    'const sectionBody = () => null;',
    'TodoList.Item = function Item() { return null; };',
    'const Section = styled(View) as typeof View;',
  ],
  invalid: [
    { code: 'function TodoBody() {}', errors: 1 },
    { code: 'const SettingsSections = memo(() => null);', errors: 1 },
    { code: 'TodoList.Frame = function TodoListFrame() { return null; };', errors: 1 },
    { code: 'const CardWrapper = () => null;', errors: 1 },
  ],
});

tester.run('function-name', rules['function-name'], {
  valid: [
    'function removeTodoFromList() {}',
    'const openFromReentry = () => {};',
    'function toPlan() {}',
  ],
  invalid: [
    { code: 'function sizeOf() {}', errors: 1 },
    { code: 'const getLimitFromError = () => 0;', errors: 1 },
    { code: 'function useTodoFromRoute() {}', errors: 1 },
    { code: 'async function trySave() {}', errors: 1 },
  ],
});

tester.run('predicate-name', rules['predicate-name'], {
  valid: [
    'const canInvite = true;',
    "import { isNotEmpty } from 'lib';",
    'const { isNotDetermined } = permission;',
    'const { hasNoAccess } = response;',
    'function check({ isNotReady }) {}',
    'const status = { isNotDetermined: true };',
  ],
  invalid: [
    { code: 'const isNotReady = false;', errors: 1 },
    { code: 'function hasNoItems() {}', errors: 1 },
    { code: 'function check(isInviteAllowed: boolean) {}', errors: 1 },
    { code: 'type Props = { isEligible: boolean };', errors: 1 },
    { code: 'interface Gate { isNotOpen(): boolean }', errors: 1 },
    { code: 'const state = { hasNoFriends: true };', errors: 1 },
    { code: 'class Gate { isTrialEligible() { return true; } }', errors: 1 },
    { code: 'type Check = (isNotSent: boolean) => void;', errors: 1 },
  ],
});

tester.run('type-name', rules['type-name'], {
  valid: ['type TodoFormValues = { title: string };', 'type TodoParams = { id: string };'],
  invalid: [
    { code: 'type TodoFormInput = { title: string };', errors: 1 },
    {
      code: 'interface UpdateTodoParams { id: string }',
      options: [{ suffixes: ['FormInput', 'Params', 'Args'] }],
      errors: 1,
    },
    {
      code: 'type SaveArgs = { id: string };',
      options: [{ suffixes: ['FormInput', 'Params', 'Args'] }],
      errors: 1,
    },
  ],
});

tester.run('icon-prop-name', rules['icon-prop-name'], {
  valid: [
    'type Props = { Icon: StyledIcon };',
    'type Props = { LeadingIcon?: StyledIcon | null };',
    'type Props = { icon: ReactNode };',
    'type Props = { trailing: ReactNode };',
  ],
  invalid: [
    { code: 'type Props = { icon: StyledIcon };', errors: 1 },
    { code: 'type Props = { leading: typeof CheckIcon };', errors: 1 },
    { code: 'interface Props { badge?: StyledIcon | undefined }', errors: 1 },
  ],
});

tester.run('loading-namespace-name', rules['loading-namespace-name'], {
  valid: ['TodoList.Loading = TodoListLoading;', 'TodoList.Item.Loading = TodoItemLoading;'],
  invalid: [{ code: 'TodoList.ItemSkeleton = TodoItemSkeleton;', errors: 1 }],
});

tester.run('namespace-function-name', rules['namespace-function-name'], {
  valid: [
    'TodoList.Item = function Item() { return null; };',
    'TodoList.Error = function ErrorFallback() { return null; };',
    "import { Header } from './header';\nTodoList.Header = function TodoListHeader() { return null; };",
    'TodoList.Item = () => null;',
  ],
  invalid: [
    { code: 'TodoList.Item = function TodoListItem() { return null; };', errors: 1 },
    { code: 'TodoList.Error = function TodoListError() { return null; };', errors: 1 },
  ],
});
