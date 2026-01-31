import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

import { ARGON2_CONFIG } from "../constants/auth.constants";

/**
 * Argon2id 기반 비밀번호 해싱 서비스
 *
 * OWASP 권장 설정 사용:
 * - memoryCost: 64MB (65536 KB)
 * - timeCost: 3 iterations
 * - parallelism: 4 threads
 * - hashLength: 32 bytes
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */
@Injectable()
export class PasswordService {
	private readonly hashOptions: argon2.Options = {
		type: argon2.argon2id,
		memoryCost: ARGON2_CONFIG.MEMORY_COST,
		timeCost: ARGON2_CONFIG.TIME_COST,
		parallelism: ARGON2_CONFIG.PARALLELISM,
		hashLength: ARGON2_CONFIG.HASH_LENGTH,
	};

	async hash(password: string): Promise<string> {
		return argon2.hash(password, this.hashOptions);
	}

	async verify(hash: string, password: string): Promise<boolean> {
		try {
			return await argon2.verify(hash, password);
		} catch {
			// 잘못된 해시 형식 등의 오류 시 false 반환
			return false;
		}
	}

	// 보안 파라미터가 변경되었을 때 기존 해시를 새 설정으로 재해싱해야 하는지 확인
	needsRehash(hash: string): boolean {
		return argon2.needsRehash(hash, this.hashOptions);
	}
}
