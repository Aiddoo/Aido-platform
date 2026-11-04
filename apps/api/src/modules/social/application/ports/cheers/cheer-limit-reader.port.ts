import type { FeatureQuota } from "@aido/api";

import type { DailySendUsage } from "../quotas/daily-send-usage-reader.port.js";

/**
 * CheerLimitReaderPort — 트랜잭션 내 응원 일일 한도 조회 포트.
 *
 * 응원 전송 경로의 TOCTOU 방지를 위해 활성 트랜잭션 클라이언트로 실시간 한도를 읽는다.
 * 트랜잭션 클라이언트 접근(EntitlementReaderPort.limitOfInTx·featureQuotaInTx)은 인프라 어댑터가 캡슐화한다.
 */

export const CHEER_LIMIT_READER = Symbol("CHEER_LIMIT_READER");

export interface CheerLimitReaderPort {
  /** 트랜잭션 내 사용자 일일 응원 한도 (null이면 무제한) */
  getDailyLimitInTx(userId: string): Promise<number | null>;
  /** 일일 한도 오류 details에 싣는 서버 계산 featureQuota. usage는 한도 검사와 같은 하루 창에서 센 값이다. */
  readDailyQuotaInTx(userId: string, usage: DailySendUsage): Promise<FeatureQuota>;
}
