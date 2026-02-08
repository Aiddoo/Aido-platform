/**
 * 기존 평문 OAuth 토큰을 AES-256-GCM으로 암호화하는 마이그레이션 스크립트
 *
 * 실행: npx tsx apps/api/prisma/migrations/encrypt-existing-tokens.ts
 *
 * 환경변수 TOKEN_ENCRYPTION_KEY 필요
 */

import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "../../src/generated/prisma/client";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT = "aido-token-encryption";

function encrypt(plaintext: string, key: Buffer): string {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});

	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

function isEncrypted(value: string): boolean {
	const parts = value.split(":");
	if (parts.length !== 3) return false;
	try {
		for (const part of parts) {
			Buffer.from(part, "base64");
		}
		return true;
	} catch {
		return false;
	}
}

async function main() {
	const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
	if (!encryptionKey || encryptionKey.length < 32) {
		console.error(
			"TOKEN_ENCRYPTION_KEY must be set and at least 32 characters",
		);
		process.exit(1);
	}

	const key = scryptSync(encryptionKey, SALT, KEY_LENGTH);
	const prisma = new PrismaClient();

	try {
		// Account 테이블 처리
		const accounts = await prisma.account.findMany({
			where: {
				OR: [{ accessToken: { not: null } }, { refreshToken: { not: null } }],
			},
			select: { id: true, accessToken: true, refreshToken: true },
		});

		let accountCount = 0;
		for (const account of accounts) {
			const updates: Record<string, string> = {};

			if (account.accessToken && !isEncrypted(account.accessToken)) {
				updates.accessToken = encrypt(account.accessToken, key);
			}
			if (account.refreshToken && !isEncrypted(account.refreshToken)) {
				updates.refreshToken = encrypt(account.refreshToken, key);
			}

			if (Object.keys(updates).length > 0) {
				await prisma.account.update({
					where: { id: account.id },
					data: updates,
				});
				accountCount++;
			}
		}
		console.log(`Encrypted tokens for ${accountCount} accounts`);

		// OAuthState 테이블 처리 (미교환 상태)
		const oauthStates = await prisma.oAuthState.findMany({
			where: {
				exchangedAt: null,
				OR: [{ accessToken: { not: null } }, { refreshToken: { not: null } }],
			},
			select: { id: true, accessToken: true, refreshToken: true },
		});

		let stateCount = 0;
		for (const state of oauthStates) {
			const updates: Record<string, string> = {};

			if (state.accessToken && !isEncrypted(state.accessToken)) {
				updates.accessToken = encrypt(state.accessToken, key);
			}
			if (state.refreshToken && !isEncrypted(state.refreshToken)) {
				updates.refreshToken = encrypt(state.refreshToken, key);
			}

			if (Object.keys(updates).length > 0) {
				await prisma.oAuthState.update({
					where: { id: state.id },
					data: updates,
				});
				stateCount++;
			}
		}
		console.log(`Encrypted tokens for ${stateCount} OAuth states`);

		console.log("Migration completed successfully");
	} finally {
		await prisma.$disconnect();
	}
}

main().catch(console.error);
