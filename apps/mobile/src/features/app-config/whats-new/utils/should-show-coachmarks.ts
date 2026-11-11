interface ShouldShowCoachmarksInput {
  /** 알림 화면을 열 차례가 아니라고 정해졌다 */
  isOnboardingSettled: boolean;
  /** 캠페인 설정을 처음 받는 중이다. 실패했거나 오프라인이라 멈춘 조회는 받는 중이 아니라 새로운 기능을 열지 않는 것으로 본다 */
  isCampaignConfigLoading: boolean;
  /** 받은 설정으로 이 계정에 새로운 기능을 자동으로 열 차례다. 열면 본 기록이 남아 false가 된다 */
  shouldAutoOpenWhatsNew: boolean;
}

/**
 * 첫 피드는 알림 화면 → 새로운 기능 → 말풍선 순서다. 앞 화면을 열지 아직 모르거나 열 차례면 말풍선은 기다린다.
 * 새로운 기능이 떠 있는 동안은 피드가 포커스를 잃어 말풍선이 열리지 않고, 닫고 돌아오면 자리를 다시 잰 뒤 연다
 */
export function shouldShowCoachmarks({
  isOnboardingSettled,
  isCampaignConfigLoading,
  shouldAutoOpenWhatsNew,
}: ShouldShowCoachmarksInput): boolean {
  return isOnboardingSettled && !isCampaignConfigLoading && !shouldAutoOpenWhatsNew;
}
