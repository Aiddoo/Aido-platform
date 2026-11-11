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
      options: [{ allowRenderUi: true }],
    },
    {
      code: "import { renderScreenWithDi } from '@src/testing/core';",
      options: [{ allowRenderUi: true }],
    },
  ],
  invalid: [
    { code: "import { renderScreen } from '@src/testing/render';", errors: 1 },
    {
      code: "import { render } from '@testing-library/react-native';",
      options: [{ allowRenderUi: true }],
      errors: 1,
    },
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
