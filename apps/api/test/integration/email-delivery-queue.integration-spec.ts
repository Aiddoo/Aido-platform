import { Test, type TestingModule } from "@nestjs/testing";
import { PgBoss } from "pg-boss";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { EMAIL_DELIVERY_QUEUE_PORT } from "#api/modules/notification/application/ports/email/email-delivery-queue.port";
import { EMAIL_SENDER } from "#api/modules/notification/application/ports/email/email-sender.port";
import { EmailDeliveryQueueAdapter } from "#api/modules/notification/infrastructure/adapters/email/email-delivery-queue.adapter";
import { ResendEmailSenderAdapter } from "#api/modules/notification/infrastructure/adapters/email/resend-email-sender.adapter";
import { EmailDeliveryQueueProcessor } from "#api/modules/notification/infrastructure/jobs/email/email-delivery-queue.processor";
import {
  deliverEmailProvider,
  emailBudgetProvider,
  transactionalEmailSenderProvider,
} from "#api/modules/notification/notification-email-application.providers";
import { TransactionalEmailSender } from "#api/modules/notification/notification-email.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { EncryptionService } from "#api/platform/encryption/encryption.service";
import { PgBossJobRuntimeAdapter } from "#api/platform/jobs/pg-boss-job-runtime.adapter";
import { USAGE_METER } from "#api/platform/metering/interfaces/usage-meter.interface";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { OPERATIONAL_ALERT } from "#api/shared/application/ports/operational-alert.port";
import { InMemoryUsageMeterAdapter } from "#test/mocks/in-memory-usage-meter.adapter";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";
import { resendResponseFixture, StubResendHttp } from "#test/mocks/resend-http.stub";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase } from "#test/setup/test-database";

const SCHEMA = "pgboss";
const recipient = "private@example.com";
const reportOf = (reportId: string) => ({
  reportId,
  reporterId: "u1",
  reporterTag: "A",
  targetUserId: "u2",
  targetUserTag: "B",
  targetType: "PROFILE" as const,
  targetTypeLabel: "사용자",
  targetId: null,
  reason: "SPAM" as const,
  reasonLabel: "스팸",
  detail: null,
  submittedAt: "2026-03-09 10:00",
  resolutionEndpoint: "POST /x",
  resolutionDocsUrl: null,
});
const code = "987654";

async function eventually(assertion: () => Promise<void>, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw lastError;
}

