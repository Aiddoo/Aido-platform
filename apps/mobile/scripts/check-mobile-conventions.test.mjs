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
      'apps/mobile/src/features/engagement/comment/hooks/use-todo-comment-params.ts': `
        export function useTodoCommentParams() { router.push({ pathname: '/todo/[todoId]/comments/[commentId]' }); }
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
      'apps/mobile/src/features/engagement/comment/components/todo-comment-list.test.tsx': `
        import { createHttpClientStub, renderUi } from '@src/shared/__tests__';
        test('목록을 그린다', async () => {});
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

test('모든 클라이언트 도메인 모델이 요청·응답 계약을 import하면 거부하고 vocabulary·errors·mapper는 통과한다', () => {
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
      assert.equal(errors.length, 3);
      assert.match(errors.join('\n'), /voice-plan\.model\.ts:2:/u);
      assert.match(errors.join('\n'), /voice-plan\.model\.ts:3:/u);
      assert.match(errors.join('\n'), /widget-snapshot\.model\.ts:2:/u);
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

test('react-native-view-shot을 shared/infra 밖에서 import하면 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/insights/achievement/components/new-summary.tsx': `
        import ViewShot from 'react-native-view-shot';
      `,
      'apps/mobile/src/shared/infra/view-capture/capturable-view.tsx': `
        import ViewShot from 'react-native-view-shot';
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /react-native-view-shot는 shared\/infra에서만/);
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

test('mutation onError에 실패 처리 함수를 넘기면 거부하고 인라인 처리는 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/identity/auth/queries/auth.mutations.ts': `
        export function useLoginMutationOptions() {
          const showFailure = useSocialLoginFailure();
          return mutationOptions({ onError: showFailure });
        }
        export function useLinkMutationOptions() {
          return mutationOptions({ onError: createFailureHandler() });
        }
        export function useUnlinkMutationOptions() {
          return mutationOptions({
            onError: (error) => {
              haptics.notify('error');
              toast.error(getUserFacingMessage(error));
            },
          });
        }
      `,
      'apps/mobile/src/features/identity/auth/components/link-button.tsx': `
        export function LinkButton() {
          return link.mutate(undefined, { onError: reportFailure });
        }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.ok(errors.every((error) => /auth\.mutations\.ts.*햅틱·토스트/u.test(error)));
    },
  );
});

test('캐시 helper의 이벤트 발행·오류 보고·Service import를 거부하고 캐시 import는 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/social/moderation/queries/moderation-cache.ts': `
        import { emitNotificationsChanged } from '@src/core/events/notifications-changed';
        import type { ErrorReporter } from '@src/core/ports/error-reporter';
        import { invalidateFriends } from '@src/features/social/friend/queries/friend-cache';
      `,
      'apps/mobile/src/features/device/activation/queries/activation-cache.ts': `
        import type { ActivationService } from '../apis/activation.service';
        import { ACTIVATION_QUERY_KEYS } from '../constants/activation-query-keys';
      `,
      'apps/mobile/src/features/social/moderation/queries/moderation.mutations.ts': `
        import { emitNotificationsChanged } from '@src/core/events/notifications-changed';
      `,
    },
    (errors) => {
      assert.equal(errors.length, 3);
      assert.ok(errors.every((error) => /-cache\.ts.*Query 캐시만/u.test(error)));
    },
  );
});

