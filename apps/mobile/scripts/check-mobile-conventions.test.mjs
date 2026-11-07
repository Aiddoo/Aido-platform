import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import { checkMobileConventions, shrinkAllowlist } from './check-mobile-conventions.mjs';

function write(root, relativePath, contents) {
  const path = resolve(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function withFixture(files, assertion, allowlist) {
  const root = mkdtempSync(resolve(tmpdir(), 'aido-mobile-conventions-'));
  try {
    for (const [path, contents] of Object.entries(files)) {
      write(root, path, contents);
    }
    assertion(checkMobileConventions(root, allowlist));
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
          const [todoId] = useTodoId();
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
        export const ReplyComposer = memo(function ReplyComposer({
          anchorCommentId,
        }: {
          anchorCommentId: string;
        }) {
          return null;
        });
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
      'apps/mobile/src/features/engagement/comment/hooks/use-comment-params.ts': `
        export function useCommentParams() { router.push({ pathname: '/todo/[todoId]/comments/[commentId]' }); }
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
          return useInfiniteQuery({ queryKey: COMMENT_QUERY_KEYS.all, queryFn: getComments });
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
      'apps/mobile/src/features/social/nudge/components/nudge-row.tsx': `
        import { TodoRow } from '../../../planning/todo/components/todo-row';
        import { TODO_QUERY_KEYS } from '@src/features/planning/todo/constants/todo-query-keys';
        import { NudgeRow } from './nudge-row';
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /@src\/features\/planning\/todo/u);
    },
  );
});

test('업무 영역 아래 피처는 영역/피처를 경계로 보고 다른 피처의 상대경로 import를 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/social/nudge/components/nudge-row.tsx': `
        import { FriendRow } from '../../friend/components/friend-row';
        import { TodoRow } from '../../../planning/todo/components/todo-row';
        import { NUDGE_LIMIT } from '../constants/nudge.constants';
      `,
      'apps/mobile/src/features/voice/components/voice-row.tsx': `
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
        import type { QuickPlanResponse } from '@aido/api';
        import { quickPlanResponseSchema } from '@aido/api/contracts/voice';
        import { DAYS_OF_WEEK } from '@aido/api/vocabulary';
        import { ErrorCode } from '@aido/api/errors';
      `,
      'apps/mobile/src/features/voice/apis/voice-plan.mapper.ts': `
        import type { QuickPlanResponse } from '@aido/api';
      `,
      'apps/mobile/src/features/device/widget/domains/widget-snapshot.model.ts': `
        import { friendSchema } from '@aido/api';
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /voice-plan\.model\.ts:2:/u);
      assert.match(errors.join('\n'), /voice-plan\.model\.ts:3:/u);
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

test('feature의 useAnalytics 직접 사용을 거부하고 bootstrap은 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/identity/auth/queries/auth.mutations.ts': `
        import { useAnalytics } from '@src/bootstrap/providers/di-context';
      `,
      'apps/mobile/src/bootstrap/hooks/use-sync-user-identity.ts': `
        import { useAnalytics } from '@src/bootstrap/providers/di-context';
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /auth\.mutations\.ts.*useTrack/u);
    },
  );
});

test('shared/infra와 테스트의 SDK import는 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/shared/infra/clipboard/expo-clipboard-gateway.ts': `
        import * as Clipboard from 'expo-clipboard';
      `,
      'apps/mobile/src/shared/infra/audio/use-audio-part-playlist.ts': `
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

test('es-toolkit/compat import는 거부하고 허용 목록의 파일만 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/planning/todo/components/new-list.tsx': `
        import { times } from 'es-toolkit/compat';
      `,
      'apps/mobile/src/features/voice/apis/voice-note-draft.repository.ts': `
        import { debounce } from 'es-toolkit/compat';
      `,
      'apps/mobile/src/features/planning/todo/components/ok-list.tsx': `
        import { range } from 'es-toolkit';
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /new-list\.tsx.*es-toolkit\/compat 대신/);
    },
  );
});

const ROUTE_FILE = 'apps/mobile/app/(app)/feed/index.tsx';

test('파라미터 훅 밖에서 router.setParams를 부르면 거부한다', () => {
  withFixture(
    {
      [ROUTE_FILE]: `router.setParams({ date: undefined });`,
      'apps/mobile/src/features/planning/todo/components/feed-list-pane.tsx': `router.setParams({ date: undefined });`,
    },
    (errors) => {
      assert.equal(errors.filter((error) => error.includes('router.setParams')).length, 2);
    },
  );
});

