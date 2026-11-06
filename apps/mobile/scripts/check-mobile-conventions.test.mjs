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
      'apps/mobile/src/features/engagement/comment/components/TodoConversation.tsx': `
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
      'apps/mobile/src/features/engagement/comment/components/TodoConversation.tsx': `
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
      'apps/mobile/src/features/engagement/comment/components/TodoConversation.tsx': `
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
      'apps/mobile/src/features/engagement/comment/components/TodoConversation.tsx': `
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

test('대화 아래 중첩 댓글 route와 컴포넌트의 router push를 거부한다', () => {
  withFixture(
    {
      'apps/mobile/app/(app)/todo/[todoId]/comments/[commentId]/replies.tsx':
        'export default function Screen() {}',
      'apps/mobile/src/features/engagement/comment/components/ReplyButton.tsx': `
        export function ReplyButton() { router.push('/comment/1'); return null }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /Stack route/u);
      assert.match(errors.join('\n'), /직접 push하지 않습니다/u);
    },
  );
});

test('개요에서 대화로 가는 한 단계 route, 대화 위 신고 시트와 전이 resolver의 push는 통과한다', () => {
  withFixture(
    {
      'apps/mobile/app/(app)/todo/[todoId]/comments/[commentId].tsx':
        'export default function Screen() { return null }',
      'apps/mobile/app/(app)/todo/[todoId]/comments/[commentId]/report.tsx':
        'export default function ReportSheet() { return null }',
      'apps/mobile/src/features/engagement/comment/hooks/use-todo-comment-route.ts': `
        export function useTodoCommentRoute() { router.push({ pathname: '/todo/[todoId]/comments/[commentId]' }); }
      `,
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('컴포넌트의 인라인 query 옵션을 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/engagement/comment/components/TodoConversation.tsx': `
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
      'apps/mobile/src/features/planning/todo/components/TodoItem.tsx': `
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
      'apps/mobile/src/features/engagement/comment/hooks/use-comment-form.ts': `
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
      'apps/mobile/src/features/engagement/comment/components/index.ts': `
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
      'apps/mobile/src/features/engagement/comment/components/comment-spacing.ts': `
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
      'apps/mobile/src/features/engagement/comment/components/ReplyButton.test.tsx':
        "test('답글 버튼을 누른다', () => {});",
      'apps/mobile/src/features/engagement/comment/hooks/use-comment-route-state.test.ts':
        "test('route hook을 연결한다', () => {});",
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /model, service\/mapper, pure navigation\/util\/view-model/u);
    },
  );
});

test('공용 renderUi로 그리는 댓글 컴포넌트 테스트는 허용한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/engagement/comment/components/todo-comment-replies.test.tsx': `
        import { renderUi } from '@src/shared/__tests__/render-ui';
        test('답글을 올려도 숨기기를 보이지 않는다', async () => {});
      `,
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('댓글 model, service, pure navigation, util과 view-model 테스트는 허용한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/engagement/comment/domains/todo-comment.model.test.ts':
        "test('policy를 계산한다', () => {});",
      'apps/mobile/src/features/engagement/comment/apis/todo-comment.service.test.ts':
        "test('계약을 검증한다', () => {});",
      'apps/mobile/src/features/engagement/comment/utils/navigation/todo-comment-route.test.ts':
        "test('URL 상태를 정규화한다', () => {});",
      'apps/mobile/src/features/engagement/comment/utils/comment-position.test.ts':
        "test('위치를 계산한다', () => {});",
      'apps/mobile/src/features/engagement/comment/utils/view-models/comment.view-model.test.ts':
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
      'apps/mobile/src/features/engagement/comment/utils/FakeComponent.test.tsx': `
        import { render } from '@testing-library/react-native';
        test('컴포넌트를 렌더한다', () => render(<FakeComponent />));
      `,
      'apps/mobile/src/features/engagement/comment/utils/fake-hook.test.ts': `
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

test('다른 피처를 상대경로로 import하면 거부하고 절대경로는 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/planning/todo/components/todo-detail-card.tsx': `
        import { TodoNudgeButton } from '../../../social/nudge/components/todo-nudge-button';
        import { NUDGE_QUERY_KEYS } from '@src/features/social/nudge/constants/nudge-query-keys';
        import { TodoRow } from './todo-row';
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /@src\/features\/social\/nudge/u);
    },
  );
});

test('업무 영역 아래 피처는 영역/피처를 경계로 보고 다른 피처의 상대경로 import를 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/social/nudge/components/nudge-card.tsx': `
        import { FriendRow } from '../../friend/components/friend-row';
        import { TodoRow } from '../../../planning/todo/components/todo-row';
        import { NUDGE_LIMIT } from '../constants/nudge.constants';
      `,
      'apps/mobile/src/features/voice/components/voice-card.tsx': `
        import { VoiceIcon } from './voice-icon';
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /@src\/features\/social\/friend/u);
      assert.match(errors.join('\n'), /@src\/features\/planning\/todo/u);
    },
  );
});

test('서버·모바일·공용 패키지의 엄격한 null·undefined 비교를 거부한다', () => {
  withFixture(
    {
      'apps/api/src/modules/memo/get-memo.use-case.ts': `
        if (memo === null) { throw new Error('없음'); }
      `,
      'apps/mobile/app/(app)/memo.tsx': `
        const hasMemo = memo !== undefined;
      `,
      'packages/api/src/contracts/memo.ts': `
        export const isEmpty = (value) => null === value;
      `,
      'apps/api/test/e2e/memo.e2e-spec.ts': `
        if (memo === null) { throw new Error('테스트 디렉터리는 검사하지 않는다'); }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 3);
      assert.match(errors.join('\n'), /get-memo\.use-case\.ts/u);
      assert.match(errors.join('\n'), /memo\.tsx/u);
      assert.match(errors.join('\n'), /packages\/api\/src\/contracts\/memo\.ts/u);
    },
  );
});

