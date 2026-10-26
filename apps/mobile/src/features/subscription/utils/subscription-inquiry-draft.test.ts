import { i18n } from '@src/shared/i18n';

import { toSubscriptionInquiryDraft } from './subscription-inquiry-draft';

describe('toSubscriptionInquiryDraft', () => {
  afterEach(() => i18n.changeLanguage('ko'));

  it('설치 정보가 있으면 오류 코드와 앱 버전·기기를 함께 적는다', () => {
    // When
    const draft = toSubscriptionInquiryDraft({
      subject: '결제를 마치지 못했어요',
      diagnosticCode: 'SUBSCRIPTION_PURCHASE_FAILED (2)',
      installation: { platform: 'ios', currentVersion: '1.13.0' },
    });

    // Then
    expect(draft).toBe(
      '결제를 마치지 못했어요\n(오류 코드: SUBSCRIPTION_PURCHASE_FAILED (2) / 앱 1.13.0 / iOS)\n\n',
    );
  });

  it('설치 정보를 모르면 오류 코드만 적는다', () => {
    // When
    const draft = toSubscriptionInquiryDraft({
      subject: '요금제를 불러오지 못했어요',
      diagnosticCode: 'NETWORK',
      installation: undefined,
    });

    // Then
    expect(draft).toBe('요금제를 불러오지 못했어요\n(오류 코드: NETWORK)\n\n');
  });

  it('영어 사용자에게는 영어로 적는다', async () => {
    // Given
    await i18n.changeLanguage('en');

    // When
    const draft = toSubscriptionInquiryDraft({
      subject: "Couldn't load plans",
      diagnosticCode: 'SERVER_503',
      installation: { platform: 'android', currentVersion: '1.13.0' },
    });

    // Then
    expect(draft).toBe("Couldn't load plans\n(Error code: SERVER_503 / App 1.13.0 / Android)\n\n");
  });
});
