import type { TypedConfigService } from "@/common/config/services/config.service";
import { EncryptionService } from "./encryption.service";

describe("EncryptionService", () => {
	let service: EncryptionService;

	beforeEach(() => {
		const mockConfigService = {
			tokenEncryptionKey:
				"test-encryption-key-must-be-at-least-32-characters-long",
			get: jest.fn().mockReturnValue(undefined),
		} as unknown as TypedConfigService;

		service = new EncryptionService(mockConfigService);
	});

	describe("encrypt / decrypt", () => {
		it("암호화 후 복호화하면 원본 텍스트를 반환한다", () => {
			const plaintext = "my-secret-oauth-token";

			const encrypted = service.encrypt(plaintext);
			const decrypted = service.decrypt(encrypted);

			expect(decrypted).toBe(plaintext);
		});

		it("같은 평문을 두 번 암호화하면 다른 결과를 반환한다 (랜덤 IV)", () => {
			const plaintext = "my-secret-oauth-token";

			const encrypted1 = service.encrypt(plaintext);
			const encrypted2 = service.encrypt(plaintext);

			expect(encrypted1).not.toBe(encrypted2);
		});

		it("빈 문자열도 암호화/복호화할 수 있다", () => {
			const plaintext = "";

			const encrypted = service.encrypt(plaintext);
			const decrypted = service.decrypt(encrypted);

			expect(decrypted).toBe(plaintext);
		});

		it("유니코드 문자열도 암호화/복호화할 수 있다", () => {
			const plaintext = "한글 테스트 토큰 🔑";

			const encrypted = service.encrypt(plaintext);
			const decrypted = service.decrypt(encrypted);

			expect(decrypted).toBe(plaintext);
		});

		it("잘못된 ciphertext 형식이면 에러를 던진다", () => {
			expect(() => service.decrypt("invalid-format")).toThrow(
				"Invalid ciphertext format",
			);
		});

		it("변조된 ciphertext는 복호화에 실패한다", () => {
			const encrypted = service.encrypt("test");
			const parts = encrypted.split(":");
			// authTag 변조
			parts[1] = Buffer.from("tampered-auth-tag").toString("base64");
			const tampered = parts.join(":");

			expect(() => service.decrypt(tampered)).toThrow();
		});
	});

	describe("isEncrypted", () => {
		it("암호화된 문자열을 올바르게 판별한다", () => {
			const encrypted = service.encrypt("test-token");

			expect(service.isEncrypted(encrypted)).toBe(true);
		});

		it("평문을 암호화되지 않은 것으로 판별한다", () => {
			expect(service.isEncrypted("plain-text-token")).toBe(false);
		});

		it("콜론이 포함되어 있어도 3파트가 아니면 false를 반환한다", () => {
			expect(service.isEncrypted("a:b")).toBe(false);
			expect(service.isEncrypted("a:b:c:d")).toBe(false);
		});
	});

	describe("decryptSafe", () => {
		it("암호화된 값은 복호화한다", () => {
			const plaintext = "my-token";
			const encrypted = service.encrypt(plaintext);

			expect(service.decryptSafe(encrypted)).toBe(plaintext);
		});

		it("평문은 그대로 반환한다", () => {
			const plaintext = "plain-text-token";

			expect(service.decryptSafe(plaintext)).toBe(plaintext);
		});
	});
});
