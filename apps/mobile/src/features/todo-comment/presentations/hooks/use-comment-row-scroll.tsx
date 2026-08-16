import { createContext, use } from 'react';

type ScrollRowToTop = (commentId: string) => void;

/**
 * 목록이 자기 스크롤을 아래로 흘려보내는 자리.
 * 행 안쪽에서 시트를 열 때 그 행을 맨 위로 올려, 무엇에 쓰는지가 시트 위에 계속 보이게 한다.
 * 목록 밖(스레드 머리말 등)에서는 올릴 곳이 없으므로 아무 일도 하지 않는다.
 */
export const CommentRowScrollContext = createContext<ScrollRowToTop>(() => {});

export function useCommentRowScroll(): ScrollRowToTop {
  return use(CommentRowScrollContext);
}
