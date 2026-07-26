/**
 * E2E 테스트 공유 헬퍼
 *
 * @description
 * 모든 E2E 테스트에서 반복되는 사용자 생성, 로그인, 친구 관계 설정 등을
 * 통일된 인터페이스로 제공합니다.
 */

import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { FakeEmailService } from "../../mocks/fake-email.service";

export interface VerifiedUser {
	accessToken: string;
	userId: string;
	userTag: string;
}

export class E2eHelpers {
	constructor(
		private readonly app: INestApplication,
		private readonly fakeEmailService: FakeEmailService,
	) {}

	/**
	 * 사용자 등록 (이메일 인증 전 단계)
	 */
	async registerUser(
		email: string,
		password: string,
		options?: { name?: string },
	): Promise<void> {
		await request(this.app.getHttpServer())
			.post("/v1/auth/register")
			.send({
				email,
				password,
				passwordConfirm: password,
				name: options?.name,
				termsAgreed: true,
				privacyAgreed: true,
			})
			.expect(201);
	}

	/**
	 * 이메일 인증 + 토큰 반환
	 */
	async verifyUser(email: string): Promise<string> {
		const code = this.fakeEmailService.getLastCode(email);
		const response = await request(this.app.getHttpServer())
			.post("/v1/auth/verify-email")
			.send({ email, code })
			.expect(200);

		return response.body.data.accessToken;
	}

	/**
	 * 사용자 등록 + 이메일 인증 + 토큰 반환
	 */
	async createVerifiedUser(
		email: string,
		password: string,
		options?: { name?: string },
	): Promise<VerifiedUser> {
		// 회원가입
		await this.registerUser(email, password, options);

		// 이메일 인증
		const code = this.fakeEmailService.getLastCode(email);
		const response = await request(this.app.getHttpServer())
			.post("/v1/auth/verify-email")
			.send({ email, code })
			.expect(200);

		return {
			accessToken: response.body.data.accessToken,
			userId: response.body.data.userId,
			userTag: response.body.data.userTag,
		};
	}

	/**
	 * 로그인 후 토큰 반환
	 */
	async loginUser(
		email: string,
		password: string,
	): Promise<{ accessToken: string; refreshToken: string }> {
		const response = await request(this.app.getHttpServer())
			.post("/v1/auth/login")
			.send({ email, password })
			.expect(200);

		return {
			accessToken: response.body.data.accessToken,
			refreshToken: response.body.data.refreshToken,
		};
	}

	/**
	 * 두 사용자 간 양방향 친구 관계 생성
	 */
	async createFriendship(
		user1: VerifiedUser,
		user2: VerifiedUser,
	): Promise<void> {
		// user1 -> user2 팔로우 요청
		await request(this.app.getHttpServer())
			.post(`/v1/follows/${user2.userTag}`)
			.set("Authorization", `Bearer ${user1.accessToken}`)
			.expect(201);

		// user2 -> user1 맞팔로우 (친구 성립)
		await request(this.app.getHttpServer())
			.post(`/v1/follows/${user1.userTag}`)
			.set("Authorization", `Bearer ${user2.accessToken}`)
			.expect(201);
	}

	/**
	 * 기본 카테고리 ID 조회
	 */
	async getDefaultCategoryId(accessToken: string): Promise<number> {
		const response = await request(this.app.getHttpServer())
			.get("/v1/todo-categories")
			.set("Authorization", `Bearer ${accessToken}`)
			.expect(200);

		const categories = response.body.data.items;
		const defaultCategory =
			categories.find((c: { name: string }) => c.name === "할 일") ||
			categories[0];
		return defaultCategory.id;
	}
}
