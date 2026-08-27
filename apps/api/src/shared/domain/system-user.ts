/** DB FK가 참조하지만 로그인·검색·추천 대상이 아닌 플랫폼 내부 사용자입니다. */
export const DELETED_COMMENT_AUTHOR = {
	id: "cm1deletedcommentauthor000001",
	// 공개 email/userTag validator가 받을 수 없는 DB 전용 식별자입니다.
	email: "system:deleted-comment-author",
	userTag: "_DELETED",
} as const;

export const DELETED_COMMENT_AUTHOR_ID = DELETED_COMMENT_AUTHOR.id;
