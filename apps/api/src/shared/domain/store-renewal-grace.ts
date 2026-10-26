/**
 * 자동 갱신 중(ACTIVE)인 스토어 구독은 만료 시각이 지나도 이만큼은 유효하다고 본다.
 *
 * 갱신 결제나 만료는 RENEWAL·EXPIRATION 웹훅으로만 알 수 있다. RevenueCat은 실패한 웹훅을
 * 5·10·20·40·80분 간격으로 다시 보내므로(합 약 2.6시간) 그 재시도가 끝날 때까지 기다린다.
 * Billing(보상 기간 시작 판단)과 Access(엔타이틀먼트 판단)가 같은 값을 써야 한쪽만 프리미엄이
 * 끝났다고 보는 구간이 생기지 않는다.
 */
export const STORE_RENEWAL_GRACE_MS = 3 * 60 * 60 * 1_000;

/** 자동 갱신 중인 스토어 구독이 아직 유효하다고 볼 수 있는 마지막 시각(이 시각 미만이면 유효) */
export function storeRenewalGraceEndsAt(expiresAt: Date): Date {
  return new Date(expiresAt.getTime() + STORE_RENEWAL_GRACE_MS);
}

/** 이 시각보다 늦게 끝나는 자동 갱신 구독은 아직 유효하다. SQL 조건의 기준값으로 쓴다. */
export function storeRenewalCutoff(now: Date): Date {
  return new Date(now.getTime() - STORE_RENEWAL_GRACE_MS);
}
