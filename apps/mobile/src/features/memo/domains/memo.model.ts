import type { FeatureQuota } from '@src/features/subscription/domains/entitlement.model';
import type { VoicePlan } from '@src/features/voice/domains/voice-plan.model';

import type { Memo, MemoResourceLimit } from '../schemas/memo.schema';

/** 메모 정리 결과. 계획과, 이 요청을 반영한 AI 할 일 만들기 한도(1.15.0 이전 서버는 보내지 않아 null) */
export interface ParsedMemoPlan {
  plan: VoicePlan;
  featureQuota: FeatureQuota | null;
}

export function canCreateMemo(limit: MemoResourceLimit) {
  return limit.currentCount < limit.maxPerUser;
}

export function getMemoPreview(memo: Pick<Memo, 'content'>) {
  const [title = '', ...rest] = memo.content.trim().split('\n');

  return { title: title.trim(), body: rest.join('\n').trim() };
}

export const MemoPolicy = {
  canCreateMemo,
  getMemoPreview,
} as const;
