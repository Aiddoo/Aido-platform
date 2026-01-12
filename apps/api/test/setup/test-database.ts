/**
 * TestDatabase - Testcontainers를 활용한 통합 테스트용 DB 헬퍼
 *
 * @description
 * 통합 테스트마다 독립적인 PostgreSQL 컨테이너를 생성하고 관리합니다.
 * - 실제 PostgreSQL 사용으로 프로덕션 환경과 동일한 테스트
 * - 자동 마이그레이션 실행
 * - 테스트 종료 시 자동 정리
 * - Prisma 7+ Driver Adapter 패턴 사용
 */

import { execSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '../../src/generated/prisma/client';

export class TestDatabase {
  private container: StartedPostgreSqlContainer | null = null;
  private prisma: PrismaClient | null = null;
  private originalDatabaseUrl: string | undefined;

  /**
   * PostgreSQL 컨테이너 시작 및 Prisma 클라이언트 초기화
   *
   * @returns PrismaClient 인스턴스
   */
  async start(): Promise<PrismaClient> {
    // 원본 DATABASE_URL 백업
    this.originalDatabaseUrl = process.env.DATABASE_URL;

    // PostgreSQL 16 컨테이너 시작
    console.log('🐳 Starting PostgreSQL test container...');
    this.container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_password')
      .start();

    const connectionUri = this.container.getConnectionUri();
    console.log(`📦 Container started: ${connectionUri}`);

    // 환경 변수 설정
    process.env.DATABASE_URL = connectionUri;

    // Prisma 마이그레이션 실행
    console.log('🔄 Running Prisma migrations...');
    try {
      execSync('npx prisma migrate deploy', {
        cwd: process.cwd(),
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: connectionUri },
      });
      console.log('✅ Migrations completed');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }

    // Prisma 7+ Driver Adapter 패턴으로 클라이언트 초기화
    const adapter = new PrismaPg({ connectionString: connectionUri });
    this.prisma = new PrismaClient({ adapter });

    await this.prisma.$connect();
    console.log('✅ Prisma client connected');

    return this.prisma;
  }

  /**
   * Prisma 클라이언트 반환
   */
  getPrisma(): PrismaClient {
    if (!this.prisma) {
      throw new Error('TestDatabase not started. Call start() first.');
    }
    return this.prisma;
  }

  /**
   * 컨테이너 연결 URI 반환
   */
  getConnectionUri(): string {
    if (!this.container) {
      throw new Error('TestDatabase not started. Call start() first.');
    }
    return this.container.getConnectionUri();
  }

  /**
   * 테스트 데이터 초기화 (모든 테이블 데이터 삭제)
   */
  async cleanup(): Promise<void> {
    if (!this.prisma) {
      return;
    }

    console.log('🧹 Cleaning up test data...');

    // 트랜잭션으로 모든 테이블 데이터 삭제
    await this.prisma.$transaction([this.prisma.todo.deleteMany(), this.prisma.user.deleteMany()]);

    console.log('✅ Test data cleaned');
  }

  /**
   * Prisma 클라이언트 연결 해제 및 컨테이너 중지
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping test database...');

    // Prisma 연결 해제
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
      console.log('✅ Prisma disconnected');
    }

    // 컨테이너 중지
    if (this.container) {
      await this.container.stop();
      this.container = null;
      console.log('✅ Container stopped');
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
