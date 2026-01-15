import { Test, type TestingModule } from "@nestjs/testing";
import { PasswordService } from "./password.service";

describe("PasswordService", () => {
	let service: PasswordService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [PasswordService],
		}).compile();

		service = module.get<PasswordService>(PasswordService);
	});

	describe("hash", () => {
		it("비밀번호를 해싱한다", async () => {
			// Given
			const password = "Test1234!";

			// When
			const hash = await service.hash(password);

			// Then
			expect(hash).toBeDefined();
			expect(hash).not.toBe(password);
			expect(hash.length).toBeGreaterThan(0);
		});

		it("같은 비밀번호도 매번 다른 해시를 생성한다", async () => {
			// Given
			const password = "Test1234!";

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
			const password = "Test1234!";
			const hash = await service.hash(password);

			// When
			const result = await service.verify(hash, password);

			// Then
			expect(result).toBe(true);
		});

		it("잘못된 비밀번호는 검증에 실패한다", async () => {
			// Given
			const password = "Test1234!";
			const wrongPassword = "WrongPassword!";
			const hash = await service.hash(password);

			// When
			const result = await service.verify(hash, wrongPassword);

			// Then
			expect(result).toBe(false);
		});

		it("빈 비밀번호는 검증에 실패한다", async () => {
			// Given
			const password = "Test1234!";
			const hash = await service.hash(password);

			// When
			const result = await service.verify(hash, "");

			// Then
			expect(result).toBe(false);
		});
	});

	describe("needsRehash", () => {
		it("유효한 해시는 리해싱이 필요없다고 반환한다", async () => {
			// Given
			const password = "Test1234!";
			const hash = await service.hash(password);

			// When
			const result = await service.needsRehash(hash);

			// Then
			expect(result).toBe(false);
		});
	});
});
