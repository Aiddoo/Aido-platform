import { TODO_COMMENT_SORT } from '@aido/validators';

import { canStartCommentNavigation, parseCommentRouteState } from './comment-route-state';

const COMMENT_ID = 'cmt92zn3n000b7voxx9quc2th';

describe('parseCommentRouteState', () => {
  test('search가 없으면 최신순 댓글 개요로 정규화한다', () => {
    expect(parseCommentRouteState({})).toEqual({
      sort: TODO_COMMENT_SORT.LATEST,
      mode: 'overview',
      anchorCommentId: undefined,
    });
  });

  test('comment만 있는 기존 알림 URL은 대화 보기로 복구한다', () => {
    expect(
      parseCommentRouteState({ sort: TODO_COMMENT_SORT.POPULAR, comment: COMMENT_ID }),
    ).toEqual({
      sort: TODO_COMMENT_SORT.POPULAR,
      mode: 'thread',
      anchorCommentId: COMMENT_ID,
    });
  });

  test.each(['thread', 'reply', 'edit'] as const)(
    '%s intent는 comment를 anchor로 사용한다',
    (intent) => {
      expect(parseCommentRouteState({ comment: COMMENT_ID, intent })).toEqual({
        sort: TODO_COMMENT_SORT.LATEST,
        mode: intent,
        anchorCommentId: COMMENT_ID,
      });
    },
  );

  test('create는 comment 없이만 허용한다', () => {
    expect(parseCommentRouteState({ intent: 'create' })).toEqual({
      sort: TODO_COMMENT_SORT.LATEST,
      mode: 'create',
      anchorCommentId: undefined,
    });
    expect(parseCommentRouteState({ comment: COMMENT_ID, intent: 'create' }).mode).toBe('overview');
  });

  test('잘못된 ID, intent, 배열 search는 안전하게 개요로 복구한다', () => {
    expect(parseCommentRouteState({ comment: 'invalid', intent: 'reply' }).mode).toBe('overview');
    expect(parseCommentRouteState({ comment: COMMENT_ID, intent: 'unknown' }).mode).toBe(
      'overview',
    );
    expect(parseCommentRouteState({ sort: [TODO_COMMENT_SORT.POPULAR] }).sort).toBe(
      TODO_COMMENT_SORT.LATEST,
    );
  });
});

describe('canStartCommentNavigation', () => {
  test.each(['overview', 'thread'] as const)('%s에서는 댓글 이동을 허용한다', (currentMode) => {
    expect(
      canStartCommentNavigation({
        currentMode,
        destination: 'reply',
        isComposerMutating: false,
      }),
    ).toBe(true);
  });

  test.each(['create', 'edit'] as const)('%s 작성 중에는 댓글 이동을 막는다', (currentMode) => {
    expect(
      canStartCommentNavigation({
        currentMode,
        destination: 'reply',
        isComposerMutating: false,
      }),
    ).toBe(false);
  });

  test('답글 작성 중에는 다른 답글 대상으로만 전환할 수 있다', () => {
    expect(
      canStartCommentNavigation({
        currentMode: 'reply',
        destination: 'reply',
        isComposerMutating: false,
      }),
    ).toBe(true);
    expect(
      canStartCommentNavigation({
        currentMode: 'reply',
        destination: 'thread',
        isComposerMutating: false,
      }),
    ).toBe(false);
    expect(
      canStartCommentNavigation({
        currentMode: 'reply',
        destination: 'edit',
        isComposerMutating: false,
      }),
    ).toBe(false);
  });

  test('전송 중에는 답글 대상 전환도 막는다', () => {
    expect(
      canStartCommentNavigation({
        currentMode: 'reply',
        destination: 'reply',
        isComposerMutating: true,
      }),
    ).toBe(false);
  });
});
