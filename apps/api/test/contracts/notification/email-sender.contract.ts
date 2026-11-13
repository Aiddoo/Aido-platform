import type {
  EmailDeliveryOutcome,
  EmailSenderPort,
} from "#api/modules/notification/email/application/ports/email-sender.port";
import { EmailMessage } from "#api/modules/notification/email/domain/email-message.vo";

const EMAIL_CONTRACT_SCENARIOS = [
  "success",
  "unavailable",
  "rate-limited",
  "daily-quota",
  "monthly-quota",
  "rejected",
  "unreachable",
] as const;
export type EmailContractScenario = (typeof EMAIL_CONTRACT_SCENARIOS)[number];

const RECIPIENT = "contract-recipient@example.com";
const CODE = "424242";
const IDEMPOTENCY_KEY = "contract-delivery-1";

const EXPECTED: Record<EmailContractScenario, (outcome: EmailDeliveryOutcome) => void> = {
  success: (outcome) => expect(outcome.status).toBe("sent"),
  unavailable: (outcome) =>
    expect(outcome).toEqual({ status: "failed", reason: "unavailable", retryable: true }),
  "rate-limited": (outcome) =>
    expect(outcome).toEqual({ status: "failed", reason: "rate_limited", retryable: true }),
  "daily-quota": (outcome) =>
    expect(outcome).toEqual({
      status: "failed",
      reason: "quota_exhausted",
      retryable: false,
      scope: "daily",
    }),
  "monthly-quota": (outcome) =>
    expect(outcome).toEqual({
      status: "failed",
      reason: "quota_exhausted",
      retryable: false,
      scope: "monthly",
    }),
  rejected: (outcome) =>
    expect(outcome).toEqual({ status: "failed", reason: "rejected", retryable: false }),
  unreachable: (outcome) =>
    expect(outcome).toEqual({ status: "failed", reason: "unavailable", retryable: true }),
};

export interface EmailSenderContractHarness {
  /** 어댑터가 낼 수 있는 시나리오만 적는다. 없는 시나리오는 계약에서 뺀다. */
  readonly scenarios: readonly EmailContractScenario[];
  /** 시나리오 상황을 준비하고 그 상황에서 보낼 어댑터를 돌려준다. */
  readonly arrange: (scenario: EmailContractScenario) => EmailSenderPort;
  /** 공급자에 실제로 전달된 멱등 키. 관찰할 수 없는 어댑터는 생략한다. */
  readonly forwardedIdempotencyKeys?: () => readonly (string | null)[];
  readonly cleanup?: () => void | Promise<void>;
}

/**
 * EmailSenderPort 계약 공유 테스트. 모든 어댑터(@nestjs/mail 전송·로그)가 같은 시나리오에서
 * 같은 공급자 중립 결과를 내고 던지지 않는다는 것을 증명한다.
 */
export function describeEmailSenderContract(harness: EmailSenderContractHarness): void {
  describe("EmailSenderPort 계약", () => {
    afterEach(async () => {
      await harness.cleanup?.();
    });

    const message = () =>
      EmailMessage.create({
        kind: "verification",
        to: RECIPIENT,
        subject: "인증 코드",
        html: `<p>${CODE}</p>`,
        text: CODE,
        tags: [{ name: "type", value: "verification" }],
        idempotencyKey: IDEMPOTENCY_KEY,
      });

    it.each(harness.scenarios)(
      "%s 상황은 벤더 중립 결과로 돌려주고 던지지 않는다",
      async (scenario) => {
        // Given
        const sender = harness.arrange(scenario);

        // When
        const outcome = await sender.send(message());

        // Then
        EXPECTED[scenario](outcome);
      },
    );

    it.each(harness.scenarios)(
      "%s 결과에는 수신자·코드·공급자 원문을 싣지 않는다",
      async (scenario) => {
        // Given
        const sender = harness.arrange(scenario);

        // When
        const outcome = await sender.send(message());

        // Then
        const serialized = JSON.stringify(outcome);
        expect(serialized).not.toContain(RECIPIENT);
        expect(serialized).not.toContain(CODE);
      },
    );

    if (harness.forwardedIdempotencyKeys != null) {
      const forwarded = harness.forwardedIdempotencyKeys;
      it("메시지의 멱등 키를 공급자에 그대로 전달한다", async () => {
        // Given
        const sender = harness.arrange("success");

        // When
        await sender.send(message());

        // Then
        expect(forwarded()).toEqual([IDEMPOTENCY_KEY]);
      });
    }
  });
}
