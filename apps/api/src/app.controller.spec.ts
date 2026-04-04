/**
 * AppController 컨트롤러 단위 테스트
 *
 * @description
 * AppController의 엔드포인트 핸들러를 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test app.controller
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController — 앱 컨트롤러", () => {
	let appController: AppController;
	let appService: Mocked<AppService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AppController).compile();

		appController = unit;
		appService = unitRef.get(AppService);
	});

	describe("root", () => {
		it('"Hello World!"를 반환해야 한다', () => {
			// Given
			appService.getHello.mockReturnValue("Hello World!");

			// When & Then
			expect(appController.getHello()).toBe("Hello World!");
		});
	});
});
