import type {
  AdminNotifierPort,
  AdminNotifyOutcome,
} from "../../../src/modules/operations/admin-notices/application/ports/admin-notifier.port.js";
import type { AdminNotice } from "../../../src/modules/operations/admin-notices/application/read-models/admin-notice.read-model.js";

const ADMIN_NOTIFIER_CONTRACT_SCENARIOS = [
  "sent",
  "not-configured",
  "server-error",
  "rate-limited",
  "rejected",
  "unreachable",
] as const;
export type AdminNotifierContractScenario = (typeof ADMIN_NOTIFIER_CONTRACT_SCENARIOS)[number];

export const CONTRACT_NOTICE: AdminNotice = {
  type: "message",
  message: {
    title: "contract-private-title",
    body: "contract-private-body",
    severity: "warning",
    fields: [
      { label: "텍스트", value: { kind: "text", text: "contract-private-field" }, inline: true },
      { label: "시각", value: { kind: "datetime", iso: "2026-11-05T00:00:00.000Z" } },
    ],
    link: "https://example.com/contract-private-link",
  },
};

/** 사용자 블록이 있는 구독 알림도 같은 계약을 지킨다. */
const CONTRACT_SUBSCRIPTION_NOTICE: AdminNotice = {
  type: "subscription_event",
  user: {
    userId: "contract-private-user",
    email: "contract-private@example.com",
    nickname: "contract-private-name",
    userTag: "CONTRACT",
  },
  subscription: {
    event: "billing_issue",
    environment: "PRODUCTION",
    productId: "contract-private-product",
    price: { usd: 1 },
    customerUrl: "https://example.com/contract-private-customer",
  },
};

const EXPECTED: Record<AdminNotifierContractScenario, AdminNotifyOutcome> = {
  sent: { status: "sent" },
  "not-configured": { status: "skipped", reason: "not_configured" },
  "server-error": { status: "failed", retryable: true, statusCode: 500 },
  "rate-limited": { status: "failed", retryable: true, statusCode: 429 },
  rejected: { status: "failed", retryable: false, statusCode: 404 },
  unreachable: { status: "failed", retryable: true },
};

export interface AdminNotifierContractHarness {
  /** 어댑터가 낼 수 있는 시나리오만 적는다. 없는 시나리오는 계약에서 뺀다. */
  readonly scenarios: readonly AdminNotifierContractScenario[];
  readonly arrange: (scenario: AdminNotifierContractScenario) => AdminNotifierPort;
  readonly cleanup?: () => void | Promise<void>;
}

/**
 * AdminNotifierPort 계약 공유 테스트. 모든 어댑터(Discord·로그·향후 Slack)가 같은 시나리오에서
 * 같은 벤더 중립 결과를 내고 던지지 않으며 원문 오류를 결과에 싣지 않는다는 것을 증명한다.
 */
export function describeAdminNotifierContract(harness: AdminNotifierContractHarness): void {
  describe("AdminNotifierPort 계약", () => {
    afterEach(async () => {
      await harness.cleanup?.();
    });

    it.each(harness.scenarios)(
      "%s 상황은 벤더 중립 결과로 돌려주고 던지지 않는다",
      async (scenario) => {
        // Given
        const notifier = harness.arrange(scenario);

        // When
        const outcome = await notifier.send("admin", CONTRACT_NOTICE);

        // Then
        expect(outcome).toEqual(EXPECTED[scenario]);
      },
    );

    it.each(harness.scenarios)(
      "%s 결과에는 알림 내용·URL·공급자 원문을 싣지 않는다",
      async (scenario) => {
        // Given
        const notifier = harness.arrange(scenario);

        // When
        const outcome = await notifier.send("payment", CONTRACT_SUBSCRIPTION_NOTICE);

        // Then
        expect(JSON.stringify(outcome)).not.toContain("contract-private");
      },
    );
  });
}