test('공용 훅과 파라미터 훅의 router.setParams, 테스트의 호출은 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/shared/hooks/use-route-params.ts': `router.setParams({ date: undefined });`,
      'apps/mobile/src/shared/hooks/use-view.ts': `router.setParams({ view: 'friends' });`,
      'apps/mobile/src/features/notification/hooks/use-notification-params.ts': `router.setParams({});`,
      'apps/mobile/src/features/planning/todo/hooks/use-feed-params.test.tsx': `router.setParams({});`,
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('useLocalSearchParams 결과를 구조 분해하면 거부한다', () => {
  withFixture({ [ROUTE_FILE]: `const { view } = useLocalSearchParams();` }, (errors) => {
    assert.equal(errors.length, 1);
    assert.match(errors[0], /구조 분해/u);
  });
});

test('스키마로 parse한 값의 구조 분해는 통과한다', () => {
  withFixture(
    { [ROUTE_FILE]: `const { view } = viewSchema.parse(useLocalSearchParams());` },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('파라미터 훅 파일에서 z.object를 정의하면 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/notification/hooks/use-notification-params.ts': `const schema = z.object({});`,
      'apps/mobile/src/features/voice/hooks/use-voice-note-params.ts': `const schema = z.object({});`,
    },
    (errors) => {
      assert.equal(errors.filter((error) => error.includes('schemas/')).length, 2);
    },
  );
});

test('파라미터 훅이 아닌 파일의 z.object는 이 규칙에 걸리지 않는다', () => {
  withFixture(
    {
      'apps/mobile/src/features/notification/schemas/notification-params.schema.ts': `const schema = z.object({});`,
      'apps/mobile/src/features/notification/hooks/use-notification-list.ts': `const schema = z.object({});`,
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('Platform.OS는 거부하고 Platform.Version과 EXPO_OS는 통과한다', () => {
  withFixture(
    {
      [ROUTE_FILE]: `const a = Platform.OS === 'ios'; const b = Platform.Version; const c = process.env.EXPO_OS;`,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /EXPO_OS/u);
    },
  );
});

test('react-native의 Image import를 거부하고 공용 Image는 통과한다', () => {
  withFixture(
    {
      [ROUTE_FILE]: `import { Image, View } from 'react-native';`,
      'apps/mobile/src/features/notification/components/a.tsx': `import { Image } from '@src/shared/ui'; import { View } from 'react-native';`,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /shared\/ui/u);
    },
  );
});

const FEED_TODO = 'apps/mobile/src/features/planning/todo/components/todo-row.tsx';
const NUDGE_CARD = 'apps/mobile/src/features/social/nudge/components/nudge-row.tsx';

test('shared가 feature나 bootstrap을 import하면 거부하고 테스트 도구는 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/shared/hooks/use-thing.ts': `
        import type { Todo } from '@src/features/planning/todo/schemas/todo.schema';
        import { useLogger } from '@src/bootstrap/providers/di-context';
      `,
      'apps/mobile/src/shared/__tests__/create-thing.ts': `
        import { TodoService } from '@src/features/planning/todo/apis/todo.service';
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /use-thing\.ts:2/u);
      assert.match(errors.join('\n'), /use-thing\.ts:3/u);
    },
  );
});

test('core가 shared를 import하면 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/core/ports/thing.ts': `
        import type { BusinessError } from '@src/shared/errors/business-error';
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /core는 @src\/shared/u);
    },
  );
});

