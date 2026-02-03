/**
 * Jest Global Setup - E2E 테스트 전역 설정
 *
 * @description
 * 모든 E2E 테스트 파일이 로드되기 전에 실행됩니다.
 * Testcontainers로 PostgreSQL을 시작하고 DATABASE_URL을 파일에 저장합니다.
 *
 * 중요: Jest globalSetup은 별도 프로세스에서 실행되므로,
 * process.env 설정이 테스트 프로세스로 직접 전달되지 않습니다.
 * 대신 환경변수를 파일에 저장하고 setupFiles에서 읽어옵니다.
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

// 환경변수 파일 경로
const ENV_FILE_PATH = path.join(__dirname, ".e2e-env.json");

// 컨테이너 ID를 파일로 저장 (teardown에서 읽기 위함)
const CONTAINER_INFO_PATH = path.join(__dirname, ".e2e-container.json");

export default async function globalSetup(): Promise<void> {
	console.log("\n🚀 E2E Test Global Setup\n");

	const originalDatabaseUrl = process.env.DATABASE_URL;

	// USE_EXTERNAL_DB 환경변수가 있으면 외부 DB 사용 (CI 환경 등)
	if (process.env.USE_EXTERNAL_DB === "true" && originalDatabaseUrl) {
		console.log("📦 Using external database (USE_EXTERNAL_DB=true)");
		console.log(`   DATABASE_URL: ${originalDatabaseUrl}`);

		// 환경변수를 파일에 저장 (setupFiles에서 읽음)
		saveEnvToFile({ DATABASE_URL: originalDatabaseUrl });

		// 마이그레이션 실행
		await runMigrations(originalDatabaseUrl);
		return;
	}

	// Docker 컨테이너 시작
	try {
		console.log("🐳 Starting PostgreSQL test container...");
		const container = await new PostgreSqlContainer("postgres:16-alpine")
			.withDatabase("test_db")
			.withUsername("test_user")
			.withPassword("test_password")
			.start();

		const connectionUri = container.getConnectionUri();
		console.log(`📦 Container started: ${connectionUri}`);

		// 컨테이너 정보 저장 (teardown에서 중지하기 위함)
		saveContainerInfo(container);

		// 환경변수를 파일에 저장 (setupFiles에서 읽음)
		saveEnvToFile({
			DATABASE_URL: connectionUri,
			__ORIGINAL_DATABASE_URL__: originalDatabaseUrl || "",
		});

		// 마이그레이션 실행
		await runMigrations(connectionUri);

		console.log("✅ Database ready for E2E tests\n");
	} catch (error) {
		// Docker가 없는 경우
		if (originalDatabaseUrl) {
			console.warn("⚠️  Docker not available, falling back to DATABASE_URL");
			console.warn("   To use Testcontainers, ensure Docker is running");

			saveEnvToFile({ DATABASE_URL: originalDatabaseUrl });
			await runMigrations(originalDatabaseUrl);
		} else {
			console.error("❌ Docker not available and DATABASE_URL not set");
			console.error(
				"   Either start Docker or set DATABASE_URL environment variable",
			);
			throw error;
		}
	}
}

/**
 * 환경변수를 JSON 파일에 저장
 */
function saveEnvToFile(env: Record<string, string>): void {
	fs.writeFileSync(ENV_FILE_PATH, JSON.stringify(env, null, 2));
	console.log(`📝 Environment saved to ${ENV_FILE_PATH}`);
}

/**
 * 컨테이너 정보를 파일에 저장
 */
function saveContainerInfo(container: StartedPostgreSqlContainer): void {
	const info = {
		id: container.getId(),
		host: container.getHost(),
		port: container.getFirstMappedPort(),
	};
	fs.writeFileSync(CONTAINER_INFO_PATH, JSON.stringify(info, null, 2));
}

/**
 * Prisma 마이그레이션 실행
 */
async function runMigrations(connectionUri: string): Promise<void> {
	console.log("🔄 Running Prisma migrations...");
	try {
		execSync("npx prisma migrate deploy", {
			cwd: process.cwd(),
			stdio: "pipe",
			env: { ...process.env, DATABASE_URL: connectionUri },
		});
		console.log("✅ Migrations completed");
	} catch (error) {
		console.error("❌ Migration failed:", error);
		throw error;
	}
}

// 내보내기: setupFiles에서 환경변수를 읽기 위한 헬퍼
export function getE2EEnvFilePath(): string {
	return ENV_FILE_PATH;
}
