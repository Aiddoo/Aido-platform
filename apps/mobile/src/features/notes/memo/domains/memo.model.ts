import type { Memo, MemoResourceLimit } from '../schemas/memo.schema';

function canCreateMemo(limit: MemoResourceLimit) {
  return limit.currentCount < limit.maxPerUser;
}

/** 저장은 앞뒤 공백을 빼고 하므로 공백만 고친 글자는 바뀐 것이 아니다 */
function hasContentChanged(memo: Pick<Memo, 'content'>, content: string) {
  return content.trim() !== memo.content;
}

export const MemoPolicy = {
  canCreateMemo,
  hasContentChanged,
} as const;
