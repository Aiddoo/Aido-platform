import { ErrorCode } from "@aido/api/errors";
import { MEMO_LIMITS, TODO_LIMITS } from "@aido/api/vocabulary";

import { MemoContent } from "./memo-content.vo.js";

describe("MemoContent 내용 검증·할 일 제목", () => {
  it.each([0, MEMO_LIMITS.MAX_CONTENT_LENGTH + 1])(
    "허용 길이를 벗어난 내용(%i자)은 SYS_0002와 길이를 담아 거절한다",
    (length) => {
      // Given
      const raw = "가".repeat(length);

      // When
      const create = () => MemoContent.create(raw);

      // Then
      expect(create).toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.SYS_0002,
          details: { field: "content", length },
        }),
      );
    },
  );

  it.each([1, MEMO_LIMITS.MAX_CONTENT_LENGTH])(
    "경계값(%i자)의 공백도 그대로 보존한다",
    (length) => {
      // Given
      const raw = " ".repeat(length);

      // When
      const content = MemoContent.create(raw);

      // Then
      expect(content.value).toBe(raw);
    },
  );

  it("저장된 값은 한도가 줄어도 검증 없이 복원한다", () => {
    // Given
    const stored = "가".repeat(MEMO_LIMITS.MAX_CONTENT_LENGTH + 1);

    // When
    const content = MemoContent.reconstitute(stored);

    // Then
    expect(content.value).toBe(stored);
  });

  it.each([199, 200, 201, 300])("할 일 제목은 %i자 메모의 앞 200자다", (length) => {
    // Given
    const raw = "가".repeat(length);

    // When
    const title = MemoContent.create(raw).toTodoTitle();

    // Then
    expect(title).toBe(raw.slice(0, TODO_LIMITS.TITLE_MAX_LENGTH));
  });
});
