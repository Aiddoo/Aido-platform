import { TodoCommentLockKeys } from "./comments.lock-keys.js";

// 배포 중 옛 버전과 같은 잠금을 잡아야 해서 옮긴 문자열을 바이트 단위로 고정한다
describe("TodoCommentLockKeys", () => {
  it("댓글·댓글 요청 잠금 키는 옮기기 전 문자열과 같다", () => {
    // When
    const keys = [
      TodoCommentLockKeys.comment("comment-1"),
      TodoCommentLockKeys.request("author-1", "request-1"),
    ];

    // Then
    expect(keys).toEqual([
      "mutation:v1:todo-comment:comment-1",
      "mutation:v1:todo-comment-request:author-1:request-1",
    ]);
  });
});
