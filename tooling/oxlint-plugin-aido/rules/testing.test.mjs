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

tester.run('test-gwt-comments', rules['test-gwt-comments'], {
  valid: [
    "it('저장한다', () => {\n  // Given\n  const a = 1;\n\n  // When\n  const b = a + 1;\n\n  // Then\n  expect(b).toBe(2);\n});",
    "it('준비가 없으면 Given을 생략한다', async () => {\n  // When\n  const b = await run();\n\n  // Then\n  expect(b).toBe(2);\n});",
    "it.each([1, 2])('%s', (value) => {\n  // When\n  const b = value + 1;\n\n  // Then\n  expect(b).toBeGreaterThan(1);\n});",
    "test.each`\n  a\n  ${1}\n`('$a', ({ a }) => {\n  // When\n  const b = a;\n  // Then\n  expect(b).toBe(1);\n});",
    "describe('모듈', () => {\n  // 공통 준비\n  beforeEach(() => {});\n});",
    "it.todo('나중에 쓴다');",
    "it('설명 주석은 둔다', () => {\n  // 시계를 고정한다\n  // When\n  run();\n  // Then\n  expect(1).toBe(1);\n});",
  ],
  invalid: [
    { code: "it('합본', () => {\n  // When / Then\n  expect(run()).toBe(1);\n});", errors: 1 },
    {
      code: "it('합본 가운뎃점', () => {\n  // When·Then\n  expect(run()).toBe(1);\n});",
      errors: 1,
    },
    {
      code: "it('꼬리 설명', () => {\n  // When\n  run();\n  // Then 저장된다\n  expect(1).toBe(1);\n});",
      errors: 1,
    },
    { code: "it('주석 없음', () => {\n  expect(run()).toBe(1);\n});", errors: 1 },
    { code: "it.each([1])('Then 빠짐', (value) => {\n  // When\n  run(value);\n});", errors: 1 },
  ],
});
