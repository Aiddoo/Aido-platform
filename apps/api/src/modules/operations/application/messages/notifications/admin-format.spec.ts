import { formatPrice } from "./admin-format.js";

describe("admin-format — 운영 알림 표시", () => {
  describe("formatPrice", () => {
    it("통화 코드가 있으면 통화 포맷으로 변환한다", () => {
      // Given
      const price = 1000;

      // When
      const formatted = formatPrice(price, "KRW");

      // Then
      expect(formatted).toContain("1,000");
    });

    it("통화 코드가 없으면 숫자만 표시한다", () => {
      // Given
      const price = 1000;

      // When
      const formatted = formatPrice(price);

      // Then
      expect(formatted).toBe("1,000");
    });
  });
});
