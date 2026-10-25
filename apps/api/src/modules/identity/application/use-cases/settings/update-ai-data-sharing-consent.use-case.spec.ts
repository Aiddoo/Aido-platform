import { AI_DATA_SHARING_CONSENT } from "@aido/api/vocabulary";

import { FakeLogger } from "#test/mocks/fake-logger.service";
import { StubUserConsentRepository } from "#test/mocks/ports/user-settings.stub";

import { UpdateAiDataSharingConsent } from "./update-ai-data-sharing-consent.use-case.js";

const NOW = new Date("2026-10-26T09:00:00.000Z");

describe("AI 데이터 처리 동의 변경", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("동의 기록이 없는 사용자가 동의하면 현재 안내 버전과 동의 시각을 저장한다", async () => {
    // Given
    const consentRepository = new StubUserConsentRepository();
    const useCase = new UpdateAiDataSharingConsent({ consentRepository, logger: new FakeLogger() });

    // When
    const result = await useCase.execute({
      userId: "user",
      agreed: true,
      version: AI_DATA_SHARING_CONSENT.VERSION,
    });

    // Then
    expect(result).toEqual({
      aiDataSharingDecision: "AGREED",
      aiDataSharingAgreedAt: NOW.toISOString(),
      aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
    });
  });

  it("동의를 철회하면 동의 시각을 지우고 거부 상태로 남긴다", async () => {
    // Given
    const consentRepository = new StubUserConsentRepository();
    const useCase = new UpdateAiDataSharingConsent({ consentRepository, logger: new FakeLogger() });
    await useCase.execute({
      userId: "user",
      agreed: true,
      version: AI_DATA_SHARING_CONSENT.VERSION,
    });

    // When
    const result = await useCase.execute({
      userId: "user",
      agreed: false,
      version: AI_DATA_SHARING_CONSENT.VERSION,
    });

    // Then
    expect(result.aiDataSharingDecision).toBe("DECLINED");
    expect(result.aiDataSharingAgreedAt).toBeNull();
    expect(consentRepository.records.get("user")?.aiDataSharingVersion).toBe(
      AI_DATA_SHARING_CONSENT.VERSION,
    );
  });
});
