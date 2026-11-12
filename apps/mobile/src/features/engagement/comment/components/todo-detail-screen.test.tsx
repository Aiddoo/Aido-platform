import { nudgeThanksPreviewResponseSchema } from '@aido/api';
import '@src/shared/i18n/init';
import { ApiError } from '@src/core/errors/api-error';
import { err, ok } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import {
  createTodoDto,
  createTodoItemResponseDto,
  createTodoListResponseDto,
} from '@src/features/planning/todo/__tests__/todo.fixtures';
import { SubTodoPolicy } from '@src/features/planning/todo/domains/sub-todo.model';
import { updateCachedTodo } from '@src/features/planning/todo/queries/todo-cache';
import { NetworkError, ServerError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createClipboardGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createTestDi,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardController } from 'react-native-keyboard-controller';

import TodoDetailRoute from '../../../../../app/(app)/todo/[todoId]';
import { TODO_COMMENT_INPUT_NATIVE_ID } from '../constants/todo-comment.constants';

const TODO_ID = 42;
const COMMENT_ID = 'ckcomment0001';
const USER_ID = 'clz7x5p8k0001qz0z8z8z8z8z';
const FRIEND_ID = 'clz7x5p8k0002qz0z8z8z8z8z';
const CREATED_AT = '2026-08-15T09:00:00.000Z';
/** 새 댓글은 연결 실패를 두 번 더 시도해 1.5초 뒤에 실패로 끝난다 */
const RETRY_WAIT = { timeout: 4_000 };

const PAGINATION = {
  previousCursor: null,
  nextCursor: null,
  hasPrevious: false,
  hasNext: false,
  size: 30,
};

const COMMENT_DTO = {
  id: COMMENT_ID,
  todoId: TODO_ID,
  threadCommentId: null,
  replyTo: null,
  author: {
    id: 'clz7x5p8k0002qz0z8z8z8z8z',
    name: '안드친구',
    userTag: 'FRIEND01',
    profileImage: null,
    isTodoOwner: false,
  },
  content: '오늘도 화이팅!',
  likeCount: 0,
  replyCount: 0,
  isDeleted: false,
  isAuthorBlocked: false,
  isEdited: false,
  viewer: {
    isLiked: false,
    canEdit: false,
    canDelete: true,
    canReply: true,
    canReport: true,
    canBlock: true,
  },
  createdAt: CREATED_AT,
  editedAt: null,
};

function createDetailsDto(overrides: Record<string, unknown> = {}) {
  return {
    todo: createTodoDto({ id: TODO_ID, userId: USER_ID, title: '운동하기' }),
    owner: { id: USER_ID, name: '나', userTag: 'TEST2025', profileImage: null },
    permissions: { canEdit: true, canComment: true, canNudge: false },
    metrics: { viewCount: 3, commentCount: 1 },
    ...overrides,
  };
}

const THANKS_PREVIEW_PATH = `v1/nudges/todos/${TODO_ID}/thanks`;

const FRIEND_DETAILS = {
  owner: { id: FRIEND_ID, name: '안드친구', userTag: 'FRIEND01', profileImage: null },
  permissions: { canEdit: false, canComment: true, canNudge: false },
};

type HostNode = ReturnType<typeof screen.getByTestId>;

/** 키보드 부품은 공식 mock에서 View·ScrollView라 타입이 아니라 키보드 props로 찾는다 */
function findHostsWithProp(propName: string, value?: unknown) {
  const found: HostNode[] = [];
  const visit = (node: HostNode) => {
    if (propName in node.props && (value == null || node.props[propName] === value)) {
      found.push(node);
    }
    node.children.forEach((child) => {
      if (typeof child !== 'string') {
        visit(child);
      }
    });
  };
  if (screen.root != null) {
    visit(screen.root);
  }
  return found;
}

interface RenderTodoDetailOptions {
  details?: Record<string, unknown>;
  threadItems?: unknown[];
  listItems?: ReturnType<typeof createTodoDto>[];
  analytics?: ReturnType<typeof createAnalyticsStub>;
  /** 고마움 현황 응답. 넘기면 콕 답장·감사를 켠 서버다 */
  thanksPreview?: () => ReturnType<HttpClient['get']>;
}