test('feature와 화면이 기기 저장소를 직접 읽으면 거부하고 shared Provider는 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/planning/todo/hooks/use-calendar-view-mode.ts': `
        import { useSyncStorageString } from '@src/shared/hooks/use-sync-storage-string';
      `,
      'apps/mobile/app/(app)/settings.tsx': `
        import { useSyncStorageString } from '@src/shared/hooks/use-sync-storage-string';
      `,
      'apps/mobile/src/shared/providers/theme-provider.tsx': `
        import { useSyncStorageString } from '@src/shared/hooks/use-sync-storage-string';
      `,
      'apps/mobile/src/features/planning/todo/hooks/use-calendar-view-mode.test.ts': `
        import { useSyncStorageString } from '@src/shared/hooks/use-sync-storage-string';
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /use-calendar-view-mode\.ts.*useSyncStorageString로/u);
      assert.match(errors.join('\n'), /settings\.tsx.*useSyncStorageString로/u);
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

test('시트 route가 검증한 값을 꺼내 시트에 넘기면 거부한다', () => {
  withFixture(
    {
      'apps/mobile/app/(app)/users/[userId]/report.tsx': `
        const params = userReportParamsSchema.safeParse(useLocalSearchParams());
        if (!params.success) {
          return <Redirect href="/feed" />;
        }
        const { userId } = params.data;
        return <SheetRouteScreen><ReportSheet userId={userId} /></SheetRouteScreen>;
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /시트 route는 safeParse로 검증하고 Redirect만/u);
    },
  );
});

test('검증과 Redirect만 하는 시트 route와 시트가 아닌 화면의 safeParse 값은 통과한다', () => {
  withFixture(
    {
      'apps/mobile/app/(app)/users/[userId]/block.tsx': `
        const params = blockUserParamsSchema.safeParse(useLocalSearchParams());
        if (!params.success) {
          return <Redirect href="/feed" />;
        }
        return <SheetRouteScreen><BlockUserConfirmDialog /></SheetRouteScreen>;
      `,
      'apps/mobile/app/(app)/invite/[code].tsx': `
        const params = inviteParamsSchema.safeParse(useLocalSearchParams());
        return <InviteScreen code={params.data.code} />;
      `,
    },
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

test('Policy 멤버의 첫 인자가 모델 일부면 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/notes/memo/domains/memo.model.ts': `
        type MemoTitle = Pick<Memo, 'title'>;
        function byPick(memo: Pick<Memo, 'content'>) { return memo.content; }
        function byPartial(memo: Partial<Memo>) { return memo.content; }
        function byOmit(memo: Omit<Memo, 'id'>) { return memo.content; }
        function byLiteral(memo: { content: string }) { return memo.content; }
        function byDestructuredLiteral({ content }: { content: string }) { return content; }
        function byIntersection(memo: Pick<Memo, 'id'> & { content: string }) { return memo.id; }
        function byField(content: Memo['content']) { return content; }
        function byAlias(memo: MemoTitle) { return memo.title; }
        function byPickList(memos: readonly Pick<Memo, 'id'>[]) { return memos.length; }
        function byNullablePick(memo: Pick<Memo, 'id'> | null) { return memo?.id; }
        function byConstraint<T extends Pick<Memo, 'id'>>(memo: T) { return memo.id; }
        function byTuple(memos: readonly [Pick<Memo, 'id'>, ...Pick<Memo, 'id'>[]]) { return memos; }
        export const MemoPolicy = {
          byPick,
          byPartial,
          byOmit,
          byLiteral,
          byDestructuredLiteral,
          byIntersection,
          byField,
          byAlias,
          byPickList,
          byNullablePick,
          byConstraint,
          byTuple,
        } as const;
      `,
    },
    (errors) => {
      assert.equal(errors.length, 12);
      for (const [name, fragment] of [
        ['byPick', 'Pick<…>'],
        ['byPartial', 'Partial<…>'],
        ['byOmit', 'Omit<…>'],
        ['byLiteral', '객체 리터럴 타입'],
        ['byDestructuredLiteral', '객체 리터럴 타입'],
        ['byIntersection', '교차 타입'],
        ['byField', '모델 필드 타입'],
        ['byAlias', 'MemoTitle(Pick<…>)'],
        ['byPickList', 'Pick<…>'],
        ['byNullablePick', 'Pick<…>'],
        ['byConstraint', 'Pick<…>'],
        ['byTuple', 'Pick<…>'],
      ]) {
        assert.ok(
          errors.some((error) =>
            error.includes(`MemoPolicy.${name}: 첫 인자가 모델 일부(${fragment})`),
          ),
          name,
        );
      }
    },
  );
});

