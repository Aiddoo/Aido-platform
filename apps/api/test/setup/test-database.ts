/**
 * TestDatabase - 통합 테스트용 DB 헬퍼
 *
 * @description
 * 통합 테스트를 위한 PostgreSQL 데이터베이스를 관리합니다.
 * - Docker 사용 가능 시: Testcontainers로 독립적인 PostgreSQL 컨테이너 생성
 * - Docker 미사용 시: 기존 DATABASE_URL 사용 (fallback)
 * - 자동 마이그레이션 실행
 * - 테스트 종료 시 자동 정리
 * - Prisma 7+ Driver Adapter 패턴 사용
 */

import { execSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { PrismaClient } from "../../src/generated/prisma/client";

export class TestDatabase {
	private container: StartedPostgreSqlContainer | null = null;
	private prisma: PrismaClient | null = null;
	private originalDatabaseUrl: string | undefined;
	private usingExternalDb = false;

	/**
	 * PostgreSQL 데이터베이스 시작 및 Prisma 클라이언트 초기화
	 * Docker가 없는 경우 기존 DATABASE_URL 사용
	 *
	 * @returns PrismaClient 인스턴스
	 */
	async start(): Promise<PrismaClient> {
		// 원본 DATABASE_URL 백업
		this.originalDatabaseUrl = process.env.DATABASE_URL;

		let connectionUri: string;

		// USE_EXTERNAL_DB 환경변수가 있으면 외부 DB 사용
		if (process.env.USE_EXTERNAL_DB === "true" && this.originalDatabaseUrl) {
			console.log("📦 Using external database (USE_EXTERNAL_DB=true)");
			connectionUri = this.originalDatabaseUrl;
			this.usingExternalDb = true;
		} else {
			// Docker 컨테이너 시작 시도
			try {
				console.log("🐳 Starting PostgreSQL test container...");
				this.container = await new PostgreSqlContainer("postgres:16-alpine")
					.withDatabase("test_db")
					.withUsername("test_user")
					.withPassword("test_password")
					.start();

				connectionUri = this.container.getConnectionUri();
				console.log(`📦 Container started: ${connectionUri}`);
			} catch (error) {
				// Docker가 없는 경우 기존 DATABASE_URL 사용
				if (this.originalDatabaseUrl) {
					console.warn("⚠️  Docker not available, falling back to DATABASE_URL");
					console.warn("   To use Testcontainers, ensure Docker is running");
					connectionUri = this.originalDatabaseUrl;
					this.usingExternalDb = true;
				} else {
					console.error("❌ Docker not available and DATABASE_URL not set");
					console.error(
						"   Either start Docker or set DATABASE_URL environment variable",
					);
					throw error;
				}
			}
		}

		// 환경 변수 설정
		process.env.DATABASE_URL = connectionUri;

		// Prisma 마이그레이션 실행
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

		// Prisma 7+ Driver Adapter 패턴으로 클라이언트 초기화
		const adapter = new PrismaPg({ connectionString: connectionUri });
		this.prisma = new PrismaClient({ adapter });

		await this.prisma.$connect();
		console.log("✅ Prisma client connected");

		return this.prisma;
	}

	/**
	 * Prisma 클라이언트 반환
	 */
	getPrisma(): PrismaClient {
		if (!this.prisma) {
			throw new Error("TestDatabase not started. Call start() first.");
		}
		return this.prisma;
	}

	/**
	 * 컨테이너 연결 URI 반환
	 */
	getConnectionUri(): string {
		if (!this.container && !this.usingExternalDb) {
			throw new Error("TestDatabase not started. Call start() first.");
		}
		return this.container?.getConnectionUri() ?? process.env.DATABASE_URL ?? "";
	}

	/**
	 * 테스트 데이터 초기화 (모든 테이블 데이터 삭제)
	 */
	async cleanup(): Promise<void> {
		if (!this.prisma) {
			return;
		}

		console.log("🧹 Cleaning up test data...");

		// 트랜잭션으로 모든 테이블 데이터 삭제 (의존성 역순)
		await this.prisma.$transaction([
			// 알림/로그/기록 (자식 테이블)
			this.prisma.notification.deleteMany(),
			this.prisma.weeklyAchievement.deleteMany(),
			this.prisma.dailyCompletion.deleteMany(),
			this.prisma.securityLog.deleteMany(),
			this.prisma.loginAttempt.deleteMany(),

			// 소셜 기능
			this.prisma.cheer.deleteMany(),
			this.prisma.nudge.deleteMany(),
			this.prisma.follow.deleteMany(),

			// 인증
			this.prisma.verification.deleteMany(),
			this.prisma.session.deleteMany(),
			this.prisma.oAuthState.deleteMany(),
			this.prisma.account.deleteMany(),

			// 구독
			this.prisma.subscription.deleteMany(),

			// Todo
			this.prisma.todo.deleteMany(),
			this.prisma.todoCategory.deleteMany(),
			this.prisma.pushToken.deleteMany(),

			// 사용자 (부모 테이블)
			this.prisma.userConsent.deleteMany(),
			this.prisma.userPreference.deleteMany(),
			this.prisma.userProfile.deleteMany(),
			this.prisma.user.deleteMany(),
		]);

		console.log("✅ Test data cleaned");
	}

	/**
	 * Prisma 클라이언트 연결 해제 및 컨테이너 중지
	 */
	async stop(): Promise<void> {
		console.log("🛑 Stopping test database...");

		// Prisma 연결 해제
		if (this.prisma) {
			await this.prisma.$disconnect();
			this.prisma = null;
			console.log("✅ Prisma disconnected");
		}

		// 컨테이너 중지 (외부 DB 사용 시 스킵)
		if (this.container) {
			await this.container.stop();
			this.container = null;
			console.log("✅ Container stopped");
		}

		// 원본 DATABASE_URL 복원
		if (this.originalDatabaseUrl) {
			process.env.DATABASE_URL = this.originalDatabaseUrl;
		} else {
			delete process.env.DATABASE_URL;
		}
	}
}

/**
 * 테스트에서 사용할 전역 TestDatabase 인스턴스 생성 헬퍼
 */
export const createTestDatabase = () => new TestDatabase();
