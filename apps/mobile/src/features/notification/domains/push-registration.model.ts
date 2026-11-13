import { type Instant, instantSchema } from '@src/shared/date/instant';
import { compact, uniq } from 'es-toolkit';
import { z } from 'zod';

import { type PushPermission, PushPermissionPolicy } from './push-permission.model';

/** 이 기기가 서버에 남긴 푸시 등록. 끝난 세션의 해제는 서버가 가진 토큰과 맞아야 지워진다 */
export const pushRegistrationSchema = z
  .object({
    /** 마지막으로 보고에 성공한 토큰. 거절·미결정이거나 아직 보고하지 않았으면 null */
    reportedToken: z.string().nullable(),
    /** 온라인 로그아웃 없이 세션이 끝나 아직 풀지 못한 해제를 요청한 시각 */
    releaseRequestedAt: instantSchema.nullable(),
  })
  .strip();
export type PushRegistration = z.infer<typeof pushRegistrationSchema>;

/** 보고한 적도, 풀 해제도 없는 기기 */
export function createEmptyPushRegistration(): PushRegistration {
  return { reportedToken: null, releaseRequestedAt: null };
}

/**
 * 토큰을 못 받아도 서버가 가진 토큰으로 권한·시간대·언어를 보고해 등록을 지킨다. 토큰을 한 번도 못 받은 허용 기기는 null로 보고한다
 * (1.15.1 서버는 허용 상태의 null에 저장된 토큰을 지킨다). 1.15.1 서버를 근거로 든 이 설명은 1.16.0에서 지운다(compatibility.md)
 */
function getReportToken(
  registration: PushRegistration,
  { permission, issuedToken }: { permission: PushPermission; issuedToken: string | null },
): string | null {
  if (!PushPermissionPolicy.isPushDeliverable(permission)) {
    return null;
  }
  return issuedToken ?? registration.reportedToken;
}

function recordReported(registration: PushRegistration, token: string | null): PushRegistration {
  return { ...registration, reportedToken: token, releaseRequestedAt: null };
}

function requestRelease(registration: PushRegistration, requestedAt: Instant): PushRegistration {
  return { ...registration, releaseRequestedAt: requestedAt };
}

function hasPendingRelease(registration: PushRegistration): boolean {
  return registration.releaseRequestedAt != null;
}

/** 보고한 뒤 토큰이 바뀌었을 수 있어, 서버가 가진 토큰과 지금 토큰을 모두 푼다 */
function getReleaseTokens(
  registration: PushRegistration,
  { currentToken }: { currentToken: string | null },
): string[] {
  return uniq(compact([registration.reportedToken, currentToken]));
}

function recordReleased(registration: PushRegistration): PushRegistration {
  return { ...registration, reportedToken: null, releaseRequestedAt: null };
}

export const PushRegistrationPolicy = {
  getReportToken,
  recordReported,
  requestRelease,
  hasPendingRelease,
  getReleaseTokens,
  recordReleased,
} as const;