test('== null 판단과 이유를 남긴 엄격한 비교는 통과한다', () => {
  withFixture(
    {
      'apps/api/src/modules/todo/update-todo.ts': `
        if (memo == null) { return; }
        const status = todo.status === 'DONE';
        // nullish-strict: PATCH라 undefined는 유지, null은 비우기다
        if (input.memo === undefined) { keep(); }
        const patch = {
          // nullish-strict: PATCH라 undefined는 유지, null은 비우기다
          ...(input.name !== undefined && { name: input.name }),
          ...(input.image !== undefined && { image: input.image }),
        };
        const cached = map.get(key); if (cached !== undefined) { use(cached); } // nullish-strict: 저장된 null과 미존재를 구분한다
      `,
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('허용 표시는 바로 위 문장에만 적용된다', () => {
  withFixture(
    {
      'apps/mobile/src/features/planning/todo/utils/todo-memo.ts': `
        // nullish-strict: PATCH라 undefined는 유지, null은 비우기다
        const isOmitted = input.memo === undefined;
        const isEmpty = input.memo === null;
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /todo-memo\.ts:4:/u);
    },
  );
});

test('테스트에서 new QueryClient를 직접 만들면 거부하고 공통 팩토리는 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/planning/todo/queries/todo-cache.test.ts': `
        import { QueryClient } from '@tanstack/react-query';
        const client = new QueryClient();
      `,
      'apps/mobile/src/shared/__tests__/query-client.ts': `
        import { QueryClient } from '@tanstack/react-query';
        export const createTestQueryClient = () => new QueryClient();
      `,
      'apps/mobile/src/bootstrap/providers/query-provider.tsx': `
        import { QueryClient } from '@tanstack/react-query';
        const queryClient = new QueryClient();
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /todo-cache\.test\.ts/u);
      assert.match(errors[0], /createTestQueryClient/u);
    },
  );
});

test('옮긴 클라이언트 모델이 요청·응답 계약을 import하면 거부하고 vocabulary·errors·mapper는 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/voice/domains/voice-plan.model.ts': `
        import { z } from 'zod';
        import type { QuickPlanResponse } from '@aido/api';
        import { quickPlanResponseSchema } from '@aido/api/contracts/voice';
        import { DAYS_OF_WEEK } from '@aido/api/vocabulary';
        import { ErrorCode } from '@aido/api/errors';
      `,
      'apps/mobile/src/features/voice/apis/voice-plan.mapper.ts': `
        import type { QuickPlanResponse } from '@aido/api';
      `,
      'apps/mobile/src/features/identity/preference/domains/preference.model.ts': `
        import { preferenceSchema } from '@aido/api';
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /voice-plan\.model\.ts:3:/u);
      assert.match(errors.join('\n'), /voice-plan\.model\.ts:4:/u);
    },
  );
});

test('앱 Hermes에 없는 toSorted와 Array.fromAsync는 src와 app 모두에서 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/planning/todo/domains/sorted.ts': `
        export const sorted = [3, 1].toSorted();
        export const collected = Array.fromAsync(source());
      `,
      'apps/mobile/app/(app)/index.tsx': `
        export const dates = dates.toSorted((a, b) => a - b);
      `,
    },
    (errors) => {
      assert.equal(errors.length, 3);
      assert.ok(errors.every((error) => error.includes('Hermes')));
    },
  );
});

test('Hermes에 있는 toReversed와 다른 객체의 fromAsync는 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/planning/todo/domains/reversed.ts': `
        export const reversed = [3, 1].toReversed();
        export const last = [3, 1].findLastIndex((value) => value === 1);
        export const other = stream.fromAsync(source());
      `,
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('SDK를 shared/infra 밖에서 import하면 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/planning/todo/hooks/use-new-feature.ts': `
        import * as Clipboard from 'expo-clipboard';
        export const copy = Clipboard.setStringAsync;
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /expo-clipboard는 shared\/infra에서만/);
    },
  );
});

test('shared/infra와 허용된 경계 훅, 테스트의 SDK import는 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/shared/infra/clipboard/expo-clipboard.gateway.ts': `
        import * as Clipboard from 'expo-clipboard';
      `,
      'apps/mobile/src/features/voice/hooks/use-voice-note-player.ts': `
        import { useAudioPlaylist } from 'expo-audio';
      `,
      'apps/mobile/src/features/planning/todo/hooks/use-new-feature.test.ts': `
        import * as Clipboard from 'expo-clipboard';
      `,
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});
