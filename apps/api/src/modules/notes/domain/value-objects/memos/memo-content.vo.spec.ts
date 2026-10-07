import { ErrorCode } from "@aido/api/errors";
import { MEMO_LIMITS } from "@aido/api/vocabulary";

import { MemoContent } from "./memo-content.vo.js";

describe("MemoContent 내용 검증·할 일 제목", () => {
  it.each([0, MEMO_LIMITS.MAX_CONTENT_LENGTH + 1])(
    "허용 길이를 벗어난 내용(%i자)은 기존 오류 정보를 반환한다",
    (length) => {
      // Given
      const content = "가".repeat(length);

      // When / Then
      expect(() => MemoContent.of(content)).toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.SYS_0002,
          details: { field: "content", length },
        }),
      );
    },
  );

  it.each([1, MEMO_LIMITS.MAX_CONTENT_LENGTH])(
    "경계값(%i자)의 내용과 공백을 그대로 보존한다",
    (length) => {
      // Given
      const content = " ".repeat(length);

      // When
      const value = MemoContent.of(content);

      // Then
      expect(value.value).toBe(content);
    },
  );

  it.each([199, 200, 201, 300])(
    "할 일 변환은 %i자 메모에서 기존 앞 200자 계약을 유지한다",
    (length) => {
      // Given
      const content = "가".repeat(length);

      // When
      const title = MemoContent.of(content).toTodoTitle();

      // Then
      expect(title).toBe(content.substring(0, 200));
    },
  );
});
