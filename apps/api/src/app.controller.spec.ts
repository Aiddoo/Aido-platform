import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController", () => {
	let appController: AppController;
	let appService: Mocked<AppService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AppController).compile();

		appController = unit;
		appService = unitRef.get(AppService) as unknown as Mocked<AppService>;
	});

	describe("root", () => {
		it('should return "Hello World!"', () => {
			// Given
			appService.getHello.mockReturnValue("Hello World!");

			// When & Then
			expect(appController.getHello()).toBe("Hello World!");
		});
	});
});
