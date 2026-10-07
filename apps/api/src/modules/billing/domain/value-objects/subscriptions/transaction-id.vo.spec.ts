import { ErrorCode } from "@aido/api/errors";

import { TransactionId } from "./transaction-id.vo.js";

describe("TransactionId — 갱신 체인 식별과 기존 누락 의미", () => {
  it.each([null, undefined])("원 거래 ID가 %s이면 개별 거래 ID를 사용한다", (original) => {
    // Given
    const transaction = "transaction-1";

    // When
    const id = TransactionId.resolve(original, transaction, "RENEWAL");

    // Then
    expect(id.value).toBe(transaction);
  });

  it("원 거래 ID가 있으면 갱신 거래 ID보다 우선한다", () => {
    // Given
    const original = "original-1";

    // When
    const id = TransactionId.resolve(original, "transaction-2", "RENEWAL");

    // Then
    expect(id.value).toBe(original);
  });

  it("빈 원 거래 ID는 기존 계약처럼 개별 거래로 대체하지 않고 누락 오류를 반환한다", () => {
    // Given
    const resolve = () => TransactionId.resolve("", "transaction-1", "EXPIRATION");

    // When / Then
    expect(resolve).toThrow(
      expect.objectContaining({
        errorCode: ErrorCode.SUBSCRIPTION_1604,
        details: {
          reason: "Missing transaction_id and original_transaction_id",
          eventType: "EXPIRATION",
        },
      }),
    );
  });
});
