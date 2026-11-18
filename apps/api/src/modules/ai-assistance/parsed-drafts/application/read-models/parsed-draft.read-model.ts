import type { MeteredFeatureQuotaReadModel } from "#api/modules/access/quota-charges/access-quota-charges.public";

import type { ParsedDraft } from "../../domain/parsed-draft.aggregate.js";
import type { ParsedTodo } from "../../domain/parsed-drafts.constants.js";

/** 공개 응답의 생성 메타. 사고 토큰은 로그에만 남긴다. */
export interface ParseMetaReadModel {
  readonly model: string;
  readonly processingTimeMs: number;
  readonly tokenUsage: { readonly input: number; readonly output: number };
  readonly promptVersion: string;
}

export interface ParsedDraftReadModel<TTodo extends ParsedTodo = ParsedTodo> {
  readonly draft: ParsedDraft<TTodo>;
  readonly meta: ParseMetaReadModel;
  /** 이번 요청의 확정·환불을 반영한 AI_PARSE 한도·사용량. 읽지 못했으면 null이고 응답에서 빠진다 */
  readonly featureQuota: MeteredFeatureQuotaReadModel | null;
}