test('모델 전체·모델 목록·상태 유니온·값·인자 없는 Policy 멤버는 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/notes/memo/domains/memo.model.ts': `
        import { z } from 'zod';
        const memoSchema = z.object({ id: z.int(), content: z.string() });
        type Memo = z.infer<typeof memoSchema>;
        type MemoEditorState = { status: 'idle' } | { status: 'editing'; draft: string };
        function hasContentChanged(memo: Memo, content: string) { return memo.content !== content; }
        function canReorder(memos: readonly Memo[]) { return memos.length > 1; }
        function findMemo<T extends Memo>(memos: readonly T[], id: number) { return memos.find((memo) => memo.id === id) ?? null; }
        function findLatest(memos: readonly [Memo, ...Memo[]]) { return memos[0]; }
        function isPinned(memo: Memo | null) { return memo != null; }
        function isEditing(state: MemoEditorState) { return state.status === 'editing'; }
        function isBlank(content: string) { return content.trim() === ''; }
        function createEmptyState(): MemoEditorState { return { status: 'idle' }; }
        export function toPreview(memo: Pick<Memo, 'content'>) { return memo.content; }
        export const MemoPolicy = {
          hasContentChanged,
          canReorder,
          findMemo,
          findLatest,
          isPinned,
          isEditing,
          isBlank,
          createEmptyState,
        } as const;
      `,
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('도메인 모델은 계약·문구·화면 부품·플랫폼·React를 import하지 않고 용어와 오류 코드는 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/shared/domains/window-layout.model.ts': `
        import { Platform } from 'react-native';
        import { useMemo } from 'react';
        import { memoSchema } from '@aido/api/contracts/memo';
        export const WindowLayoutPolicy = {} as const;
      `,
      'apps/mobile/src/features/notes/memo/domains/memo.model.ts': `
        import { MEMO_LIMITS } from '@aido/api/vocabulary';
        import { ErrorCode } from '@aido/api/errors';
        import { useTranslation } from '@src/shared/i18n';
        import { VALIDATION_MESSAGES } from '@src/shared/i18n/validation-message';
        import { Trans } from 'react-i18next';
        import i18next from 'i18next';
        import { Text } from '@src/shared/ui';
        import { BottomSheet } from '@src/shared/ui/bottom-sheet';
        import type { ReactNode } from 'react';
        export const MemoPolicy = {} as const;
      `,
      'apps/mobile/src/features/notes/memo/components/memo-row.tsx': `
        import { useMemo } from 'react';
        import { View } from 'react-native';
        import { useTranslation } from '@src/shared/i18n';
        import { Text } from '@src/shared/ui';
        export function MemoRow() { return null; }
      `,
      'apps/mobile/src/features/notes/memo/domains/memo.model.test.ts': `
        import { render } from '@testing-library/react-native';
        import { Text } from '@src/shared/ui';
      `,
    },
    (errors) => {
      assert.equal(errors.length, 10);
      const joined = errors.join('\n');
      assert.match(joined, /window-layout\.model\.ts:2:\d+ 도메인 모델은 플랫폼\(react-native\)/u);
      assert.match(joined, /window-layout\.model\.ts:3:\d+ 도메인 모델은 React\(react\)/u);
      assert.match(joined, /window-layout\.model\.ts:4:\d+ 클라이언트 모델은 요청·응답 계약/u);
      assert.match(
        joined,
        /memo\.model\.ts:4:\d+ 도메인 모델은 문구\(i18n\)\(@src\/shared\/i18n\)/u,
      );
      assert.match(joined, /memo\.model\.ts:5:\d+ 도메인 모델은 문구\(i18n\)/u);
      assert.match(joined, /memo\.model\.ts:6:\d+ 도메인 모델은 문구\(i18n\)\(react-i18next\)/u);
      assert.match(joined, /memo\.model\.ts:7:\d+ 도메인 모델은 문구\(i18n\)\(i18next\)/u);
      assert.match(joined, /memo\.model\.ts:8:\d+ 도메인 모델은 화면 부품\(shared\/ui\)/u);
      assert.match(joined, /memo\.model\.ts:9:\d+ 도메인 모델은 화면 부품\(shared\/ui\)/u);
      assert.match(joined, /memo\.model\.ts:10:\d+ 도메인 모델은 React\(react\)/u);
      // 2·3번 줄의 용어(vocabulary)와 오류 코드(errors)는 모델도 쓴다
      assert.doesNotMatch(joined, /memo-row\.tsx|memo\.model\.test\.ts|memo\.model\.ts:[23]:/u);
    },
  );
});

