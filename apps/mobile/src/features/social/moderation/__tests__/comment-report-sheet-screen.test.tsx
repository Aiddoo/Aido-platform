import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import {
  createTodoComment,
  createTodoCommentThread,
} from '@src/features/engagement/comment/__tests__/todo-comment.fixtures';
import { TODO_COMMENT_QUERY_KEYS } from '@src/features/engagement/comment/queries/todo-comment-query-keys';
import {
  countGetRequests,
  layoutSheetRoute,
} from '@src/features/planning/todo/__tests__/todo.test-utils';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createRouteParamsFake,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Redirect, router } from 'expo-router';

import CommentReportSheetRoute from '../../../../../app/(app)/todo/[todoId]/comments/[commentId]/report';
import { createUserReportResponseDto } from './moderation.fixtures';

const TODO_ID = 42;
const COMMENT_ID = 'clz7x5p8k0200qz0z8z8z8z8z';
const AUTHOR_ID = 'clz7x5p8k0201qz0z8z8z8z8z';

async function renderCommentReportSheet({ isCommentCached }: { isCommentCached: boolean }) {
  createRouteParamsFake({ todoId: String(TODO_ID), commentId: COMMENT_ID });
  const httpClient = createHttpClientStub();
  const analytics = createAnalyticsStub();
  const queryClient = createTestQueryClient();
  if (isCommentCached) {
    // 댓글 ⋯ 메뉴에서 열어 그 댓글은 이미 받은 묶음 목록에 있다
    const comment = createTodoComment({
      id: COMMENT_ID,
      todoId: TODO_ID,
      author: {
        id: AUTHOR_ID,
        name: '이영희',
        userTag: '2DX97AMT',
        profileImage: null,
        isTodoOwner: false,
      },
    });
    queryClient.setQueryData(
      TODO_COMMENT_QUERY_KEYS.threads({ todoId: TODO_ID, sort: 'LATEST', anchorCommentId: null }),
      {
        pages: [
          {
            items: [createTodoCommentThread({ comment, previewReply: null })],
            pagination: {
              previousCursor: null,
              nextCursor: null,
              hasPrevious: false,
              hasNext: false,
              size: 10,
            },
            anchor: null,
          },
        ],
        pageParams: [null],
      },
    );
  }
  await renderScreen(<CommentReportSheetRoute />, {
    di: createTestDi({ ports: { httpClient, analytics, queryClient } }),
    withLocalDate: true,
  });
  await layoutSheetRoute();

  return { httpClient, analytics };
}

describe('CommentReportSheetRoute', () => {
  it('댓글을 신고하면 작성자와 그 댓글 id를 대상으로 한 번 보내고 시트를 닫는다', async () => {
    // Given
    const { httpClient, analytics } = await renderCommentReportSheet({ isCommentCached: true });
    httpClient.post.mockResolvedValue(ok(createUserReportResponseDto()));
    await fireEvent.press(await screen.findByTestId('report-reason-OTHER'));
    await fireEvent.changeText(screen.getByTestId('report-detail-input'), '도배해요');

    // When
    await fireEvent.press(screen.getByTestId('report-submit'));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith('v1/reports', {
      targetUserId: AUTHOR_ID,
      targetType: 'COMMENT',
      targetId: COMMENT_ID,
      reason: 'OTHER',
      detail: '도배해요',
    });
    expect(countGetRequests(httpClient)).toEqual({});
    expect(analytics.trackEvent.mock.calls.filter(([name]) => name === 'content_reported')).toEqual(
      [['content_reported', { target_type: 'COMMENT', reason: 'OTHER' }]],
    );
  });

  it('받아 둔 댓글에 없으면 작성자를 몰라 신고 시트 없이 피드로 돌아간다', async () => {
    // When
    const { httpClient } = await renderCommentReportSheet({ isCommentCached: false });

    // Then
    expect(jest.mocked(Redirect).mock.calls.at(-1)?.[0]).toEqual({ href: '/feed' });
    expect(screen.queryByTestId('report-reason-sheet')).toBeNull();
    expect(countGetRequests(httpClient)).toEqual({});
  });
});
