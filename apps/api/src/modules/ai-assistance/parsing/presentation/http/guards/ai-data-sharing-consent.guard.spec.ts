import type { CurrentUserPayload } from "@aido/api";
import type { AiDataSharingDecision } from "@aido/api/vocabulary";

import { createMockExecutionContext } from "#test/mocks/index";
import { StubAiDataSharingConsent } from "#test/mocks/ports/ai-assistance.stub";
import { createRequestClientReader, runWithRequestHeaders } from "#test/mocks/request-client";

import { canShareWithAi } from "../../../../shared/domain/ai-data-sharing-consent.domain-service.js";
import { AiDataSharingConsentGuard } from "./ai-data-sharing-consent.guard.js";

const user: CurrentUserPayload = {
  userId: "user",
  email: "consent@example.com",
  sessionId: "session",
  role: "USER",
};

function createGuard(decision: AiDataSharingDecision) {
  const consentReader = new StubAiDataSharingConsent();
  consentReader.decision = decision;
  return new AiDataSharingConsentGuard(consentReader, createRequestClientReader());
}

function canActivateFor(guard: AiDataSharingConsentGuard, appVersion: string) {
  const { context } = createMockExecutionContext({ user });
  return runWithRequestHeaders({ "x-app-version": appVersion }, () => guard.canActivate(context));
}

describe("AiDataSharingConsentGuard", () => {
  it("1.13.0 앱에서 동의하지 않았으면 동의 시트를 띄울 AI_1311로 막는다", async () => {
    // Given
    const guard = createGuard("UNDECIDED");

    // When
    const execution = canActivateFor(guard, "1.13.0");

    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: "AI_1311" });
  });

  it("1.12.x 앱은 동의 화면이 없으므로 답하지 않은 사용자의 요청을 그대로 처리한다", async () => {
    // Given
    const guard = createGuard("UNDECIDED");

    // When
    const allowed = await canActivateFor(guard, "1.12.1");

    // Then
    expect(allowed).toBe(true);
  });

  it("1.13.0 앱에서 동의했으면 통과한다", async () => {
    // Given
    const guard = createGuard("AGREED");

    // When
    const allowed = await canActivateFor(guard, "1.13.0");

    // Then
    expect(allowed).toBe(true);
  });

  it.each(["1.12.1", "1.13.0", "1.14.1", "1.15.0-rc.1", "dev-build", ""])(
    "정규화한 앱 버전(%j)도 헤더 원문으로 판단한 결과와 같다",
    async (header) => {
      // Given
      const guard = createGuard("UNDECIDED");

      // When
      const allowed = await canActivateFor(guard, header).then(
        () => true,
        () => false,
      );

      // Then
      expect(allowed).toBe(canShareWithAi("UNDECIDED", header));
    },
  );
});