test('모델 파일은 모델 스키마·타입·순수 함수·Policy를 내보내고 상수와 계약 import는 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/notes/memo/domains/memo.model.ts': `
        import { z } from 'zod';
        import { memoSchema as memoContractSchema } from '@aido/api';
        export const memoSchema = z.object({ id: z.int(), isPinned: z.boolean() });
        export function isPinned(memo) { return memo.isPinned; }
        function getTitle(memo) { return memo.title; }
        export type MemoTitle = string;
        export const MEMO_PREVIEW_LINES = 2;
        export const MemoPolicy = { isPinned, getTitle } as const;
      `,
      'apps/mobile/src/features/notes/memo/domains/memo.error.ts': `
        export function isMemoError(error) { return error != null; }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors.join('\n'), /MEMO_PREVIEW_LINES: 모델 파일은 클라이언트 모델 스키마/u);
      assert.match(
        errors.join('\n'),
        /클라이언트 모델은 요청·응답 계약\(@aido\/api\)을 import하지 않습니다/u,
      );
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
        function isAdmin(user) { return user.role === USER_ROLE.ADMIN; }
        export const UserPolicy = { isAdmin };
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
        function titleOf(memo) { return memo.title; }
        function getTitle(memo) { return memo.title; }
        export const MemoPolicy = { titleOf, getTitle };
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /titleOf/u);
    },
  );
});

test('출처를 붙인 xxxFrom과 tryX 함수 이름을 거부하고 빼는 곳을 말하는 이름은 둔다', () => {
  withFixture(
    {
      'apps/mobile/src/features/social/friend/domains/friend.error.ts': `
        export function getFriendLimitFromError(error) { return null; }
        export function tryUnlock() { return true; }
        export function findFriendLimit(error) { return null; }
        export function removeFriendFromList(list) { return list; }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 2);
      assert.match(errors[0], /getFriendLimitFromError/u);
      assert.match(errors[1], /tryUnlock/u);
    },
  );
});

