/** 지운 계정의 댓글을 넘겨받는 시스템 작성자. DB FK가 참조하지만 로그인·검색·추천 대상이 아니다 */
export const DELETED_COMMENT_AUTHOR = {
  id: "cm1deletedcommentauthor000001",
  // 공개 email·userTag validator가 받을 수 없는 DB 전용 식별자다
  email: "system:deleted-comment-author",
  userTag: "_DELETED",
} as const;
