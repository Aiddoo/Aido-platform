import { Module } from "@nestjs/common";

import { DailyCompletionController } from "./daily-completion.controller";
import { DailyCompletionRepository } from "./daily-completion.repository";
import { DailyCompletionService } from "./daily-completion.service";

/**
 * DailyCompletion 모듈
 *
 * 일일 할 일 완료 현황 관리를 담당합니다.
 *
 * ## 주요 기능
 * - 날짜별 완료 현황 조회 (캘린더용)
 * - 완료율 및 통계 제공
 * - 물고기 아이콘 표시 데이터 제공
 *
 * ## 아키텍처
 * - Controller: HTTP 요청 처리 및 응답 변환
 * - Service: 비즈니스 로직 (집계 데이터 변환, 통계 계산)
 * - Repository: 데이터 접근 계층 (DB 집계 쿼리)
 *
 * ## 성능 최적화
 * - DB 레벨에서 groupBy를 사용한 집계
 * - Todo가 없는 날짜는 응답에서 제외
 */
@Module({
	controllers: [DailyCompletionController],
	providers: [DailyCompletionRepository, DailyCompletionService],
	exports: [DailyCompletionService],
})
export class DailyCompletionModule {}