test('폼 값의 *FormInput과 mutation 인자의 *Params·*Args 타입 이름을 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/social/nudge/schemas/nudge-form.schema.ts': `
        export type NudgeFormInput = { message: string };
        export type NudgeFormValues = { message: string };
      `,
      'apps/mobile/src/features/planning/todo/queries/todo.mutations.ts': `
        interface ToggleTodoMutationParams { todoId: number }
        type UpdatePreferenceArgs = { theme: string };
        interface ToggleTodoVariables { todoId: number }
      `,
      'apps/mobile/src/features/planning/todo/schemas/todo-params.schema.ts': `
        export type TodoParams = { todoId: number };
      `,
    },
    (errors) => {
      assert.equal(errors.length, 3);
      assert.match(errors.join('\n'), /NudgeFormInput/u);
      assert.match(errors.join('\n'), /ToggleTodoMutationParams/u);
      assert.match(errors.join('\n'), /UpdatePreferenceArgs/u);
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

test('범위 비교는 min <= x && x <= max 순서만 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/weather/utils/ok.ts': `
        export function ok(x: number, y: number, min: number, max: number, isOn: boolean) {
          return [
            min <= x && x <= max,
            min < x && x < max,
            isOn && min <= x && x <= max,
            x >= min && y <= max,
            x < min && x < max,
            x >= 0 && y <= 0,
            0 <= x && 0 >= y,
            x > 0 && max >= x,
          ];
        }
      `,
      'apps/mobile/src/features/weather/utils/bad.ts': `
        export function bad(x: number, min: number, max: number, isOn: boolean) {
          return [
            x >= min && x <= max,
            x <= max && x >= min,
            x > min && x < max,
            isOn && x >= min && x <= max,
            max >= x && min <= x,
          ];
        }
      `,
      'apps/mobile/app/(app)/bad-screen.tsx': `
        export default function BadScreen({ hour }: { hour: number }) {
          return hour >= 6 && hour <= 18 ? null : null;
        }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 6);
      assert.ok(errors.every((error) => /bad(?:-screen)?\.tsx?:/u.test(error)));
      assert.match(errors[0], /min <= x && x <= max/u);
    },
  );
});

test('부정과 허용을 묻는 판별 이름을 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/weather/domains/bad.model.ts': `
        function isNotExpired() { return true; }
        const hasNoItems = false;
        const isEligible = true;
        const isPlanAllowed = true;
        interface Options { isUserEligible: boolean; hasNoAccess(): boolean }
        const flags = { isNotReady: () => false, isAllowed: true };
      `,
    },
    (errors) => {
      const names = errors.map((error) => /(?:\d+:\d+) (\w+):/u.exec(error)?.[1]);
      assert.deepEqual(names, [
        'isNotExpired',
        'hasNoItems',
        'isEligible',
        'isPlanAllowed',
        'isUserEligible',
        'hasNoAccess',
        'isNotReady',
        'isAllowed',
      ]);
    },
  );
});

test('라이브러리와 서버 계약 이름, OS 상태 isNotDetermined, 비슷한 긍정 이름은 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/weather/domains/ok.model.ts': `
        import { isNotNil } from 'es-toolkit';
        function isNotDetermined() { return false; }
        const canUseFeature = true;
        const isNotice = true;
        const hasNotes = true;
        const hasNothing = false;
        const { isNotModified, isAllowed } = response;
        export const OkPolicy = { isNotDetermined, canUseFeature, isNotice, hasNotes, hasNothing };
        const values = [isNotNil, response.isEligible, isNotModified, isAllowed];
      `,
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('댓글 model 테스트는 공용 도구 index에서도 renderUi를 가져오지 못한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/engagement/comment/domains/todo-comment.model.test.ts': `
        import { renderUi } from '@src/shared/__tests__';
        test('policy를 계산한다', () => {});
      `,
      'apps/mobile/src/features/engagement/comment/domains/todo-comment.error.test.ts': `
        import { createLoggerStub } from '@src/shared/__tests__';
        test('오류를 분류한다', () => {});
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /todo-comment\.model\.test\.ts/u);
    },
  );
});