test('위층 코드 import를 거부하고 타입, 모델, cache는 통과한다', () => {
  withFixture(
    {
      [FEED_TODO]: `
        import { NudgeButton } from '@src/features/social/nudge/components/nudge-button';
        import type { Nudge } from '@src/features/social/nudge/schemas/nudge.schema';
        import { type NudgeReply } from '@src/features/social/nudge/schemas/nudge-reply.schema';
        import { NudgePolicy } from '@src/features/social/nudge/domains/nudge.model';
        import { invalidateNudges } from '@src/features/social/nudge/queries/nudge-cache';
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /todo-row\.tsx:2/u);
      assert.match(errors[0], /위층 social\/nudge/u);
    },
  );
});

test('아래 층과 같은 층의 코드 import는 한 방향이면 통과한다', () => {
  withFixture(
    {
      [NUDGE_CARD]: `
        import { useGetTodoQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
        import { FriendRow } from '@src/features/social/friend/components/friend-row';
      `,
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('서로 import하면 타입만이어도 거부하고 허용 목록에 있으면 통과한다', () => {
  const files = {
    [NUDGE_CARD]: `import type { Friend } from '@src/features/social/friend/schemas/friend.schema';`,
    'apps/mobile/src/features/social/friend/components/friend-row.tsx': `
      import type { Nudge } from '@src/features/social/nudge/schemas/nudge.schema';
    `,
  };
  withFixture(files, (errors) => {
    assert.equal(errors.length, 1);
    assert.match(errors[0], /social\/friend와 social\/nudge가 서로/u);
  });
  withFixture(
    files,
    (errors) => {
      assert.deepEqual(errors, []);
    },
    {
      'feature-bidirectional': {
        entries: { 'social/friend <-> social/nudge': { count: 1, reason: '시험' } },
      },
    },
  );
});

test('층이 정해지지 않은 feature를 import하면 거부한다', () => {
  withFixture(
    {
      [NUDGE_CARD]: `import { thing } from '@src/features/payments/refund/utils/thing';`,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /payments의 층이 정해지지/u);
    },
  );
});

test('금지한 컴포넌트 이름을 거부하고 shared와 소문자 이름은 통과한다', () => {
  withFixture(
    {
      [FEED_TODO]: `
        function TodoBody() { return null; }
        const TileFrame = styled(View);
        TodoCard.Section = function Section() { return null; };
        function WeatherBlocks() { return null; }
        function NoteWrapper() { return null; }
        function toBody() { return null; }
        function TodoCard() { return null; }
      `,
      'apps/mobile/src/shared/ui/card/card.tsx': `function CardBody() { return null; }`,
    },
    (errors) => {
      assert.equal(errors.length, 5);
      for (const name of ['TodoBody', 'TileFrame', 'Section:', 'WeatherBlocks', 'NoteWrapper']) {
        assert.match(errors.join('\n'), new RegExp(name, 'u'));
      }
    },
  );
});

test('Facade의 별칭, 인라인 함수, 모델의 this를 거부하고 같은 이름은 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/notes/memo/domains/memo.model.ts': `
        function isPinned(memo) { return memo.isPinned; }
        function getTitle(memo) { return memo.title; }
        export const MemoPolicy = {
          isPinned,
          getTitle: getTitle,
          getName: getTitle,
          isEmpty: (memo) => memo.title === '',
          count() { return this.isPinned; },
        } as const;
      `,
    },
    (errors) => {
      assert.equal(errors.length, 4);
      assert.match(errors.join('\n'), /별칭\(getName: getTitle\)/u);
      assert.match(errors.join('\n'), /함수를 Facade 안에/u);
      assert.match(errors.join('\n'), /메서드를 Facade 안에/u);
      assert.match(errors.join('\n'), /this/u);
    },
  );
});

test('모듈 수준 화살표를 거부하고 function 선언과 지역 화살표는 통과한다', () => {
  withFixture(
    {
      [FEED_TODO]: `
        export const useThing = () => null;
        const helper = function () {};
        export function useOther() {
          const local = () => null;
          return local;
        }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /todo-row\.tsx:2/u);
      assert.match(errors.join('\n'), /todo-row\.tsx:3/u);
    },
  );
});

test('memo와 forwardRef에 넘긴 화살표 컴포넌트를 거부하고 function 표현식은 통과한다', () => {
  withFixture(
    {
      [FEED_TODO]: `
        export const Card = memo(({ title }) => title);
        export const Row = forwardRef((props, ref) => null);
        export const Cell = memo(function Cell({ title }) {
          return title;
        });
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /todo-row\.tsx:2/u);
      assert.match(errors.join('\n'), /todo-row\.tsx:3/u);
    },
  );
});

test('허용 목록은 파일별 수까지만 허용하고 늘거나 줄면 알린다', () => {
  const files = {
    [FEED_TODO]: `
      export const useThing = () => null;
      export const useOther = () => null;
    `,
  };
  const allowed = (count) => ({
    'module-arrow': { reason: '시험', entries: { [FEED_TODO]: count } },
  });
  withFixture(
    files,
    (errors) => {
      assert.deepEqual(errors, []);
    },
    allowed(2),
  );
  withFixture(
    files,
    (errors) => {
      assert.equal(errors.length, 2);
    },
    allowed(1),
  );
  withFixture(
    files,
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /허용 목록을 줄이세요/u);
    },
    allowed(3),
  );
  withFixture(
    {},
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /이제 없습니다/u);
    },
    allowed(2),
  );
});

test('shrinkAllowlist는 줄어든 수만 반영하고 새 위반은 넣지 않는다', () => {
  // Given
  const allowlist = {
    'module-arrow': {
      reason: '시험',
      entries: { 'a.ts': 3, 'b.ts': 1, 'gone.ts': 2, pair: { count: 1, reason: '이유' } },
    },
  };
  const findings = [
    { rule: 'module-arrow', key: 'a.ts' },
    { rule: 'module-arrow', key: 'b.ts' },
    { rule: 'module-arrow', key: 'b.ts' },
    { rule: 'module-arrow', key: 'new.ts' },
    { rule: 'module-arrow', key: 'pair' },
  ];

  // When
  const shrunk = shrinkAllowlist(findings, allowlist);

  // Then
  assert.deepEqual(shrunk, {
    'module-arrow': {
      reason: '시험',
      entries: { 'a.ts': 1, 'b.ts': 1, pair: { count: 1, reason: '이유' } },
    },
  });
});

test('어댑터 밖 테스트의 모듈 jest.mock을 앱 모듈과 SDK 모두 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/notes/memo/hooks/use-memo.test.tsx': `
        jest.mock('@src/shared/analytics', () => ({}));
        jest.mock('../config/device', () => ({}));
        jest.mock('expo-router', () => ({}));
      `,
    },
    (errors) => {
      assert.equal(errors.length, 3);
      for (const error of errors) {
        assert.match(error, /jest\.mock/u);
      }
    },
  );
});

test('어댑터 테스트는 SDK를 mock할 수 있고 앱 모듈은 mock할 수 없다', () => {
  withFixture(
    {
      'apps/mobile/src/shared/infra/haptics/expo-haptics-gateway.test.ts': `
        jest.mock('expo-haptics', () => ({}));
      `,
      'apps/mobile/src/shared/infra/logger/sentry-logger.test.ts': `
        jest.mock('@src/shared/config/env', () => ({}));
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /sentry-logger\.test\.ts.*@src\/shared\/config\/env/u);
    },
  );
});