async function renderTodoDetail({
  details,
  threadItems,
  listItems = [],
  analytics = createAnalyticsStub(),
  thanksPreview,
}: RenderTodoDetailOptions = {}) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async (path: string) => {
    if (thanksPreview != null && path === 'v1/nudges/interactions/availability') {
      return ok({ enabled: true });
    }
    if (thanksPreview != null && path === THANKS_PREVIEW_PATH) {
      return thanksPreview();
    }
    if (path === 'v1/auth/me') {
      return ok(createCurrentUserDto({ userId: USER_ID }));
    }
    if (path === `v1/todos/${TODO_ID}/details`) {
      return ok(createDetailsDto(details));
    }
    if (path === 'v1/auth/preference') {
      return ok(createPreferenceDto());
    }
    if (path === 'v1/todos') {
      return ok(createTodoListResponseDto({ items: listItems }));
    }
    return ok({
      items: threadItems ?? [
        {
          comment: COMMENT_DTO,
          previewReply: null,
          replySummary: { totalCount: 0, hiddenCount: 0, participantAuthors: [] },
        },
      ],
      pagination: PAGINATION,
      anchor: null,
    });
  });
  jest.mocked(useLocalSearchParams).mockReturnValue({ todoId: String(TODO_ID) });

  const view = await renderScreen(<TodoDetailRoute />, {
    di: createTestDi({ ports: { httpClient, analytics, clipboard: createClipboardGatewayStub() } }),
    withLocalDate: true,
    withOverlay: true,
  });
  await screen.findByTestId('todo-comment-input-0');
  await screen.findByTestId('todo-comment-count');

  return { ...view, httpClient };
}

describe('할 일 상세 입력창과 키보드', () => {
  it('입력창은 댓글 목록 아래에서 키보드를 따라가고 목록은 같은 키보드 스크롤 하나다', async () => {
    // Given
    await renderTodoDetail();

    // When
    const [gestureArea] = findHostsWithProp('textInputNativeID');
    const stickyViews = findHostsWithProp('offset');
    const chatScrolls = findHostsWithProp('keyboardLiftBehavior');
    const threads = screen.getByTestId('todo-comment-threads');
    const composer = screen.getByTestId('todo-comment-composer');

    // Then
    expect(gestureArea?.props.textInputNativeID).toBe(TODO_COMMENT_INPUT_NATIVE_ID);
    expect(chatScrolls).toHaveLength(1);
    expect(chatScrolls[0]?.props.keyboardLiftBehavior).toBe('whenAtEnd');
    expect(chatScrolls[0]?.props.keyboardShouldPersistTaps).toBe('handled');
    expect(chatScrolls[0]?.props.contentInsetAdjustmentBehavior).toBe('never');
    const stickyView = stickyViews.find((view) => view.props.enabled === true);
    expect(stickyView?.props.offset).toEqual({ closed: 0, opened: 0 });
    expect(threads.children.at(-1)).toBe(stickyView);
    expect(composer.parent).toBe(stickyView);
  });

  it('입력창은 키보드가 열린 채 첫 탭에 보내기가 눌리고 제스처 영역과 같은 id를 쓴다', async () => {
    // Given
    await renderTodoDetail();

    // When
    const input = screen.getByTestId('todo-comment-input-0');
    const composerScrolls = findHostsWithProp('keyboardShouldPersistTaps', 'always');

    // Then
    expect(input.props.nativeID).toBe(TODO_COMMENT_INPUT_NATIVE_ID);
    expect(composerScrolls).toHaveLength(1);
  });

  it('답글 달기를 누르면 화면 이동 없이 같은 입력창이 답글 모드가 되고 뒤로가기가 작성기부터 닫는다', async () => {
    // Given
    await renderTodoDetail();

    // When
    await fireEvent.press(screen.getByTestId(`todo-comment-reply-${COMMENT_ID}`));

    // Then
    expect(await screen.findByTestId('todo-comment-composer-target')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('답글 달기…')).toBeOnTheScreen();

    // When
    const [headerBack] = screen.getAllByLabelText('작성 닫기');
    if (headerBack == null) {
      throw new Error('헤더 뒤로가기를 찾지 못했다');
    }
    await fireEvent.press(headerBack);

    // Then
    await waitFor(() => expect(screen.queryByTestId('todo-comment-composer-target')).toBeNull());
    expect(KeyboardController.dismiss).toHaveBeenCalledWith({ animated: false });
    expect(router.back).not.toHaveBeenCalled();
  });

  it('서버가 거절해 댓글을 못 보내도 입력값이 그대로 남는다', async () => {
    // Given
    const { httpClient } = await renderTodoDetail();
    httpClient.post.mockResolvedValue(err(new ApiError('SYS_0002', '거절', 400)));

    // When
    await fireEvent.changeText(screen.getByTestId('todo-comment-input-0'), '남아야 하는 글');
    await fireEvent.press(screen.getByTestId('todo-comment-submit'));

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId('todo-comment-input-0').props.value).toBe('남아야 하는 글'),
    );
  });

  it('보내면 입력을 비우고 키보드를 내린다', async () => {
    // Given
    const { httpClient } = await renderTodoDetail();
    jest.mocked(KeyboardController.dismiss).mockClear();
    httpClient.post.mockResolvedValue(
      ok({
        comments: [
          {
            id: 'ckcomment0002',
            threadId: 'ckcomment0002',
            parentId: null,
            depth: 0,
            author: { ...COMMENT_DTO.author },
            content: '보낸 글',
            isDeleted: false,
            isAuthorBlocked: false,
            isEdited: false,
            replyTo: null,
            likeCount: 0,
            replyCount: 0,
            viewer: {
              isLiked: false,
              canEdit: true,
              canDelete: true,
              canReply: true,
              canReport: false,
              canBlock: false,
            },
            createdAt: CREATED_AT,
            editedAt: null,
          },
        ],
      }),
    );

    // When
    await fireEvent.changeText(screen.getByTestId('todo-comment-input-0'), '보낸 글');
    await fireEvent.press(screen.getByTestId('todo-comment-submit'));

    // Then
    await waitFor(() => expect(screen.getByTestId('todo-comment-input-0').props.value).toBe(''));
    expect(KeyboardController.dismiss).toHaveBeenCalled();
  });

  it('오프라인에서 보내면 멈추지 않고 실패해 입력값이 남고 다시 보낼 수 있다', async () => {
    // Given
    const { httpClient } = await renderTodoDetail();
    httpClient.post.mockRejectedValue(new NetworkError());
    onlineManager.setOnline(false);

    try {
      // When
      await fireEvent.changeText(screen.getByTestId('todo-comment-input-0'), '오프라인 글');
      await fireEvent.press(screen.getByTestId('todo-comment-submit'));

      // Then
      await waitFor(() => expect(httpClient.post).toHaveBeenCalled());
      await waitFor(
        () => expect(screen.getByTestId('todo-comment-submit')).toBeEnabled(),
        RETRY_WAIT,
      );
      expect(screen.getByTestId('todo-comment-input-0').props.value).toBe('오프라인 글');
    } finally {
      onlineManager.setOnline(true);
    }
  });
});

