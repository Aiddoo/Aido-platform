import { Global, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PgBoss } from "pg-boss";
import { vi } from "vitest";

import { EMAIL_DELIVERY_QUEUE } from "#api/modules/notification/email/infrastructure/jobs/email-delivery.queue";
import { notificationEmailConfig } from "#api/modules/notification/email/notification-email.config";
import {
  NotificationEmailModule,
  SendTransactionalEmailUseCase,
} from "#api/modules/notification/notification-email.public";
import { EncryptionService } from "#api/platform/encryption/encryption.service";
import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import { USAGE_METER } from "#api/platform/metering/interfaces/usage-meter.interface";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import {
  OPERATIONAL_ALERT,
  OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";
import { DateClock } from "#test/doubles/platform/date-clock";
import { InMemoryUsageMeterAdapter } from "#test/mocks/in-memory-usage-meter.adapter";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";
import { resendResponseFixture, StubResendHttp } from "#test/mocks/resend-http.stub";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase } from "#test/setup/test-database";

const FIXTURE_EMAIL_CONFIG = notificationEmailConfig.parse({
  NODE_ENV: "test",
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "fixture-api-key",
  EMAIL_FROM: "noreply@integration-test.com",
  EMAIL_FROM_NAME: "Integration Test",
});
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
  let module: TestingModule;
  let sender: SendTransactionalEmailUseCase;
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
    await boss.start();
    const jobQueue = new PgBossJobQueueAdapter(
      boss,
      createDatabaseTransactionFixture(client).txHost,
      new JobQueueRegistry(),
      { shutdownTimeoutMs: 10_000 },
    );

    @Global()
    @Module({
      providers: [
        { provide: JobQueuePort, useValue: jobQueue },
        { provide: USAGE_METER, useValue: new InMemoryUsageMeterAdapter() },
        { provide: OPERATIONAL_ALERT, useValue: alerts },
        { provide: OperationalAlertPort, useValue: alerts },
        { provide: ClockPort, useClass: DateClock },
        OutboundPolicyRegistry,
        {
          provide: EncryptionService,
          useValue: new EncryptionService({
            key: "test-token-encryption-key-minimum-32-characters-long",
            salt: undefined,
          }),
        },
      ],
      exports: [
        JobQueuePort,
        USAGE_METER,
        OPERATIONAL_ALERT,
        OperationalAlertPort,
        ClockPort,
        OutboundPolicyRegistry,
        EncryptionService,
      ],
    })
    class PlatformStubModule {}

    // 운영 배선 그대로 올려 processor가 onModuleInit에서 email-delivery.v1 worker를 등록한다
    module = await Test.createTestingModule({
      imports: [PlatformStubModule, NotificationEmailModule],
    })
      .overrideProvider(notificationEmailConfig.KEY)
      .useValue(FIXTURE_EMAIL_CONFIG)
      .compile();
    await module.init();
    sender = module.get(SendTransactionalEmailUseCase);
  });

  afterAll(async () => {
    await module?.close();
    await boss?.stop({ graceful: false, close: true });
    vi.unstubAllGlobals();
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
      const jobs = await boss.findJobs(EMAIL_DELIVERY_QUEUE.name);
      expect(http.requests).toHaveLength(1);
      expect(jobs.every((job) => job.state === "completed")).toBe(true);
      expect(JSON.stringify(jobs.map((job) => job.data))).not.toContain(code);
      expect(JSON.stringify(jobs.map((job) => job.data))).not.toContain(recipient);
    });
    expect(http.requests).toHaveLength(1);
    expect(http.request().headers.get("idempotency-key")).toEqual(expect.any(String));
    expect(await http.request().json()).toEqual(
      expect.objectContaining({ to: [recipient], text: expect.stringContaining(code) }),
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
      const jobs = await boss.findJobs(EMAIL_DELIVERY_QUEUE.name, {
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
      const [job] = await boss.findJobs(EMAIL_DELIVERY_QUEUE.name, {
        key: "user-report:delivery-retry",
      });
      expect(job?.state).toBe("completed");
    });
    expect(http.requests).toHaveLength(2);
    expect(http.request(0).headers.get("idempotency-key")).toBe("user-report:delivery-retry");
    expect(http.request(1).headers.get("idempotency-key")).toBe("user-report:delivery-retry");
  }, 60_000);
});
