import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import { checkMobileConventions } from './check-mobile-conventions.mjs';

function write(root, relativePath, contents) {
  const path = resolve(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function withFixture(files, assertion) {
  const root = mkdtempSync(resolve(tmpdir(), 'aido-mobile-conventions-'));
  try {
    for (const [path, contents] of Object.entries(files)) {
      write(root, path, contents);
    }
    assertion(checkMobileConventions(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('route hook과 옵션 팩토리를 쓰는 댓글 컴포넌트는 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/todo-comment/presentations/components/TodoConversation.tsx': `
        interface TodoConversationProps { className?: string }
        export function TodoConversation({ className }: TodoConversationProps) {
          const { todoId } = useTodoScreenParams();
          return useInfiniteQuery(todoConversationQueryOptions({ todoId, className }));
        }
      `,
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('댓글 식별자를 props로 전달하면 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/todo-comment/presentations/components/TodoConversation.tsx': `
        interface TodoConversationProps { todoId: string; commentId?: string }
        export function TodoConversation(props: TodoConversationProps) { return null }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /todoId/u);
      assert.match(errors.join('\n'), /commentId/u);
    },
  );
});

test('컴포넌트 inline props의 댓글 식별자도 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/todo-comment/presentations/components/TodoConversation.tsx': `
        export function TodoConversation({ todoId }: { todoId: string }) { return null }
        export const ReplyComposer = memo(
          ({ anchorCommentId }: { anchorCommentId: string }) => null,
        );
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /todoId/u);
      assert.match(errors.join('\n'), /anchorCommentId/u);
    },
  );
});

test('todo route 컴포넌트의 inline props 식별자도 거부한다', () => {
  withFixture(
    {
      'apps/mobile/app/(app)/todo/[todoId]/index.tsx': `
        export default function TodoScreen({ focusCommentId }: { focusCommentId: string }) {
          return null;
        }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /focusCommentId/u);
    },
  );
});

test('소문자 헬퍼 인자와 아이템 데이터는 props 식별자로 오탐하지 않는다', () => {
  withFixture(
    {
      'apps/mobile/src/features/todo-comment/presentations/components/TodoConversation.tsx': `
        function getCommentPath({ commentId }: { commentId: string }) {
          return commentId;
        }
        export function TodoConversation({ comment }: { comment: { id: string } }) {
          return getCommentPath({ commentId: comment.id });
        }
      `,
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('중첩 댓글 route와 router push를 거부한다', () => {
  withFixture(
    {
      'apps/mobile/app/(app)/todo/[todoId]/comment/[commentId].tsx':
        'export default function Screen() {}',
      'apps/mobile/src/features/todo-comment/presentations/components/ReplyButton.tsx': `
        export function ReplyButton() { router.push('/comment/1'); return null }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /Stack route/u);
      assert.match(errors.join('\n'), /새 화면을 push/u);
    },
  );
});

test('컴포넌트의 인라인 query 옵션을 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/todo-comment/presentations/components/TodoConversation.tsx': `
        export function TodoConversation() {
          return useInfiniteQuery({ queryKey: ['comments'], queryFn: getComments });
        }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /옵션 팩토리/u);
    },
  );
});

test('todo route의 인라인 query 옵션도 거부한다', () => {
  withFixture(
    {
      'apps/mobile/app/(app)/todo/[todoId]/index.tsx': `
        export default function TodoScreen() {
          return useQuery({ ...todoQueryOptions(), select: getPermission });
        }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /옵션 팩토리/u);
    },
  );
});

test('TodoCheckbox는 HeroUI의 원본 controlled prop 이름을 유지한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/todo/presentations/components/TodoItem.tsx': `
        export function InvalidTodoItem() {
          return <TodoCheckbox isChecked onCheckedChange={() => undefined} />;
        }
        export function ValidTodoItem() {
          return <TodoCheckbox isSelected onSelectedChange={() => undefined} />;
        }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /isSelected\/onSelectedChange/u);
    },
  );
});

test('댓글 feature의 re-export를 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/todo-comment/presentations/hooks/use-comment-form.ts': `
        export { useTodoCommentForm as useCommentForm } from '../providers/todo-comment-form-provider';
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /다시 export/u);
      assert.match(errors[0], /직접 import/u);
    },
  );
});

test('가져온 값을 다시 export하는 우회도 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/todo-comment/presentations/components/index.ts': `
        import DefaultComposer from './DefaultComposer';
        import { TodoConversation as Conversation } from './TodoConversation';

        export { Conversation };
        export default DefaultComposer;
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /Conversation/u);
      assert.match(errors.join('\n'), /DefaultComposer/u);
    },
  );
});

test('같은 파일이 소유한 값의 export는 허용한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/todo-comment/presentations/components/comment-spacing.ts': `
        const COMMENT_SPACING = 12;
        export { COMMENT_SPACING };
      `,
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('댓글 컴포넌트와 hook의 테스트 파일을 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/todo-comment/presentations/components/ReplyButton.test.tsx':
        "test('답글 버튼을 누른다', () => {});",
      'apps/mobile/src/features/todo-comment/presentations/hooks/use-comment-route-state.test.ts':
        "test('route hook을 연결한다', () => {});",
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /model, service\/mapper, pure navigation\/util\/view-model/u);
    },
  );
});

test('댓글 model, service, pure navigation, util과 view-model 테스트는 허용한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/todo-comment/models/todo-comment.model.test.ts':
        "test('policy를 계산한다', () => {});",
      'apps/mobile/src/features/todo-comment/services/todo-comment.service.test.ts':
        "test('계약을 검증한다', () => {});",
      'apps/mobile/src/features/todo-comment/presentations/navigation/todo-comment-route.test.ts':
        "test('URL 상태를 정규화한다', () => {});",
      'apps/mobile/src/features/todo-comment/presentations/utils/comment-position.test.ts':
        "test('위치를 계산한다', () => {});",
      'apps/mobile/src/features/todo-comment/presentations/view-models/comment.view-model.test.ts':
        "test('화면 데이터를 만든다', () => {});",
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('utils 폴더로 옮긴 TSX와 React Native UI 테스트도 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/todo-comment/presentations/utils/FakeComponent.test.tsx': `
        import { render } from '@testing-library/react-native';
        test('컴포넌트를 렌더한다', () => render(<FakeComponent />));
      `,
      'apps/mobile/src/features/todo-comment/presentations/utils/fake-hook.test.ts': `
        import { renderHook } from '@testing-library/react-native';
        test('hook을 연결한다', () => renderHook(useFakeHook));
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /React Native UI 배선/u);
    },
  );
});