describe('할 일 상세 카드', () => {
  it('친구 할 일은 작성자 줄이 보이고 체크박스는 읽기 전용이다', async () => {
    // Given
    await renderTodoDetail({ details: FRIEND_DETAILS });

    // When
    const checkbox = await screen.findByTestId('todo-detail-checkbox');

    // Then
    expect(screen.getByTestId('todo-detail-owner')).toHaveTextContent('안드친구');
    expect(checkbox).toBeDisabled();
  });

  it('친구의 반복 할 일은 규칙을 몰라 반복이라고만 보이고 내 목록을 받지 않는다', async () => {
    // Given
    const { httpClient } = await renderTodoDetail({
      details: {
        ...FRIEND_DETAILS,
        todo: createTodoDto({ id: TODO_ID, recurrenceGroupId: 'series-1' }),
      },
    });

    // When
    const label = await screen.findByText('반복');

    // Then
    expect(label).toBeOnTheScreen();
    expect(httpClient.get).not.toHaveBeenCalledWith('v1/todos', expect.anything());
  });

  it('내 반복 할 일은 시작일 목록에서 규칙을 읽어 요약을 보인다', async () => {
    // Given
    const repeat = { frequency: 'DAILY' as const, end: { type: 'NEVER' as const } };

    // When
    await renderTodoDetail({
      details: { todo: createTodoDto({ id: TODO_ID, recurrenceGroupId: 'series-1' }) },
      listItems: [createTodoDto({ id: TODO_ID, recurrenceGroupId: 'series-1', repeat })],
    });

    // Then
    expect(await screen.findByText('매일')).toBeOnTheScreen();
  });

  it('지웠거나 볼 수 없게 된 할 일은 본문과 입력창 대신 안내 하나만 보이고 뒤로 갈 수 있다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockImplementation(async (path: string) => {
      if (path === `v1/todos/${TODO_ID}/details`) {
        return err(new ApiError('TODO_0801', '없음', 404));
      }
      return ok({ items: [], pagination: PAGINATION, anchor: null });
    });
    jest.mocked(useLocalSearchParams).mockReturnValue({ todoId: String(TODO_ID) });

    // When
    await renderScreen(<TodoDetailRoute />, {
      di: createTestDi({ ports: { httpClient } }),
      withLocalDate: true,
      withOverlay: true,
    });

    // Then
    expect(await screen.findByTestId('todo-unavailable')).toBeOnTheScreen();
    expect(screen.queryByTestId('todo-comment-composer')).toBeNull();

    // When
    await fireEvent.press(screen.getByText('뒤로 가기'));

    // Then
    expect(router.back).toHaveBeenCalled();
  });
});

