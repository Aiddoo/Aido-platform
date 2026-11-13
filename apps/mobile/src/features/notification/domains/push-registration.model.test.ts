import { toInstant } from '@src/shared/date/instant';

import { createPushPermission, createPushRegistration } from '../__tests__/notification.fixtures';
import { PushRegistrationPolicy } from './push-registration.model';

const REPORTED_TOKEN = 'ExponentPushToken[reported]';
const CURRENT_TOKEN = 'ExponentPushToken[current]';
const REQUESTED_AT = toInstant('2026-11-11T00:00:00.000Z');

describe('getReportToken', () => {
  it.each([
    ['허용했고 토큰을 받았으면 받은 토큰', 'GRANTED', CURRENT_TOKEN, REPORTED_TOKEN, CURRENT_TOKEN],
    [
      '허용했는데 토큰을 받지 못했으면 서버가 가진 토큰',
      'GRANTED',
      null,
      REPORTED_TOKEN,
      REPORTED_TOKEN,
    ],
    ['허용했는데 한 번도 토큰을 받지 못했으면 null', 'PROVISIONAL', null, null, null],
    ['거절했으면 보고한 토큰이 있어도 null', 'DENIED', null, REPORTED_TOKEN, null],
  ] as const)('%s로 보고한다', (_case, status, issuedToken, reportedToken, expected) => {
    // Given
    const registration = createPushRegistration({ reportedToken });
    const permission = createPushPermission({ status });

    // When
    const token = PushRegistrationPolicy.getReportToken(registration, { permission, issuedToken });

    // Then
    expect(token).toBe(expected);
  });
});

describe('getReleaseTokens', () => {
  it.each([
    [
      '보고한 뒤 토큰이 바뀌었으면 둘 다',
      REPORTED_TOKEN,
      CURRENT_TOKEN,
      [REPORTED_TOKEN, CURRENT_TOKEN],
    ],
    ['토큰이 그대로면 하나만', CURRENT_TOKEN, CURRENT_TOKEN, [CURRENT_TOKEN]],
    ['지금 토큰을 받지 못했으면 보고한 토큰', REPORTED_TOKEN, null, [REPORTED_TOKEN]],
    ['보고한 적이 없으면 지금 토큰', null, CURRENT_TOKEN, [CURRENT_TOKEN]],
    ['둘 다 없으면 보낼 토큰이 없다', null, null, []],
  ] as const)('%s 푼다', (_case, reportedToken, currentToken, expected) => {
    // Given
    const registration = createPushRegistration({ reportedToken });

    // When
    const tokens = PushRegistrationPolicy.getReleaseTokens(registration, { currentToken });

    // Then
    expect(tokens).toEqual(expected);
  });
});

describe('PushRegistrationPolicy', () => {
  describe('해제 요청의 생애', () => {
    it('세션이 끝나 해제를 요청하면 보낼 해제가 남는다', () => {
      // Given
      const registration = createPushRegistration({ reportedToken: REPORTED_TOKEN });

      // When
      const requested = PushRegistrationPolicy.requestRelease(registration, REQUESTED_AT);

      // Then
      expect(PushRegistrationPolicy.hasPendingRelease(requested)).toBe(true);
      expect(requested.reportedToken).toBe(REPORTED_TOKEN);
    });

    it('새 세션의 보고가 성공하면 끝난 세션의 해제를 버리고 새 토큰을 기억한다', () => {
      // Given
      const registration = createPushRegistration({
        reportedToken: REPORTED_TOKEN,
        releaseRequestedAt: REQUESTED_AT,
      });

      // When
      const reported = PushRegistrationPolicy.recordReported(registration, CURRENT_TOKEN);

      // Then
      expect(reported).toEqual({ reportedToken: CURRENT_TOKEN, releaseRequestedAt: null });
    });

    it('해제가 끝나면 서버에 남은 토큰이 없다', () => {
      // Given
      const registration = createPushRegistration({
        reportedToken: REPORTED_TOKEN,
        releaseRequestedAt: REQUESTED_AT,
      });

      // When
      const released = PushRegistrationPolicy.recordReleased(registration);

      // Then
      expect(released).toEqual({ reportedToken: null, releaseRequestedAt: null });
      expect(PushRegistrationPolicy.hasPendingRelease(released)).toBe(false);
    });
  });
});
