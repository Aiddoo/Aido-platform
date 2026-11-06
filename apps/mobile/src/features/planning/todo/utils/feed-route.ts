interface FeedHrefParams {
  friendId?: string;
  date?: string;
}

/** 피드는 한 화면이고 친구·날짜는 query param으로 고른다. */
export function createFeedHref({ friendId, date }: FeedHrefParams = {}) {
  return {
    pathname: '/feed',
    params: { ...(friendId != null && { friendId }), ...(date != null && { date }) },
  } as const;
}

/** 피드를 열고 오늘 할 일 만들기 시트를 바로 띄운다(위젯 만들기·첫 할 일 안내) */
export function createFeedAddTodoHref() {
  return { pathname: '/feed', params: { action: 'add-todo' } } as const;
}

/** 친구를 바꾸면 날짜만 유지하고 이전 피드의 할 일 선택·댓글·요청 상태는 지운다. */
export function createFeedFriendParams(friendId: string | undefined) {
  return {
    friendId,
    todoId: undefined,
    comment: undefined,
    intent: undefined,
    returnTo: undefined,
    sort: undefined,
    action: undefined,
  };
}