describe('할 일 상세 체크', () => {
  const PRIVATE_TODO = { visibility: 'PRIVATE' as const };

  it('내 할 일은 누르면 응답 전에 바로 체크되고 기존 토글 요청과 이벤트를 쓴다', async () => {
    // Given
    const analytics = createAnalyticsStub();
    const { httpClient } = await renderTodoDetail({
      details: { todo: createTodoDto({ id: TODO_ID, ...PRIVATE_TODO }) },
      analytics,
    });
    const pending = createPendingResponse(
      ok({
        message: '완료',
        todo: createTodoDto({ id: TODO_ID, ...PRIVATE_TODO, completed: true }),
      }),
    );
    httpClient.patch.mockReturnValue(pending.response);

    // When
    await fireEvent.press(await screen.findByTestId('todo-detail-checkbox'));

    // Then
    await waitFor(() => expect(screen.getByTestId('todo-detail-checkbox')).toBeChecked());
    expect(httpClient.patch).toHaveBeenCalledWith(`v1/todos/${TODO_ID}/complete`, {
      completed: true,
    });

    // When
    pending.settle();

    // Then
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith('todo_completed', {
        todo_id: TODO_ID,
        is_completed: true,
      }),
    );
  });

  it('서버가 거절하면 체크가 되돌아간다', async () => {
    // Given
    const { httpClient } = await renderTodoDetail({
      details: { todo: createTodoDto({ id: TODO_ID, ...PRIVATE_TODO }) },
    });
    httpClient.patch.mockResolvedValue(err(new ApiError('SYS_0002', '거절', 400)));

    // When
    await fireEvent.press(await screen.findByTestId('todo-detail-checkbox'));

    // Then
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('todo-detail-checkbox')).not.toBeChecked());
  });

  it('내 하위 할 일도 눌러 체크한다', async () => {
    // Given
    const item = createTodoItemResponseDto({ id: 7, title: '스트레칭' });
    const todo = createTodoDto({
      id: TODO_ID,
      ...PRIVATE_TODO,
      items: [item],
      itemStats: { total: 1, completed: 0 },
    });
    const { httpClient } = await renderTodoDetail({ details: { todo } });
    const pending = createPendingResponse(ok({ message: '수정', todo }));
    httpClient.patch.mockReturnValue(pending.response);

    // When
    await fireEvent.press(await screen.findByTestId('todo-detail-sub-todo-checkbox-7'));

    // Then
    expect(httpClient.patch).toHaveBeenCalledWith(`v1/todos/${TODO_ID}/items/7`, {
      completed: true,
    });
    pending.settle();
  });

  it('목록에서 막 더해 응답을 기다리는 하위 할 일은 체크할 수 없어 임시 id로 요청을 보내지 않는다', async () => {
    // Given
    const todo = createTodoDto({ id: TODO_ID, ...PRIVATE_TODO });
    const { httpClient, queryClient } = await renderTodoDetail({ details: { todo } });
    await act(async () => {
      updateCachedTodo(
        queryClient,
        { date: createDateKey(todo.startDate), todoId: TODO_ID },
        (cached) =>
          SubTodoPolicy.withSubTodoAdded(cached, {
            id: -1,
            title: '스트레칭',
            completed: false,
            sortOrder: 0,
          }),
      );
    });

    // When
    await fireEvent.press(await screen.findByTestId('todo-detail-sub-todo-checkbox--1'));

    // Then
    expect(screen.getByTestId('todo-detail-sub-todo-checkbox--1')).toBeDisabled();
    expect(httpClient.patch).not.toHaveBeenCalled();
  });

  it('친구 하위 할 일은 읽기 전용이다', async () => {
    // Given
    const item = createTodoItemResponseDto({ id: 7, title: '스트레칭' });
    const todo = createTodoDto({
      id: TODO_ID,
      items: [item],
      itemStats: { total: 1, completed: 0 },
    });

    // When
    await renderTodoDetail({ details: { ...FRIEND_DETAILS, todo } });

    // Then
    expect(await screen.findByTestId('todo-detail-sub-todo-checkbox-7')).toBeDisabled();
  });
});

