import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { HealthCheckResult } from '@nestjs/terminus';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: '서버 상태 확인' })
  @ApiResponse({ status: 200, description: '서버가 정상 동작 중입니다.' })
  @ApiResponse({ status: 503, description: '서버에 문제가 발생했습니다.' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.prismaHealth.isHealthy('database')]);
  }

  @Get('liveness')
  @ApiOperation({ summary: '서버 활성 상태 확인 (Kubernetes liveness probe)' })
  @ApiResponse({ status: 200, description: '서버가 활성 상태입니다.' })
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('readiness')
  @HealthCheck()
  @ApiOperation({
    summary: '서비스 준비 상태 확인 (Kubernetes readiness probe)',
  })
  @ApiResponse({ status: 200, description: '서비스가 준비 상태입니다.' })
  @ApiResponse({ status: 503, description: '서비스가 준비되지 않았습니다.' })
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([() => this.prismaHealth.isHealthy('database')]);
  }
}
