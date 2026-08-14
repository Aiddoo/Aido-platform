/**
 * EncryptionService 단위 테스트
 *
 * @description
 * EncryptionService의 개별 메서드를 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test encryption.service
 * ```
 */
import type { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

import { EncryptionService } from "./encryption.service";

describe("EncryptionService — 암호화 서비스", () => {
	let service: EncryptionService;

	beforeEach(() => {
		// Given - Mock 설정 서비스
		const mockConfigService = {
			tokenEncryptionKey: "test-encryption-key-must-be-at-least-32-characters-long",
			get: jest.fn().mockReturnValue(undefined),
		} as unknown as TypedConfigService;

		service = new EncryptionService(mockConfigService);
	});

	describe("encrypt / decrypt", () => {
		it("암호화 후 복호화하면 원본 텍스트를 반환한다", () => {
			// Given
			const plaintext = "my-secret-oauth-token";

			// When
			const encrypted = service.encrypt(plaintext);
			const decrypted = service.decrypt(encrypted);

			// Then
			expect(decrypted).toBe(plaintext);
		});

		it("같은 평문을 두 번 암호화하면 다른 결과를 반환한다 (랜덤 IV)", () => {
			// Given
			const plaintext = "my-secret-oauth-token";

			// When
			const encrypted1 = service.encrypt(plaintext);
			const encrypted2 = service.encrypt(plaintext);

			// Then
			expect(encrypted1).not.toBe(encrypted2);
		});

		it("빈 문자열도 암호화/복호화할 수 있다", () => {
			// Given
			const plaintext = "";

			// When
			const encrypted = service.encrypt(plaintext);
			const decrypted = service.decrypt(encrypted);

			// Then
			expect(decrypted).toBe(plaintext);
		});

		it("유니코드 문자열도 암호화/복호화할 수 있다", () => {
			// Given
			const plaintext = "한글 테스트 토큰 🔑";

			// When
			const encrypted = service.encrypt(plaintext);
			const decrypted = service.decrypt(encrypted);

			// Then
			expect(decrypted).toBe(plaintext);
		});

		it("잘못된 ciphertext 형식이면 에러를 던진다", () => {
			// Given
			const invalidCiphertext = "invalid-format";

			// When & Then
			expect(() => service.decrypt(invalidCiphertext)).toThrow("Invalid ciphertext format");
		});

		it("변조된 ciphertext는 복호화에 실패한다", () => {
			// Given
			const encrypted = service.encrypt("test");
			const parts = encrypted.split(":");
			parts[1] = Buffer.from("tampered-auth-tag").toString("base64");
			const tampered = parts.join(":");

			// When & Then
			expect(() => service.decrypt(tampered)).toThrow();
		});
	});

	describe("isEncrypted", () => {
		it("암호화된 문자열을 올바르게 판별한다", () => {
			// Given
			const encrypted = service.encrypt("test-token");

			// When
			const result = service.isEncrypted(encrypted);

			// Then
			expect(result).toBe(true);
		});

		it("평문을 암호화되지 않은 것으로 판별한다", () => {
			// Given
			const plaintext = "plain-text-token";

			// When
			const result = service.isEncrypted(plaintext);

			// Then
			expect(result).toBe(false);
		});

		it("콜론이 포함되어 있어도 3파트가 아니면 false를 반환한다", () => {
			// Given
			const twoParts = "a:b";
			const fourParts = "a:b:c:d";

			// When & Then
			expect(service.isEncrypted(twoParts)).toBe(false);
			expect(service.isEncrypted(fourParts)).toBe(false);
		});
	});

	describe("decryptSafe", () => {
		it("암호화된 값은 복호화한다", () => {
			// Given
			const plaintext = "my-token";
			const encrypted = service.encrypt(plaintext);

			// When
			const result = service.decryptSafe(encrypted);

			// Then
			expect(result).toBe(plaintext);
		});

		it("평문은 그대로 반환한다", () => {
			// Given
			const plaintext = "plain-text-token";

			// When
			const result = service.decryptSafe(plaintext);

			// Then
			expect(result).toBe(plaintext);
		});
	});
});
