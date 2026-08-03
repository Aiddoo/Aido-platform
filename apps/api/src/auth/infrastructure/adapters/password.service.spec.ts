/**
 * PasswordService 단위 테스트
 *
 * @description
 * 비밀번호 해싱, 검증, 리해싱 필요 여부 판단 로직을 검증한다.
 * argon2 기반 해싱의 일방향성, 솔트 유일성을 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test password.service.spec.ts
 * ```
 */

import { TestBed } from "@suites/unit";
import { PasswordService } from "@/auth/infrastructure/adapters/password.service";

describe("PasswordService — 비밀번호 서비스", () => {
	let service: PasswordService;

	beforeEach(async () => {
		const { unit } = await TestBed.solitary(PasswordService).compile();

		service = unit;
	});

	describe("hash", () => {
		it("비밀번호를 해싱한다", async () => {
			// Given
			const password = "Test1234@";

			// When
			const hash = await service.hash(password);

			// Then
			expect(hash).toBeDefined();
			expect(hash).not.toBe(password);
			expect(hash.length).toBeGreaterThan(0);
		});

		it("같은 비밀번호도 매번 다른 해시를 생성한다", async () => {
			// Given
			const password = "Test1234@";

			// When
			const hash1 = await service.hash(password);
			const hash2 = await service.hash(password);

			// Then
			expect(hash1).not.toBe(hash2);
		});
	});

	describe("verify", () => {
		it("올바른 비밀번호는 검증을 통과한다", async () => {
			// Given
			const password = "Test1234@";
			const hash = await service.hash(password);

			// When
			const result = await service.verify(hash, password);

			// Then
			expect(result).toBe(true);
		});

		it("잘못된 비밀번호는 검증에 실패한다", async () => {
			// Given
			const password = "Test1234@";
			const wrongPassword = "WrongPassword@";
			const hash = await service.hash(password);

			// When
			const result = await service.verify(hash, wrongPassword);

			// Then
			expect(result).toBe(false);
		});

		it("빈 비밀번호는 검증에 실패한다", async () => {
			// Given
			const password = "Test1234@";
			const hash = await service.hash(password);

			// When
			const result = await service.verify(hash, "");

			// Then
			expect(result).toBe(false);
		});
	});

	describe("기존 배포 해시 호환 — 회귀 방지", () => {
		// argon2 0.44.0(v1.8.0 배포분)이 현재 ARGON2_CONFIG로 생성한 실제 해시.
		// argon2를 올릴 때 이 검증이 깨지면 기존 유저 전원이 로그인 불가가 되므로
		// 라이브러리 업그레이드의 하드 게이트로 둔다.
		const LEGACY_PASSWORD = "Test1234!aido";
		const LEGACY_HASH =
			"$argon2id$v=19$m=65536,t=3,p=4$qJNCpGrN4QL1DvhstoOKug$1HwvaTmVjDQf/5kSpxii/rdbpQxrg+dhl4/S9imXAFI";

		it("구버전에서 생성된 해시로도 로그인 검증에 성공한다", async () => {
			// When
			const result = await service.verify(LEGACY_HASH, LEGACY_PASSWORD);

			// Then
			expect(result).toBe(true);
		});

		it("구버전 해시에 잘못된 비밀번호는 여전히 거부한다", async () => {
			// When
			const result = await service.verify(LEGACY_HASH, "WrongPassword@");

			// Then
			expect(result).toBe(false);
		});

		it("구버전 해시는 현재 설정과 동일하므로 리해싱이 필요없다", () => {
			// When
			const result = service.needsRehash(LEGACY_HASH);

			// Then
			expect(result).toBe(false);
		});
	});

	describe("needsRehash", () => {
		it("유효한 해시는 리해싱이 필요없다고 반환한다", async () => {
			// Given
			const password = "Test1234@";
			const hash = await service.hash(password);

			// When
			const result = await service.needsRehash(hash);

			// Then
			expect(result).toBe(false);
		});
	});
});