test('한 태그에 spacing prop과 className을 섞으면 막는다', () => {
  withFixture(
    {
      'apps/mobile/src/features/weather/components/ok.tsx': `
        export function Ok() {
          return <><VStack gap={8} className="p-4" /><Box px={16} /></>;
        }
      `,
      'apps/mobile/app/bad.tsx': `
        export default function Bad() { return <Box px={16} className="grow" />; }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /bad\.tsx.*spacing prop\(px\)/u);
    },
  );
});

test('아이콘 컴포넌트를 받는 prop이 Icon이 아니면 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/shared/ui/bad/bad.tsx': `
        interface HintProps { icon?: StyledIcon }
        function Chip({ as }: { as: StyledIcon }) { return null; }
        interface PopoverProps { icon: typeof MicIcon | undefined }
      `,
    },
    (errors) => {
      const names = errors.map((error) => /(?:\d+:\d+) (\w+):/u.exec(error)?.[1]);
      assert.deepEqual(names, ['icon', 'as', 'icon']);
    },
  );
});

test('Icon 컴포넌트 prop과 그려 둔 icon 요소, 아이콘이 아닌 icon 값은 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/shared/ui/ok/ok.tsx': `
        interface MenuProps { Icon: StyledIcon; LeadingIcon?: StyledIcon }
        interface ButtonProps { icon: ReactNode }
        interface TileProps { icon: WeatherCardGlyph }
      `,
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('네임스페이스 조각의 함수 이름이 속성 이름과 다르면 거부하고 ErrorFallback과 가린 import는 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/weather/components/daily-forecast.tsx': `
        import { Button } from 'heroui-native';
        DailyForecast.TemperatureBar = function TemperatureBarTrack() { return null; };
        DailyForecast.Loading = function Loading() { return null; };
        DailyForecast.Error = function ErrorFallback() { return null; };
        DailyForecast.Button = function DailyForecastButton() { return null; };
      `,
      'apps/mobile/src/shared/__tests__/mocks/router.tsx': `
        Toolbar.Menu = function ToolbarMenu() { return null; };
      `,
    },
    (errors) => {
      const names = errors
        .filter((error) => error.includes('네임스페이스 조각의 함수 이름'))
        .map((error) => /(?:\d+:\d+) (\w+):/u.exec(error)?.[1]);
      assert.deepEqual(names, ['TemperatureBarTrack']);
    },
  );
});

test('네임스페이스의 *Skeleton 조각을 거부하고 X.Loading과 TextSkeleton은 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/shared/ui/group/group.tsx': `
        SettingsListGroup.ItemSkeleton = function ItemSkeleton() { return null; };
        SettingsListGroupItem.Loading = function Loading() { return null; };
        export function TextSkeleton() { return null; }
      `,
    },
    (errors) => {
      const names = errors.map((error) => /(?:\d+:\d+) (\w+):/u.exec(error)?.[1]);
      assert.deepEqual(names, ['ItemSkeleton']);
    },
  );
});

test('entity 이름이 feature 이름을 줄인 것이면 feature 수준 파일이 줄인 이름으로 시작하는 것을 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/social/nudge/domains/todo-nudge.model.ts': 'export {};',
      'apps/mobile/src/features/social/nudge/queries/nudge-cache.ts': 'export {};',
      'apps/mobile/src/features/social/nudge/constants/nudge.events.ts': 'export {};',
    },
    (errors) => {
      assert.deepEqual(errors, [
        'apps/mobile/src/features/social/nudge/constants/nudge.events.ts 파일 접두사는 entity 이름 todo-nudge입니다. feature 이름 nudge만으로 시작하지 않습니다.',
        'apps/mobile/src/features/social/nudge/queries/nudge-cache.ts 파일 접두사는 entity 이름 todo-nudge입니다. feature 이름 nudge만으로 시작하지 않습니다.',
      ]);
    },
  );
});

test('다른 entity, 역할 이름 파일, 컴포넌트와 feature 이름과 같은 entity는 접두사 검사를 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/social/nudge/domains/todo-nudge.model.ts': 'export {};',
      'apps/mobile/src/features/social/nudge/schemas/nudge-params.schema.ts': 'export {};',
      'apps/mobile/src/features/social/nudge/domains/nudge-interaction.model.ts': 'export {};',
      'apps/mobile/src/features/social/nudge/queries/todo-nudge-cache.ts': 'export {};',
      'apps/mobile/src/features/social/nudge/components/nudge-limit-banner.tsx': 'export {};',
      'apps/mobile/src/features/planning/todo/domains/todo.model.ts': 'export {};',
      'apps/mobile/src/features/planning/todo/domains/sub-todo.model.ts': 'export {};',
      'apps/mobile/src/features/planning/todo/queries/todo-cache.ts': 'export {};',
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('schemas/ 파일은 역할 접미사로 끝나면 통과한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/notes/memo/schemas/memo-form.schema.ts': 'export {};',
      'apps/mobile/src/features/notes/memo/schemas/memo-form.schema.test.ts': 'export {};',
      'apps/mobile/src/features/notes/memo/schemas/memo-params.schema.ts': 'export {};',
      'apps/mobile/src/features/notes/memo/schemas/memo-draft.schema.ts': 'export {};',
      'apps/mobile/src/features/notes/memo/schemas/memo-plan-response.schema.ts': 'export {};',
      'apps/mobile/src/features/weather/schemas/weather-report-query-key.schema.ts': 'export {};',
      'apps/mobile/src/features/device/widget/schemas/widget-snapshot-storage.schema.ts':
        'export {};',
      'apps/mobile/src/features/notification/schemas/push-notification-payload.schema.ts':
        'export {};',
      'apps/mobile/src/features/social/nudge/schemas/nudge-request.schema.ts': 'export {};',
      'apps/mobile/src/features/app-config/whats-new/schemas/release-entry.schema.ts': 'export {};',
    },
    (errors) => {
      assert.deepEqual(errors, []);
    },
  );
});

test('schemas/에 모델·옛 접미사 파일을 두면 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/features/notes/memo/schemas/memo.schema.ts': 'export {};',
      'apps/mobile/src/features/device/activation/schemas/activation-persisted.schema.ts':
        'export {};',
      'apps/mobile/src/features/planning/todo/schemas/calendar-view-mode.schema.ts': 'export {};',
      'apps/mobile/src/features/notes/memo/schemas/memo-key.ts': 'export {};',
    },
    (errors) => {
      assert.deepEqual(errors.map((error) => error.split(' ')[0]).sort(), [
        'apps/mobile/src/features/device/activation/schemas/activation-persisted.schema.ts',
        'apps/mobile/src/features/notes/memo/schemas/memo-key.ts',
        'apps/mobile/src/features/notes/memo/schemas/memo.schema.ts',
        'apps/mobile/src/features/planning/todo/schemas/calendar-view-mode.schema.ts',
      ]);
      assert.match(errors.join('\n'), /domains\/\{entity\}\.model\.ts/u);
    },
  );
});

test('테스트 fixture의 Zod import는 스키마 폴더 규칙에 걸리지 않는다', () => {
  withFixture(
    {
      'apps/mobile/src/features/notification/__tests__/notification-navigation-cases.ts': `import { z } from 'zod';`,
      'apps/mobile/src/features/notification/utils/notification-destination.ts': `import { z } from 'zod';`,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /^apps\/mobile\/src\/features\/notification\/utils\//u);
    },
  );
});

test('마이 탭 메뉴 칸이 그리는 항목이 router로 직접 이동하면 거부한다', () => {
  withFixture(
    {
      'apps/mobile/src/bootstrap/navigation/my-page-menu-pane.tsx': `
        import { ReleasesItem } from '@src/features/app-config/whats-new/components/releases-item';
        import { ThemeItem } from '@src/features/identity/user/components/theme-item';
        export function MyPageMenuPane() { return null; }
      `,
      'apps/mobile/src/features/app-config/whats-new/components/releases-item.tsx': `
        export function ReleasesItem() {
          const push = useSingleTap(router.push);
          return null;
        }
      `,
      'apps/mobile/src/features/identity/user/components/theme-item.tsx': `
        export function ThemeItem() {
          const navigate = useMyPageMenuNavigate();
          return null;
        }
      `,
    },
    (errors) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /releases-item\.tsx:3:.*router\.push 대신 useMyPageMenuNavigate/u);
    },
  );
});
