/**
 * toErrorMessage 단위 테스트
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test error-message.util
 * ```
 */
import { toErrorMessage } from "./error-message.util";

describe("toErrorMessage — 에러 메시지 정규화", () => {
	it("Error 인스턴스는 message를 반환한다", () => {
		expect(toErrorMessage(new Error("boom"))).toBe("boom");
	});

	it("Error가 아닌 값은 문자열로 변환한다", () => {
		expect(toErrorMessage("raw")).toBe("raw");
		expect(toErrorMessage(42)).toBe("42");
		expect(toErrorMessage(undefined)).toBe("undefined");
	});
});
