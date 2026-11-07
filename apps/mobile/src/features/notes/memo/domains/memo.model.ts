import type { Memo, MemoResourceLimit } from '../schemas/memo.schema';

function canCreateMemo(limit: MemoResourceLimit) {
  return limit.currentCount < limit.maxPerUser;
}

function getMemoPreview(memo: Pick<Memo, 'content'>) {
  const [title = '', ...rest] = memo.content.trim().split('\n');

  return { title: title.trim(), body: rest.join('\n').trim() };
}

export const MemoPolicy = {
  canCreateMemo,
  getMemoPreview,
} as const;
