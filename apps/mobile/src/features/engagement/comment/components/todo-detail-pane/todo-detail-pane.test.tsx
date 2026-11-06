import '@src/shared/i18n/init';
import { createCoachmarkRepository } from '@src/features/device/coachmark/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { UserService } from '@src/features/identity/user/apis/user.service';
import { createTodoDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { TodoService } from '@src/features/planning/todo/apis/todo.service';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHttpClientStub,
  createLoggerStub,
  createMemorySyncStorage,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { createDraftRepository } from '@src/shared/draft/draft.repository';
import { DraftService } from '@src/shared/draft/draft.service';
import { ApiError } from '@src/shared/errors/api-error';
import { err, ok } from '@src/shared/errors/result';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardController } from 'react-native-keyboard-controller';

import { TodoCommentService } from '../../apis/todo-comment.service';
import { TODO_COMMENT_INPUT_NATIVE_ID } from '../../constants/todo-comment.constants';
import { TodoDetailPane } from './todo-detail-pane';

const TODO_ID = 42;
const COMMENT_ID = 'ckcomment0001';
const USER_ID = 'clz7x5p8k0001qz0z8z8z8z8z';
const CREATED_AT = '2026-08-15T09:00:00.000Z';

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

function createDetailsDto() {
  return {
    todo: createTodoDto({ id: TODO_ID, userId: USER_ID, title: '운동하기' }),
    owner: { id: USER_ID, name: '나', userTag: 'TEST2025', profileImage: null },
    permissions: { canEdit: true, canComment: true, canNudge: false },
    metrics: { viewCount: 3, commentCount: 1 },
  };
}

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

async function renderTodoDetail() {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async (path: string) => {
    if (path === 'v1/auth/me') {
      return ok(createCurrentUserDto({ userId: USER_ID }));
    }
    if (path === `v1/todos/${TODO_ID}/details`) {
      return ok(createDetailsDto());
    }
    return ok({
      items: [
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

  const view = await renderUi(<TodoDetailPane presentation="screen" />, {
    withLocalDate: true,
    withOverlay: true,
    di: {
      todoCommentService: new TodoCommentService(httpClient),
      todoService: new TodoService(httpClient),
      userService: new UserService(httpClient),
      analytics: createAnalyticsStub(),
      coachmarkService: new CoachmarkService(createCoachmarkRepository(createMemorySyncStorage())),
      draftService: new DraftService(createDraftRepository(createMemorySyncStorage())),
      clipboard: { hasContent: jest.fn(), paste: jest.fn(), copy: jest.fn() },
      logger: createLoggerStub(),
      errorReporter: createErrorReporterStub(),
    },
  });
  await screen.findByTestId('todo-comment-input-0');
  await screen.findByText('오늘도 화이팅!');

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
    httpClient.post.mockResolvedValue(err(new ApiError('TODO_9999', '거절', 400)));

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
            viewer: { isLiked: false, canEdit: true, canDelete: true, canReply: true },
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
});
