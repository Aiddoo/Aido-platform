/**
 * Weather E2E 테스트
 *
 * @description
 * 날씨 API 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 *
 * 테스트 시나리오:
 * 1. 위치 등록/수정 (PUT /weather/location)
 * 2. 날씨 예보 조회 (GET /weather/forecast)
 * 3. 날씨 부가 정보 조회 (GET /weather/conditions)
 *
 * 실행 명령:
 * pnpm --filter @aido/api test:e2e -- weather.e2e-spec
 */

import request from "supertest";
import {
	createE2eApp,
	destroyE2eApp,
	type E2eTestContext,
	type VerifiedUser,
} from "./helpers";

describe("Weather (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	describe("위치 등록", () => {
		const userEmail = "weather-location@example.com";
		const password = "Test1234!";

		let user: VerifiedUser;

		beforeAll(async () => {
			user = await ctx.helpers.createVerifiedUser(userEmail, password);
		});

		describe("PUT /weather/location - 위치 등록/수정", () => {
			it("유효한 좌표로 위치를 등록한다", async () => {
				// Given - 인증된 사용자와 유효한 한국 좌표

				// When - 위치 등록 API 호출
				const response = await request(ctx.app.getHttpServer())
					.put("/weather/location")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({ latitude: 37.5665, longitude: 126.978 })
					.expect(200);

				// Then - 위치 등록 성공 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.latitude).toBe(37.5665);
				expect(response.body.data.longitude).toBe(126.978);
				expect(response.body.data.gridX).toBeDefined();
				expect(response.body.data.gridY).toBeDefined();
			});

			it("위치를 수정하면 새 좌표가 반환된다", async () => {
				// Given - 이미 위치가 등록된 사용자

				// When - 새 좌표로 위치 수정
				const response = await request(ctx.app.getHttpServer())
					.put("/weather/location")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({ latitude: 35.1796, longitude: 129.0756 })
					.expect(200);

				// Then - 수정된 좌표 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.latitude).toBe(35.1796);
				expect(response.body.data.longitude).toBe(129.0756);
			});

			it("범위를 벗어난 위도이면 400 에러 반환", async () => {
				// Given - 한국 범위를 벗어난 위도 (33.0~39.0)

				// When - 범위 밖 좌표로 요청
				const response = await request(ctx.app.getHttpServer())
					.put("/weather/location")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({ latitude: 50.0, longitude: 126.978 })
					.expect(400);

				// Then - 유효성 검증 에러 검증
				expect(response.body.success).toBe(false);
			});

			it("범위를 벗어난 경도이면 400 에러 반환", async () => {
				// Given - 한국 범위를 벗어난 경도 (124.0~132.0)

				// When - 범위 밖 좌표로 요청
				const response = await request(ctx.app.getHttpServer())
					.put("/weather/location")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({ latitude: 37.5665, longitude: 100.0 })
					.expect(400);

				// Then - 유효성 검증 에러 검증
				expect(response.body.success).toBe(false);
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 위치 등록 API 호출
				await request(ctx.app.getHttpServer())
					.put("/weather/location")
					.send({ latitude: 37.5665, longitude: 126.978 })
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});
	});

	describe("날씨 예보 조회", () => {
		const userEmail = "weather-forecast@example.com";
		const password = "Test1234!";

		let user: VerifiedUser;

		beforeAll(async () => {
			user = await ctx.helpers.createVerifiedUser(userEmail, password);
		});

		describe("GET /weather/forecast - 날씨 예보 조회", () => {
			it("위치 미등록 시 WEATHER_1902 에러 반환", async () => {
				// Given - 위치를 등록하지 않은 사용자

				// When - 예보 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/weather/forecast")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(404);

				// Then - 위치 미등록 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("WEATHER_1902");
			});

			it("위치 등록 후 예보를 조회한다", async () => {
				// Given - 위치가 등록된 사용자
				await request(ctx.app.getHttpServer())
					.put("/weather/location")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({ latitude: 37.5665, longitude: 126.978 })
					.expect(200);

				// When - 예보 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/weather/forecast")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				// Then - 예보 응답 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.skyCondition).toBeDefined();
				expect(response.body.data.temperatureMin).toBeDefined();
				expect(response.body.data.temperatureMax).toBeDefined();
				expect(response.body.data.hourlyForecasts).toBeInstanceOf(Array);
				expect(response.body.data.dailyForecasts).toBeInstanceOf(Array);
				expect(response.body.data.latitude).toBe(37.5665);
				expect(response.body.data.longitude).toBe(126.978);
			});

			it("date 파라미터로 특정 날짜 예보를 조회한다", async () => {
				// Given - 위치가 등록된 사용자

				// When - 특정 날짜 예보 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/weather/forecast")
					.query({ date: "2026-04-04" })
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				// Then - 예보 응답 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.skyCondition).toBeDefined();
			});

			it("잘못된 date 형식이면 400 에러 반환", async () => {
				// Given - 잘못된 날짜 형식

				// When - 잘못된 date 파라미터로 요청
				const response = await request(ctx.app.getHttpServer())
					.get("/weather/forecast")
					.query({ date: "invalid-date" })
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(400);

				// Then - 유효성 검증 에러 검증
				expect(response.body.success).toBe(false);
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 예보 조회 API 호출
				await request(ctx.app.getHttpServer())
					.get("/weather/forecast")
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});
	});

	describe("날씨 부가 정보 조회", () => {
		const userEmail = "weather-conditions@example.com";
		const password = "Test1234!";

		let user: VerifiedUser;

		beforeAll(async () => {
			user = await ctx.helpers.createVerifiedUser(userEmail, password);
		});

		describe("GET /weather/conditions - 부가 정보 조회", () => {
			it("위치 미등록 시 WEATHER_1902 에러 반환", async () => {
				// Given - 위치를 등록하지 않은 사용자

				// When - 부가 정보 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/weather/conditions")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(404);

				// Then - 위치 미등록 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("WEATHER_1902");
			});

			it("위치 등록 후 부가 정보를 조회한다", async () => {
				// Given - 위치가 등록된 사용자
				await request(ctx.app.getHttpServer())
					.put("/weather/location")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({ latitude: 37.5665, longitude: 126.978 })
					.expect(200);

				// When - 부가 정보 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/weather/conditions")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				// Then - 부가 정보 응답 검증
				expect(response.body.success).toBe(true);
				const data = response.body.data;
				expect(data).toHaveProperty("feelsLikeTemperature");
				expect(data).toHaveProperty("uvIndex");
				expect(data).toHaveProperty("sunrise");
				expect(data).toHaveProperty("sunset");
				expect(data).toHaveProperty("pm10");
				expect(data).toHaveProperty("pm25");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 부가 정보 조회 API 호출
				await request(ctx.app.getHttpServer())
					.get("/weather/conditions")
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});
	});
});
