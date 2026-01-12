/**
 * PrismaService - Prisma 클라이언트 관리 서비스
 *
 * @description
 * NestJS의 의존성 주입(DI) 패턴으로 Prisma 클라이언트를 관리합니다.
 * - 애플리케이션 시작 시 자동 연결
 * - 애플리케이션 종료 시 자동 연결 해제
 * - Prisma 7+ Driver Adapter 패턴 사용
 */

import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString =
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/aido';

    const adapter = new PrismaPg({ connectionString });

    super({ adapter });
  }

  /**
   * 모듈 초기화 시 Prisma 연결
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * 모듈 종료 시 Prisma 연결 해제
   */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
