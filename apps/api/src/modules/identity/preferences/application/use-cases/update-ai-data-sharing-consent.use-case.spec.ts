import { AI_DATA_SHARING_CONSENT } from "@aido/api/vocabulary";

import { InMemoryUserConsentRepository } from "#test/doubles/identity/in-memory-user-consent.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { UpdateAiDataSharingConsentUseCase } from "./update-ai-data-sharing-consent.use-case.js";

const NOW_ISO = "2026-10-26T09:00:00.000Z";

describe("AI 데이터 처리 동의 변경", () => {
  function createUseCase() {
    const consentRepository = new InMemoryUserConsentRepository();
    const useCase = new UpdateAiDataSharingConsentUseCase({
      consentRepository,
      clock: new FixedClock(Temporal.Instant.from(NOW_ISO)),
      logger: new SilentLogger(),
    });
    return { consentRepository, useCase };
  }

  it("동의 기록이 없는 사용자가 동의하면 현재 안내 버전과 동의 시각을 저장한다", async () => {
    // Given
    const { useCase } = createUseCase();

    // When
    const result = await useCase.execute({
      userId: "user",
      agreed: true,
      version: AI_DATA_SHARING_CONSENT.VERSION,
    });

    // Then
    expect(result).toEqual({
      aiDataSharingDecision: "AGREED",
      aiDataSharingAgreedAt: NOW_ISO,
      aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
    });
  });

  it("동의를 철회하면 동의 시각을 지우고 거부 상태로 남긴다", async () => {
    // Given
    const { consentRepository, useCase } = createUseCase();
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
    expect(consentRepository.stored("user")?.aiDataSharingVersion).toBe(
      AI_DATA_SHARING_CONSENT.VERSION,
    );
  });
});