test('RN ActivityIndicator와 Alert.alert를 거부한다', () => {
  withFixture(
    {
      'apps/mobile/app/(app)/thing.tsx': `
        import { ActivityIndicator, Alert, View } from 'react-native';
        export function thing() { Alert.alert('제목'); }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /ActivityIndicator/u);
      assert.match(errors.join('\n'), /Alert\.alert/u);
    },
  );
});

test('화면의 역할 비교를 거부하고 모델은 통과한다', () => {
  withFixture(
    {
      'apps/mobile/app/(app)/thing.tsx': `
        export function isAdmin(me) { return me.role === USER_ROLE.ADMIN; }
      `,
      'apps/mobile/src/features/identity/user/domains/user.model.ts': `
        export function isAdmin(user) { return user.role === USER_ROLE.ADMIN; }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /thing\.tsx/u);
    },
  );
});

test('query-keys 밖의 queryKey 배열을 거부하고 키 파일과 테스트는 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/notes/memo/queries/memo.queries.ts': `
        export function useThing() { return { queryKey: ['memos'] }; }
        export function useOther() { return { queryKey: MEMO_QUERY_KEYS.all }; }
      `,
      'apps/mobile/src/features/notes/memo/constants/memo-query-keys.ts': `
        export function memoKey() { return { queryKey: ['memos'] }; }
      `,
      'apps/mobile/src/features/notes/memo/queries/memo.queries.test.ts': `
        const options = { queryKey: ['memos'] };
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /memo\.queries\.ts/u);
    },
  );
});

test('xxxOf 함수 이름을 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/notes/memo/domains/memo.model.ts': `
        export function titleOf(memo) { return memo.title; }
        export function getTitle(memo) { return memo.title; }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /titleOf/u);
    },
  );
});

test('Chip.Label을 거부하고 자식 Text는 허용한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/planning/category/components/bad-chip.tsx': `
        import { Chip } from 'heroui-native';
        export function BadChip() {
          return <Chip><Chip.Label>글자</Chip.Label></Chip>;
        }
      `,
      'apps/mobile/src/features/planning/category/components/good-chip.tsx': `
        import { Chip } from 'heroui-native';
        import { Text } from '@src/shared/ui';
        export function GoodChip() {
          return <Chip><Text size="e1">글자</Text></Chip>;
        }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /bad-chip\.tsx/u);
    },
  );
});

test('Tabs.Label의 날글자를 거부하고 자식 Text는 허용한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/planning/category/components/bad-tab.tsx': `
        import { Tabs } from 'heroui-native';
        export function BadTab({ label }: { label: string }) {
          return <Tabs.Trigger value="a"><Tabs.Label numberOfLines={1}>{label}</Tabs.Label></Tabs.Trigger>;
        }
      `,
      'apps/mobile/src/features/planning/category/components/bad-literal-tab.tsx': `
        import { Tabs } from 'heroui-native';
        export function BadLiteralTab() {
          return <Tabs.Trigger value="a"><Tabs.Label>글자</Tabs.Label></Tabs.Trigger>;
        }
      `,
      'apps/mobile/src/features/planning/category/components/good-tab.tsx': `
        import { Tabs } from 'heroui-native';
        import { Text } from '@src/shared/ui';
        export function GoodTab() {
          return <Tabs.Trigger value="a"><Tabs.Label><Text size="b4">글자</Text></Tabs.Label></Tabs.Trigger>;
        }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /bad-tab\.tsx/u);
      assert.match(errors.join('\n'), /bad-literal-tab\.tsx/u);
    },
  );
});

