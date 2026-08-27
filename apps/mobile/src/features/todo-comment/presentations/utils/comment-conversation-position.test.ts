import {
  canFetchPreviousComments,
  getConversationThreadId,
  getFocusedCommentKeyboardLiftBehavior,
  getInitialCommentIndex,
  getKeyboardOpenCommentFocusOffset,
  getUnloadedCommentFocusOffset,
  toInitialConversationWindow,
} from './comment-conversation-position';

describe('comment conversation position', () => {
  const rows = [
    { comment: { id: 'first' } },
    { comment: { id: 'focused' } },
    { comment: { id: 'last' } },
  ];

  it('선택 댓글의 index를 첫 mount 위치로 준다', () => {
    expect(getInitialCommentIndex(rows, 'focused')).toBe(1);
  });

  it('focus가 없거나 응답에 없는 댓글이면 잘못된 index를 만들지 않는다', () => {
    expect(getInitialCommentIndex(rows, null)).toBeUndefined();
    expect(getInitialCommentIndex(rows, 'missing')).toBeUndefined();
  });

  it('서버가 준 focus 행의 thread를 list identity로 고른다', () => {
    const threadRows = [
      { comment: { id: 'first', threadId: 'thread-a' } },
      { comment: { id: 'focused', threadId: 'thread-a' } },
    ];

    expect(getConversationThreadId(threadRows, 'focused')).toBe('thread-a');
  });

  it('focus 행을 찾지 못하면 첫 행 thread를 쓰고 빈 목록이면 identity를 만들지 않는다', () => {
    const threadRows = [{ comment: { id: 'first', threadId: 'thread-a' } }];

    expect(getConversationThreadId(threadRows, 'missing')).toBe('thread-a');
    expect(getConversationThreadId([], 'missing')).toBeNull();
  });

  it('현재 window 밖 댓글은 header와 viewport를 반영한 한 좌표로 옮긴다', () => {
    expect(
      getUnloadedCommentFocusOffset({
        itemLayout: { y: 720, height: 120 },
        firstItemOffset: 240,
        viewportHeight: 700,
      }),
    ).toBeCloseTo(855.6);
  });

  it('첫 댓글의 계산 좌표가 위를 넘으면 0에서 멈춘다', () => {
    expect(
      getUnloadedCommentFocusOffset({
        itemLayout: { y: 0, height: 180 },
        firstItemOffset: 0,
        viewportHeight: 700,
      }),
    ).toBe(0);
  });

  it('중간 focus는 키보드가 열려도 현재 scroll offset을 유지한다', () => {
    expect(
      getFocusedCommentKeyboardLiftBehavior({
        itemLayout: { y: 280, height: 120 },
        firstItemOffset: 160,
        scrollOffset: 240,
        viewportHeight: 700,
      }),
    ).toBe('whenAtEnd');
  });

  it('하단에 걸친 focus는 키보드와 같이 UI thread에서 올린다', () => {
    expect(
      getFocusedCommentKeyboardLiftBehavior({
        itemLayout: { y: 650, height: 140 },
        firstItemOffset: 160,
        scrollOffset: 240,
        viewportHeight: 700,
      }),
    ).toBe('persistent');
  });

  it('측정 전 viewport로는 중간 위치 보존을 기본으로 쓴다', () => {
    expect(
      getFocusedCommentKeyboardLiftBehavior({
        itemLayout: { y: 650, height: 140 },
        firstItemOffset: 160,
        scrollOffset: 240,
        viewportHeight: 0,
      }),
    ).toBe('whenAtEnd');
  });

  it('현재 viewport 밖 focus는 위치 보정 전 좌표로 lift를 결정하지 않는다', () => {
    expect(
      getFocusedCommentKeyboardLiftBehavior({
        itemLayout: { y: 1_400, height: 140 },
        firstItemOffset: 160,
        scrollOffset: 240,
        viewportHeight: 700,
      }),
    ).toBe('whenAtEnd');
  });

  it('작성 바 성장분을 중복 차감하지 않고 열린 키보드 아래 focus만 필요한 만큼 드러낸다', () => {
    expect(
      getKeyboardOpenCommentFocusOffset({
        itemLayout: { y: 650, height: 140 },
        firstItemOffset: 160,
        scrollOffset: 500,
        viewportHeight: 700,
        keyboardHeight: 280,
      }),
    ).toBe(542);
  });

  it('이미 키보드 위에 보이는 focus나 viewport 밖 focus는 움직이지 않는다', () => {
    expect(
      getKeyboardOpenCommentFocusOffset({
        itemLayout: { y: 320, height: 120 },
        firstItemOffset: 160,
        scrollOffset: 240,
        viewportHeight: 700,
        keyboardHeight: 280,
      }),
    ).toBeNull();
    expect(
      getKeyboardOpenCommentFocusOffset({
        itemLayout: { y: 1_400, height: 120 },
        firstItemOffset: 160,
        scrollOffset: 240,
        viewportHeight: 700,
        keyboardHeight: 280,
      }),
    ).toBeNull();
  });

  it('초기 focus가 그려진 뒤에만 이전 page를 받을 수 있다', () => {
    expect(canFetchPreviousComments('LATEST:focused', null)).toBe(false);
    expect(canFetchPreviousComments('LATEST:focused', 'LATEST:other')).toBe(false);
    expect(canFetchPreviousComments('LATEST:focused', 'LATEST:focused')).toBe(true);
    expect(canFetchPreviousComments(null, null)).toBe(true);
  });

  it('prepend와 append 이력에서 focus 초기 window만 복원한다', () => {
    const data = {
      pages: ['earlier', 'focused', 'later'],
      pageParams: [
        { direction: 'before', cursor: 'before-cursor' },
        { direction: 'initial' },
        { direction: 'after', cursor: 'after-cursor' },
      ],
    };

    expect(toInitialConversationWindow(data)).toEqual({
      pages: ['focused'],
      pageParams: [{ direction: 'initial' }],
    });
  });

  it('초기 window 하나만 있으면 cache identity를 유지한다', () => {
    const data = {
      pages: ['focused'],
      pageParams: [{ direction: 'initial' }],
    };

    expect(toInitialConversationWindow(data)).toBe(data);
  });

  it('초기 page가 없는 깨진 cache는 복원하지 않는다', () => {
    expect(
      toInitialConversationWindow({
        pages: ['earlier'],
        pageParams: [{ direction: 'before', cursor: 'before-cursor' }],
      }),
    ).toBeNull();
  });
});
