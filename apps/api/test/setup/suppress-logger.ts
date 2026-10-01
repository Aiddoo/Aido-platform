import { Logger } from "@nestjs/common";
/**
 * Logger 출력 억제 헬퍼
 *
 * @description
 * 통합 테스트에서 Logger 출력을 비활성화하여 테스트 출력을 깔끔하게 유지합니다.
 * beforeAll에서 호출하세요.
 */
import { vi } from "vitest";

export function suppressLogger(): void {
	vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
	vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
	vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
	vi.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
}
