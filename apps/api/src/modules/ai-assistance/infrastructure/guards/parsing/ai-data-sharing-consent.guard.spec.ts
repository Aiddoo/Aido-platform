import type { CurrentUserPayload } from "@aido/api";
import type { AiDataSharingDecision } from "@aido/api/vocabulary";

import { createMockExecutionContext } from "#test/mocks/index";
import { StubAiDataSharingConsent } from "#test/mocks/ports/ai-assistance.stub";

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
  return new AiDataSharingConsentGuard(consentReader);
}

describe("AiDataSharingConsentGuard", () => {
  it("1.13.0 앱에서 동의하지 않았으면 동의 시트를 띄울 AI_1311로 막는다", async () => {
    // Given
    const guard = createGuard("UNDECIDED");
    const { context } = createMockExecutionContext({
      user,
      headers: { "x-app-version": "1.13.0" },
    });

    // When
    const execution = guard.canActivate(context);

    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: "AI_1311" });
  });

  it("1.12.x 앱은 동의 화면이 없으므로 답하지 않은 사용자의 요청을 그대로 처리한다", async () => {
    // Given
    const guard = createGuard("UNDECIDED");
    const { context } = createMockExecutionContext({
      user,
      headers: { "x-app-version": "1.12.1" },
    });

    // When
    const allowed = await guard.canActivate(context);

    // Then
    expect(allowed).toBe(true);
  });

  it("1.13.0 앱에서 동의했으면 통과한다", async () => {
    // Given
    const guard = createGuard("AGREED");
    const { context } = createMockExecutionContext({
      user,
      headers: { "x-app-version": "1.13.0" },
    });

    // When
    const allowed = await guard.canActivate(context);

    // Then
    expect(allowed).toBe(true);
  });
});
