import type { Memo } from '../schemas/memo.schema';

/** 카드에 보이는 제목(첫 줄)과 본문(나머지) */
export function toMemoPreview(memo: Pick<Memo, 'content'>) {
  const [title = '', ...rest] = memo.content.trim().split('\n');

  return { title: title.trim(), body: rest.join('\n').trim() };
}
