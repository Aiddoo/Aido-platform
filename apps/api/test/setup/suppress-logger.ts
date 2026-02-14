/**
 * Logger 출력 억제 헬퍼
 *
 * @description
 * 통합 테스트에서 Logger 출력을 비활성화하여 테스트 출력을 깔끔하게 유지합니다.
 * beforeAll에서 호출하세요.
 */

import { Logger } from "@nestjs/common";

export function suppressLogger(): void {
	jest.spyOn(Logger.prototype, "log").mockImplementation();
	jest.spyOn(Logger.prototype, "warn").mockImplementation();
	jest.spyOn(Logger.prototype, "error").mockImplementation();
	jest.spyOn(Logger.prototype, "debug").mockImplementation();
}
