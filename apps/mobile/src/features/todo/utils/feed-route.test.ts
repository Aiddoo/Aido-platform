import { createFeedFriendParams, createFeedHref } from './feed-route';

describe('createFeedHref', () => {
  it('내 피드는 friendId 없이 날짜만 담는다', () => {
    expect(createFeedHref({ date: '2026-10-23' })).toEqual({
      pathname: '/feed',
      params: { date: '2026-10-23' },
    });
  });

  it('친구 피드는 같은 피드 화면에 friendId와 날짜를 담는다', () => {
    expect(createFeedHref({ friendId: 'friend-1', date: 'today' })).toEqual({
      pathname: '/feed',
      params: { friendId: 'friend-1', date: 'today' },
    });
  });

  it('날짜가 없으면 오늘 피드로 간다', () => {
    expect(createFeedHref({ friendId: 'friend-1' })).toEqual({
      pathname: '/feed',
      params: { friendId: 'friend-1' },
    });
  });

  it('재료가 없으면 오늘의 내 피드로 간다', () => {
    expect(createFeedHref()).toEqual({ pathname: '/feed', params: {} });
  });
});

describe('createFeedFriendParams', () => {
  it('친구를 바꾸면 이전 할 일 선택·댓글·요청 상태를 지운다', () => {
    expect(createFeedFriendParams('friend-1')).toEqual({
      friendId: 'friend-1',
      todoId: undefined,
      comment: undefined,
      intent: undefined,
      returnTo: undefined,
      sort: undefined,
      action: undefined,
    });
  });

  it('나를 고르면 friendId를 지운다', () => {
    expect(createFeedFriendParams(undefined)).toEqual(
      expect.objectContaining({ friendId: undefined }),
    );
  });
});
