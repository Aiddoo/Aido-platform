import { VERIFICATION_CODE } from '@aido/api';

import { getResendCooldownAfterSuccess } from './resend-cooldown';

describe('getResendCooldownAfterSuccess', () => {
  it('서버가 알려 준 대기 시간을 우선한다', () => {
    expect(getResendCooldownAfterSuccess(42)).toBe(42);
  });

  it('서버 값이 없으면 기본 재발송 쿨다운을 쓴다', () => {
    expect(getResendCooldownAfterSuccess(undefined)).toBe(
      VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS,
    );
  });
});
