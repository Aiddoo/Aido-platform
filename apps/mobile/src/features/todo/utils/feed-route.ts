import type { Href } from 'expo-router';

export function isFeedPathname(pathname: string): boolean {
  return pathname === '/feed' || pathname.startsWith('/feed/');
}

/** 이전 피드의 할 일 선택·댓글 상태는 옮기지 않고 날짜만 유지한다. */
export function createFeedHref(friendId: string | null, date: string | undefined): Href {
  const dateParams = date === undefined ? {} : { date };

  if (friendId === null) {
    return { pathname: '/feed', params: dateParams };
  }

  return { pathname: '/feed/friend/[friendId]', params: { friendId, ...dateParams } };
}
