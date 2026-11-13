import { createRuleTester } from '../rule-tester.mjs';
import rules from './testing.mjs';

const tester = createRuleTester();

tester.run('no-jest-module-mock', rules['no-jest-module-mock'], {
  valid: [
    "jest.fn();\njest.spyOn(service, 'save');",
    { code: "jest.mock('react-native-mmkv');", options: [{ allowPackages: true }] },
  ],
  invalid: [
    { code: "jest.mock('react-native-mmkv');", errors: 1 },
    { code: "jest.doMock('@src/shared/ui');", errors: 1 },
    { code: 'jest.setMock(`./todo.service`, stub);', errors: 1 },
    { code: "jest.mock('@src/core/ports/logger');", options: [{ allowPackages: true }], errors: 1 },
  ],
});

tester.run('todo-comment-test-location', rules['todo-comment-test-location'], {
  valid: [
    {
      code: "import { renderScreen } from '@src/testing/render';",
      options: [{ allowRenderScreen: true }],
    },
  ],
  invalid: [
    { code: "import { renderScreen } from '@src/testing/render';", errors: 1 },
    {
      code: "import { render } from '@testing-library/react-native';",
      options: [{ allowRenderScreen: true }],
      errors: 1,
    },
  ],
});

tester.run('test-spy-target', rules['test-spy-target'], {
  valid: [
    "jest.spyOn(api, 'getTodos');",
    "jest.spyOn(Date.prototype, 'getTimezoneOffset');",
    "jest.spyOn(Keyboard, 'dismiss');",
  ],
  invalid: [
    { code: "jest.spyOn(Date, 'now').mockReturnValue(0);", errors: 1 },
    { code: "jest.spyOn(globalThis.Date, 'now');", errors: 1 },
    { code: "jest.spyOn(AppState, 'addEventListener');", errors: 1 },
    { code: "const invalidate = jest.spyOn(queryClient, 'invalidateQueries');", errors: 1 },
  ],
});

tester.run('no-style-assertion', rules['no-style-assertion'], {
  valid: [
    "expect(screen.getByText('저장')).toBeVisible();",
    "expect(input.props.value).toBe('메모');",
    'const style = useAnimatedStyle(() => ({}));',
  ],
  invalid: [
    { code: 'expect(meter).toHaveStyle({ width: "50%" });', errors: 1 },
    { code: 'expect(stamp).not.toHaveStyle({ flex: 1 });', errors: 1 },
    { code: 'expect(card?.props.style).toMatchObject({ width: 160 });', errors: 1 },
    {
      code: "const style = StyleSheet.flatten(screen.getByTestId('grid').props.style);",
      errors: 2,
    },
  ],
});

tester.run('no-real-sleep', rules['no-real-sleep'], {
  valid: [
    'await jest.advanceTimersByTimeAsync(100);',
    'const pending = new Promise((resolve) => { resolveLater = resolve; });',
    'setTimeout(done, 0);',
  ],
  invalid: [
    { code: 'await new Promise((resolve) => setTimeout(resolve, 10));', errors: 1 },
    { code: 'await act(() => new Promise((resolve) => setTimeout(resolve, 0)));', errors: 1 },
    {
      code: 'function sleep(ms) { return new Promise(function (resolve) { setTimeout(() => resolve(), ms); }); }',
      errors: 1,
    },
    { code: 'await new Promise((resolve) => setImmediate(resolve));', errors: 1 },
  ],
});

tester.run('todo-comment-test-purity', rules['todo-comment-test-purity'], {
  valid: [
    {
      code: "import { TodoCommentPolicy } from './todo-comment.model';",
      filename: 'todo-comment.model.test.ts',
    },
  ],
  invalid: [
    { code: 'const view = 1;', filename: 'todo-comment.model.test.tsx', errors: 1 },
    { code: "import { View } from 'react-native';", filename: 'thread.test.ts', errors: 1 },
    {
      code: "import { useThread } from '../hooks/use-thread';",
      filename: 'thread.test.ts',
      errors: 1,
    },
  ],
});
