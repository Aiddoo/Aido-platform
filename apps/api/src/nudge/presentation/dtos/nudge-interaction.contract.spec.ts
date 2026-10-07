import {
  getNudgeInteractionsQuerySchema,
  replyToNudgeSchema,
  sendNudgeThanksSchema,
} from "@aido/validators";

describe("콕 주고받기 요청 계약", () => {
  it("쿼리를 생략하면 받은 콕 20개부터 조회한다", () => {
    // Given
    const query = {};

    // When
    const result = getNudgeInteractionsQuerySchema.parse(query);

    // Then
    expect(result).toEqual({ direction: "received", limit: 20 });
  });

  it("URL 문자열 커서와 개수를 숫자로 검증한다", () => {
    // Given
    const query = { direction: "sent", cursor: "42", limit: "10" };

    // When
    const result = getNudgeInteractionsQuerySchema.parse(query);

    // Then
    expect(result).toEqual({ direction: "sent", cursor: 42, limit: 10 });
  });

  it.each(["STARTING", "THANKFUL", "LATER"])("%s 답장을 허용한다", (replyKind) => {
    // Given
    const input = { replyKind };

    // When
    const result = replyToNudgeSchema.safeParse(input);

    // Then
    expect(result.success).toBe(true);
  });

  it("실제 완료로 오해할 수 있는 COMPLETED 답장을 받지 않는다", () => {
    // Given
    const input = { replyKind: "COMPLETED" };

    // When
    const result = replyToNudgeSchema.safeParse(input);

    // Then
    expect(result.success).toBe(false);
  });

  it.each([{}, { throughNudgeId: 0 }, { throughNudgeId: -1 }])(
    "감사 요청은 유효한 미리보기 경계를 필수로 받는다: %j",
    (input) => {
      // Given
      const request = input;

      // When
      const result = sendNudgeThanksSchema.safeParse(request);

      // Then
      expect(result.success).toBe(false);
    },
  );
});
