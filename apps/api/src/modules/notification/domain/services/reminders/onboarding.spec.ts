import { type OnboardingDay, resolveOnboardingDeepLinkPath } from "./onboarding.js";

describe("resolveOnboardingDeepLinkPath", () => {
  it.each<[OnboardingDay, number, string]>([
    [0, 0, "/feed"],
    [1, 0, "/feed"],
    [2, 0, "/friends"],
    [3, 0, "/settings/notifications"],
    [5, 0, "/feed"],
    [5, 3, "/achievements"],
    [7, 0, "/achievements"],
    [7, 4, "/achievements"],
  ])("Day %i 완료 %i개는 %s를 연다", (day, completedCount, path) => {
    expect(resolveOnboardingDeepLinkPath(day, completedCount)).toBe(path);
  });
});