describe("이메일 발송 큐 (실제 pg-boss + PostgreSQL)", () => {
  let testDatabase: TestDatabase;
  let boss: PgBoss;
  let runtime: PgBossJobRuntimeAdapter;
  let module: TestingModule;
  let sender: TransactionalEmailSender;
  let http: StubResendHttp;
  const alerts = new RecordingOperationalAlert();

  beforeAll(async () => {
    suppressLogger();
    testDatabase = new TestDatabase();
    const client = await testDatabase.start();
    const connectionString = testDatabase.getConnectionUri();
    const migrator = new PgBoss({
      connectionString,
      schema: SCHEMA,
      migrate: true,
      createSchema: true,
    });
    await migrator.start();
    await migrator.stop({ graceful: true, timeout: 10_000, close: true });
    boss = new PgBoss({
      connectionString,
      schema: SCHEMA,
      migrate: false,
      createSchema: false,
      max: 3,
    });
    runtime = new PgBossJobRuntimeAdapter(boss, createDatabaseTransactionFixture(client).txHost, {
      job: { shutdownTimeoutMs: 10_000 },
    });
    await runtime.start();

    vi.stubEnv("RESEND_BASE_URL", "https://api.resend.com");
    const config = mock<TypedConfigService>({
      email: {
        provider: "resend",
        apiKey: "fixture-api-key",
        from: "noreply@integration-test.com",
        fromName: "Integration Test",
        supportEmail: "support@example.com",
      },
      nodeEnv: "test",
      tokenEncryptionKey: "test-token-encryption-key-minimum-32-characters-long",
      tokenEncryptionSalt: undefined,
    });
    const policies = new OutboundPolicyRegistry(alerts);
    module = await Test.createTestingModule({
      providers: [
        { provide: TypedConfigService, useValue: config },
        { provide: USAGE_METER, useValue: new InMemoryUsageMeterAdapter() },
        { provide: OPERATIONAL_ALERT, useValue: alerts },
        { provide: OutboundPolicyRegistry, useValue: policies },
        EncryptionService,
        emailBudgetProvider,
        transactionalEmailSenderProvider,
        deliverEmailProvider,
        EmailDeliveryQueueProcessor,
        {
          provide: EMAIL_SENDER,
          useFactory: () =>
            new ResendEmailSenderAdapter(
              {
                apiKey: "fixture-api-key",
                from: "noreply@integration-test.com",
                fromName: "Integration Test",
                environment: "test",
              },
              policies,
            ),
        },
        {
          provide: EMAIL_DELIVERY_QUEUE_PORT,
          useFactory: (encryption: EncryptionService) =>
            new EmailDeliveryQueueAdapter(runtime, encryption),
          inject: [EncryptionService],
        },
      ],
    }).compile();
    sender = module.get(TransactionalEmailSender);
    const processor = module.get(EmailDeliveryQueueProcessor);
    await runtime.work(
      "email-delivery.v1",
      async (jobs) => {
        for (const job of jobs) {
          await processor.process(job.attempt, job.data);
        }
      },
      { teamSize: 2, pollingIntervalSeconds: 1 },
    );
  });

  afterAll(async () => {
    await runtime?.stop();
    await module?.close();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await testDatabase?.stop();
  });

  beforeEach(() => {
    http = new StubResendHttp([]);
    vi.stubGlobal("fetch", http.fetch);
    alerts.alerts.length = 0;
  });

  it("담긴 잡은 암호화되어 있고 worker가 풀어서 한 번 발송한 뒤 완료한다", async () => {
    // Given
    http = new StubResendHttp([resendResponseFixture("send.success.json")]);
    vi.stubGlobal("fetch", http.fetch);

    // When
    const dispatch = await sender.sendVerificationCode(recipient, { code, expiryMinutes: 15 });

    // Then
    expect(dispatch).toEqual({ status: "queued" });
    await eventually(async () => {
      const jobs = await boss.findJobs("email-delivery.v1");
      expect(http.requests).toHaveLength(1);
      expect(jobs.every((job) => job.state === "completed")).toBe(true);
      expect(JSON.stringify(jobs.map((job) => job.data))).not.toContain(code);
      expect(JSON.stringify(jobs.map((job) => job.data))).not.toContain(recipient);
    });
    expect(http.requests).toHaveLength(1);
    expect(http.request().headers.get("idempotency-key")).toEqual(expect.any(String));
    expect(await http.request().json()).toEqual(
      expect.objectContaining({ to: recipient, text: expect.stringContaining(code) }),
    );
  });

  it("같은 deliveryId로 두 번 요청해도 큐에는 한 번만 담겨 한 번만 발송한다", async () => {
    // Given
    http = new StubResendHttp([resendResponseFixture("send.success.json")]);
    vi.stubGlobal("fetch", http.fetch);

    // When
    const results = await Promise.all([
      sender.sendUserReport(recipient, reportOf("delivery-duplicate")),
      sender.sendUserReport(recipient, reportOf("delivery-duplicate")),
    ]);

    // Then
    expect(results).toEqual([{ status: "queued" }, { status: "queued" }]);
    await eventually(async () => {
      const jobs = await boss.findJobs("email-delivery.v1", {
        key: "user-report:delivery-duplicate",
      });
      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.state).toBe("completed");
    });
    expect(http.requests).toHaveLength(1);
  });

  it("일시 장애는 pg-boss가 backoff로 다시 불러 같은 멱등 키로 보내 성공한다", async () => {
    // Given
    http = new StubResendHttp([
      resendResponseFixture("send.application-error.json", 500),
      resendResponseFixture("send.success.json"),
    ]);
    vi.stubGlobal("fetch", http.fetch);

    // When
    await sender.sendUserReport(recipient, reportOf("delivery-retry"));

    // Then
    await eventually(async () => {
      const [job] = await boss.findJobs("email-delivery.v1", { key: "user-report:delivery-retry" });
      expect(job?.state).toBe("completed");
    });
    expect(http.requests).toHaveLength(2);
    expect(http.request(0).headers.get("idempotency-key")).toBe("user-report:delivery-retry");
    expect(http.request(1).headers.get("idempotency-key")).toBe("user-report:delivery-retry");
  }, 60_000);
});
