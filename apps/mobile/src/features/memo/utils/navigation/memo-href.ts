export function memoDetailHref(memoId: number) {
  return { pathname: '/memo/[memoId]', params: { memoId: String(memoId) } } as const;
}

export function memoAiReviewHref(memoId: number) {
  return { pathname: '/memo/[memoId]/ai-review', params: { memoId: String(memoId) } } as const;
}