test('폼 모양을 어긴 import와 변수와 useForm 제네릭을 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/planning/category/components/bad-form.tsx': `
        import { FormProvider, useForm, useFormContext } from 'react-hook-form';
        import { FormField } from '@src/shared/ui';
        export function BadForm() {
          const methods = useForm<Values>();
          return null;
        }
      `,
      'apps/mobile/src/features/planning/category/components/good-form.tsx': `
        import { Controller, useForm } from 'react-hook-form';
        export function GoodForm() {
          const form = useForm({ defaultValues: { title: '' } });
          return null;
        }
      `,
      'apps/mobile/src/features/planning/category/components/good-form.test.tsx': `
        import { FormProvider, useForm } from 'react-hook-form';
        const form = useForm<Values>();
      `,
    },
    (errors) => {
      assert.equal(errors.length, 4);
      assert.ok(errors.every((error) => /bad-form\.tsx/u.test(error)));
    },
  );
});

test('worklet 함수의 매개변수 기본값을 거부하고 호출부가 넘기는 값은 허용한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/voice/utils/bad-worklet.ts': `
        const LIMIT = 3;
        export function append(bars: number[], max: number = LIMIT) {
          'worklet';
          return bars.slice(-max);
        }
        export const arrow = (value = LIMIT) => {
          'worklet';
          return value;
        };
        export function destructured({ gap = LIMIT }: { gap?: number }) {
          'worklet';
          return gap;
        }
      `,
      'apps/mobile/src/features/voice/utils/good-worklet.ts': `
        export function append(bars: number[], max: number) {
          'worklet';
          return bars.slice(-max);
        }
        export function plain(value = 3) {
          return value;
        }
      `,
    },
    (errors) => {
      const messages = errors.filter((error) => /매개변수 기본값/u.test(error));
      assert.equal(messages.length, 3);
      assert.match(messages.join('\n'), /bad-worklet/u);
    },
  );
});

test('자기 피처를 @src/features 절대 경로로 import하면 막는다', () => {
  withFixture(
    {
      'apps/mobile/src/features/weather/components/a.tsx': `
        import { b } from '@src/features/weather/utils/b';
        import { c } from '@src/features/planning/todo/utils/c';
        export const a = [b, c];
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /자기 피처\(weather\)/u);
    },
  );
});

test('*.error.ts 밖에서 isApiError와 hasCode를 직접 쓰면 막는다', () => {
  withFixture(
    {
      'apps/mobile/src/features/weather/queries/a.ts': `
        import { isApiError } from '@src/shared/errors';
        export function read(error: unknown) {
          return isApiError(error) && error.hasCode('X');
        }
      `,
      'apps/mobile/src/features/weather/domains/weather.error.ts': `
        import { isApiError } from '@src/shared/errors';
        export function isX(error: unknown) {
          return isApiError(error) && error.hasCode('X');
        }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.ok(errors.every((error) => /queries\/a\.ts/u.test(error)));
    },
  );
});

test('이름이 -card인 컴포넌트는 heroui Card를 써야 한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/weather/components/ok-card.tsx': `
        import { Card } from 'heroui-native';
        export function OkCard() { return <Card />; }
      `,
      'apps/mobile/src/features/weather/components/bad-card.tsx': `
        import { View } from 'react-native';
        export function BadCard() { return <View />; }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /bad-card\.tsx/u);
    },
  );
});

test('shared/ui 밖에서는 공용 부품과 같은 이름을 heroui-native에서 가져오지 못한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/weather/components/ok.tsx': `
        import { Button } from '@src/shared/ui';
        import { Skeleton } from 'heroui-native';
        export function Ok() { return <Button><Skeleton /></Button>; }
      `,
      'apps/mobile/src/features/weather/components/bad.tsx': `
        import { Button as HeroButton, Menu } from 'heroui-native';
        export function Bad() { return <HeroButton><Menu /></HeroButton>; }
      `,
      'apps/mobile/src/shared/ui/button/button.tsx': `
        import { Button as HeroButton } from 'heroui-native';
        export function Button() { return <HeroButton />; }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /bad\.tsx/u);
    },
  );
});
