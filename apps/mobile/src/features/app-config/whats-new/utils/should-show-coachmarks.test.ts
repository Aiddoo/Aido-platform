import { shouldShowCoachmarks } from './should-show-coachmarks';

const settledInput = {
  isOnboardingSettled: true,
  isCampaignConfigLoading: false,
  shouldAutoOpenWhatsNew: false,
};

describe('shouldShowCoachmarks', () => {
  it.each([
    [{ isOnboardingSettled: false }, '알림 화면을 열지 정해지기 전'],
    [{ isCampaignConfigLoading: true }, '캠페인 설정을 받는 중'],
    [{ shouldAutoOpenWhatsNew: true }, '받은 설정으로 새로운 기능을 자동으로 열 차례'],
  ])('%s(%s)에는 말풍선을 띄우지 않는다', (overrides, _label) => {
    // When
    const result = shouldShowCoachmarks({ ...settledInput, ...overrides });

    // Then
    expect(result).toBe(false);
  });

  it('앞 화면을 열지 정해졌고 열 차례가 아니면(이미 봄·닫고 돌아옴·설정 실패·오프라인) 기다리지 않고 띄운다', () => {
    // When
    const result = shouldShowCoachmarks(settledInput);

    // Then
    expect(result).toBe(true);
  });
});
