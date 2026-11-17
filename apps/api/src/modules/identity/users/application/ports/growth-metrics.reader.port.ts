import type {
  GrowthActivityReadModel,
  GrowthCohortSignupReadModel,
} from "../read-models/growth-cohort.read-model.js";

export interface GrowthCohortRange {
  readonly cohortFrom: Temporal.PlainDate;
  readonly cohortTo: Temporal.PlainDate;
}

// 관리자 성장 지표의 사용자·활동일 조회다. 할 일 활성화는 planning 조회 포트가 따로 센다
export abstract class GrowthMetricsReaderPort {
  abstract getActivity(range: GrowthCohortRange): Promise<GrowthActivityReadModel>;
  /** 가입 현지 날짜가 범위 안인, 로그인 수단이 있고 탈퇴 대기가 아닌 사용자 */
  abstract listCohortSignups(
    range: GrowthCohortRange & { readonly asOf: Temporal.Instant },
  ): Promise<GrowthCohortSignupReadModel[]>;
}