describe('할 일 상세 고마움 현황', () => {
  const THANKS_PREVIEW_DTO = nudgeThanksPreviewResponseSchema.parse({
    todoId: TODO_ID,
    throughNudgeId: 7,
    recipients: [{ id: FRIEND_ID, userTag: 'FRIEND01', name: '안드친구', profileImage: null }],
    totalRecipients: 1,
    nextCursor: null,
    hasNext: false,
    thankedRecipientCount: 0,
    lastThankedAt: null,
  });

  it('완료를 저장하는 동안에는 고마움 현황을 묻지 않고, 저장이 끝나면 받아 콕 찔러준 친구 카드를 보인다', async () => {
    // Given
    const { httpClient } = await renderTodoDetail({
      details: { todo: createTodoDto({ id: TODO_ID, visibility: 'PUBLIC' }) },
      thanksPreview: async () => ok(THANKS_PREVIEW_DTO),
    });
    const completion = createPendingResponse(
      ok({ message: '완료', todo: createTodoDto({ id: TODO_ID, completed: true }) }),
    );
    httpClient.patch.mockReturnValue(completion.response);

    // When
    await fireEvent.press(await screen.findByTestId('todo-detail-checkbox'));
    await waitFor(() =>
      expect(httpClient.get).toHaveBeenCalledWith(
        'v1/nudges/interactions/availability',
        expect.anything(),
      ),
    );
    await act(async () => {});

    // Then
    expect(screen.getByTestId('todo-detail-checkbox')).toBeChecked();
    expect(httpClient.get).not.toHaveBeenCalledWith(THANKS_PREVIEW_PATH, expect.anything());

    // When
    completion.settle();

    // Then
    expect(await screen.findByText('콕 찔러준 친구 1명')).toBeOnTheScreen();
    expect(httpClient.get).toHaveBeenCalledWith(THANKS_PREVIEW_PATH, expect.anything());
  });

  it('서버 장애는 같은 자리에 다시 시도를 보이고 누르면 다시 받아 카드를 보인다', async () => {
    // Given
    let attempts = 0;
    await renderTodoDetail({
      details: { todo: createTodoDto({ id: TODO_ID, visibility: 'PUBLIC', completed: true }) },
      thanksPreview: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new ServerError(503);
        }
        return ok(THANKS_PREVIEW_DTO);
      },
    });
    expect(await screen.findByText('고마움 현황을 불러오지 못했어요')).toBeOnTheScreen();

    // When
    await fireEvent.press(screen.getByTestId('thanks-summary-retry'));

    // Then
    expect(await screen.findByText('콕 찔러준 친구 1명')).toBeOnTheScreen();
  });
});

describe('댓글 하트 연타', () => {
  function createLikeResponse(isLiked: boolean, likeCount: number) {
    return createPendingResponse(ok({ commentId: COMMENT_ID, isLiked, likeCount }));
  }

  it('앞 응답이 뒤에 누른 하트를 덮지 않고 마지막 응답만 서버 수로 보인다', async () => {
    // Given
    const { httpClient } = await renderTodoDetail();
    const firstLike = createLikeResponse(true, 1);
    const unlike = createLikeResponse(false, 0);
    // 그사이 다른 사람도 눌러 마지막 응답의 수는 2다
    const secondLike = createLikeResponse(true, 2);
    httpClient.put.mockReturnValueOnce(firstLike.response).mockReturnValueOnce(secondLike.response);
    httpClient.delete.mockReturnValueOnce(unlike.response);
    const heart = () => screen.getByTestId(`todo-comment-like-${COMMENT_ID}`);
    await fireEvent.press(heart());
    await waitFor(() => expect(heart()).toBeSelected());
    await fireEvent.press(heart());
    await waitFor(() => expect(heart()).not.toBeSelected());
    await fireEvent.press(heart());
    await waitFor(() => expect(heart()).toBeSelected());

    // When
    firstLike.settle();
    await waitFor(() => expect(httpClient.delete).toHaveBeenCalledTimes(1));
    unlike.settle();
    await waitFor(() => expect(httpClient.put).toHaveBeenCalledTimes(2));

    // Then
    expect(heart()).toBeSelected();
    expect(within(heart()).getByText('1')).toBeOnTheScreen();

    // When
    secondLike.settle();

    // Then
    await waitFor(() => expect(within(heart()).getByText('2')).toBeOnTheScreen());
    expect(heart()).toBeSelected();
  });
});
