import { Module } from "@nestjs/common";

import { WeeklyAchievementController } from "./weekly-achievement.controller";
import { WeeklyAchievementRepository } from "./weekly-achievement.repository";
import { WeeklyAchievementService } from "./weekly-achievement.service";

/**
 * WeeklyAchievement 모듈
 *
 * 주간 할 일 달성 현황 관리를 담당합니다.
 *
 * ## 주요 기능
 * - 연도별 주간 달성 목록 조회 (커서 페이지네이션)
 * - 특정 주차 상세 조회
 * - 달성 기록 upsert (스케줄러에서 호출)
 *
 * ## 아키텍처
 * - Controller: HTTP 요청 처리
 * - Service: 비즈니스 로직 (페이지네이션, 통계 계산, upsert)
 * - Repository: 데이터 접근 계층 (내부 구현)
 * - Mapper: 엔티티 → DTO 변환, 통계 계산
 */
@Module({
	controllers: [WeeklyAchievementController],
	providers: [WeeklyAchievementRepository, WeeklyAchievementService],
	exports: [WeeklyAchievementService],
})
export class WeeklyAchievementModule {}
