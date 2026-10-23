import { createFeedHref, isFeedPathname } from './feed-route';

describe('isFeedPathname', () => {
  it.each(['/feed', '/feed/friend/abc'])('%s는 피드 경로다', (pathname) => {
    expect(isFeedPathname(pathname)).toBe(true);
  });

  it.each(['/todo/7', '/memo', '/feedback', '/friends/search'])(
    '%s는 피드 경로가 아니다',
    (pathname) => {
      expect(isFeedPathname(pathname)).toBe(false);
    },
  );
});

describe('createFeedHref', () => {
  it('내 피드로 바꿀 때 날짜만 옮긴다', () => {
    expect(createFeedHref(null, '2026-10-23')).toEqual({
      pathname: '/feed',
      params: { date: '2026-10-23' },
    });
  });

  it('친구 피드로 바꿀 때 친구와 날짜만 담는다', () => {
    expect(createFeedHref('friend-1', '2026-10-23')).toEqual({
      pathname: '/feed/friend/[friendId]',
      params: { friendId: 'friend-1', date: '2026-10-23' },
    });
  });

  it('날짜가 없으면 오늘 피드로 간다', () => {
    expect(createFeedHref('friend-1', undefined)).toEqual({
      pathname: '/feed/friend/[friendId]',
      params: { friendId: 'friend-1' },
    });
  });

  it('선택된 할 일과 댓글 상태는 새 피드로 옮기지 않는다', () => {
    const href = createFeedHref(null, undefined);

    expect(href).toEqual({ pathname: '/feed', params: {} });
  });
});
