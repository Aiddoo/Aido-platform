import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createCoachmarkRepository } from '@src/features/device/coachmark/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import { UserService } from '@src/features/identity/user/apis/user.service';
import {
  createMemorySyncStorage,
  createAnalyticsStub,
  createHttpClientStub,
  createPendingResponse,
} from '@src/shared/__tests__';
import { createLoggerStub } from '@src/shared/__tests__/create-logger-stub';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { FormProvider, useForm } from 'react-hook-form';
import { Pressable } from 'react-native';

import {
  createTodoComment,
  createTodoCommentReply,
  createTodoCommentThread,
  TODO_ID,
} from '../__tests__/todo-comment.fixtures';
import { TodoCommentService } from '../apis/todo-comment.service';
import { TODO_COMMENT_QUERY_KEYS } from '../constants/todo-comment-query-keys';
import { NEW_TODO_COMMENT_FORM_VALUES } from '../schemas/todo-comment-form.schema';
import type { TodoCommentThread } from '../schemas/todo-comment.schema';
import { INITIAL_TODO_COMMENT_PAGE_PARAM } from '../utils/todo-comment-page-params';
import { TodoCommentExpansionProvider, useExpandThread } from './todo-comment-expansion';
import { TodoCommentReplies } from './todo-comment-replies';
import { TodoCommentRevealProvider } from './todo-comment-reveal';

const PAGINATION = {
  previousCursor: null,
  nextCursor: null,
  hasPrevious: false,
  hasNext: false,
  size: 20,
};

/** 작성 폼이 답글을 올린 뒤 하는 일(묶음 자동 펼침)만 대신한다 */
function PostReplyButton({ threadCommentId }: { threadCommentId: string }) {
  const expandThread = useExpandThread();

  return <Pressable testID="post-reply" onPress={() => expandThread(threadCommentId)} />;
}

/** 할 일 상세 화면이 답글 묶음 위에 두는 Provider를 그대로 둔다 */
function PostedReplyThread({ thread }: { thread: TodoCommentThread }) {
  const composer = useForm({ defaultValues: NEW_TODO_COMMENT_FORM_VALUES });

  return (
    <FormProvider {...composer}>
      <TodoCommentRevealProvider>
        <TodoCommentExpansionProvider>
          <PostReplyButton threadCommentId={thread.comment.id} />
          <TodoCommentReplies thread={thread} anchor={null} />
        </TodoCommentExpansionProvider>
      </TodoCommentRevealProvider>
    </FormProvider>
  );
}

async function renderThreadWithReplies() {
  const head = createTodoComment({ replyCount: 2 });
  const first = createTodoCommentReply(head, { id: 'reply-1' });
  const second = createTodoCommentReply(head, { id: 'reply-2', content: '방금 쓴 답글' });
  const thread = createTodoCommentThread({ comment: head, previewReply: first });
  const httpClient = createHttpClientStub();
  httpClient.get.mockReturnValue(createPendingResponse(ok(undefined)).response);
  jest.mocked(useLocalSearchParams).mockReturnValue({ todoId: String(TODO_ID) });

  const view = await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <PostedReplyThread thread={thread} />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      di: {
        todoCommentService: new TodoCommentService(httpClient),
        analytics: createAnalyticsStub(),
        userService: new UserService(httpClient),
        coachmarkService: new CoachmarkService(
          createCoachmarkRepository(createMemorySyncStorage()),
        ),
        clipboard: { hasContent: jest.fn(), paste: jest.fn(), copy: jest.fn() },
        logger: createLoggerStub(),
        errorReporter: {
          captureException: jest.fn(),
          captureMessage: jest.fn(),
          addBreadcrumb: jest.fn(),
          setUserId: jest.fn(),
        },
      },
    },
  );
  view.queryClient.setQueryData(
    TODO_COMMENT_QUERY_KEYS.replies({ todoId: TODO_ID, commentId: head.id, aroundReplyId: null }),
    {
      pages: [{ items: [first, second], pagination: PAGINATION }],
      pageParams: [INITIAL_TODO_COMMENT_PAGE_PARAM],
    },
  );
  return view;
}

describe('TodoCommentReplies', () => {
  it('답글을 올려 묶음이 펼쳐지면 답글 숨기기를 보이지 않는다', async () => {
    // Given
    await renderThreadWithReplies();

    // When
    fireEvent.press(screen.getByTestId('post-reply')).catch(() => undefined);

    // Then
    expect(await screen.findByText(/방금 쓴 답글/u)).toBeOnTheScreen();
    expect(screen.queryByText('답글 숨기기')).toBeNull();
  });

  it('사용자가 더 보기로 펼친 묶음은 답글 숨기기를 보인다', async () => {
    // Given
    await renderThreadWithReplies();

    // When
    fireEvent.press(screen.getByText('답글 1개 더 보기')).catch(() => undefined);

    // Then
    expect(await screen.findByText('답글 숨기기')).toBeOnTheScreen();
  });
});
