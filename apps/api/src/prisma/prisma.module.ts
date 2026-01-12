/**
 * PrismaModule - Prisma 서비스 제공 모듈
 *
 * @description
 * PrismaService를 글로벌 모듈로 등록하여 애플리케이션 전체에서 사용 가능하도록 합니다.
 */

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
