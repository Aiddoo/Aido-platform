import { USER_REPORT_LIMITS } from "@aido/api/vocabulary";

import { UserReport } from "#api/modules/social/domain/aggregates/reports/user-report.aggregate";
import { UserReportTarget } from "#api/modules/social/domain/value-objects/reports/user-report-target.vo";
import type { MutationLockPort, UnitOfWorkPort } from "#api/shared/application/ports/index";
import { FakeLogger } from "#test/mocks/fake-logger.service";
import {
  StubUserReportNotifier,
  StubUserReportRepository,
} from "#test/mocks/ports/social-reports.stub";

import { ReportContent } from "./report-content.use-case.js";

const NOW = new Date("2026-10-26T09:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

function createFixture() {
  const userReportRepository = new StubUserReportRepository();
  userReportRepository.addUser("reporter", "REPORTER");
  userReportRepository.addUser("target", "TARGET01");
  const notifier = new StubUserReportNotifier();
  const unitOfWork: UnitOfWorkPort = { run: async (work) => work() };
  const mutationLock: MutationLockPort = { acquire: async () => {} };
  const logger = new FakeLogger();
  return {
    userReportRepository,
    notifier,
    logger,
    useCase: new ReportContent({
      userReportRepository,
      notifier,
      unitOfWork,
      mutationLock,
      logger,
    }),
  };
}

function seedReport(
  repository: StubUserReportRepository,
  createdAt: Date,
  target = UserReportTarget.of("COMMENT", "clz7x5p8k0099qz0z8z8z8z8z"),
) {
  repository.reports.push(
    UserReport.reconstitute({
      id: `seed-${repository.reports.length + 1}`,
      reporterId: "reporter",
      targetUserId: "target",
      target,
      reason: "SPAM",
      detail: null,
      status: "OPEN",
      createdAt,
    }),
  );
}

const commentReport = {
  reporterId: "reporter",
  targetUserId: "target",
  targetType: "COMMENT",
  targetId: "clz7x5p8k0099qz0z8z8z8z8z",
  reason: "HARASSMENT",
  detail: "계속 욕설을 해요",
} as const;

describe("콘텐츠 신고", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("신고를 저장하고 운영자에게 사유·대상 라벨과 태그를 담아 알린다", async () => {
    // Given
    const fixture = createFixture();

    // When
    const result = await fixture.useCase.execute(commentReport);

    // Then
    expect(result.isDuplicate).toBe(false);
    expect(fixture.userReportRepository.reports).toHaveLength(1);
    expect(fixture.notifier.submissions).toEqual([
      expect.objectContaining({
        reportId: result.report.id,
        reporterTag: "REPORTER",
        targetUserTag: "TARGET01",
        reasonLabel: "괴롭힘·혐오",
        targetTypeLabel: "댓글",
        detail: "계속 욕설을 해요",
        submittedAt: "2026-10-26 18:00 (KST)",
      }),
    ]);
  });

  it("24시간 안에 같은 댓글을 다시 신고하면 새로 접수하지 않고 운영자에게도 다시 알리지 않는다", async () => {
    // Given
    const fixture = createFixture();
    seedReport(fixture.userReportRepository, new Date(NOW.getTime() - 23 * HOUR_MS));

    // When
    const result = await fixture.useCase.execute(commentReport);

    // Then
    expect(result.isDuplicate).toBe(true);
    expect(result.report.id).toBe("seed-1");
    expect(fixture.userReportRepository.reports).toHaveLength(1);
    expect(fixture.notifier.submissions).toEqual([]);
  });

  it("24시간이 지난 같은 대상 신고는 새로 접수한다", async () => {
    // Given
    const fixture = createFixture();
    seedReport(fixture.userReportRepository, new Date(NOW.getTime() - 25 * HOUR_MS));

    // When
    const result = await fixture.useCase.execute(commentReport);

    // Then
    expect(result.isDuplicate).toBe(false);
    expect(fixture.userReportRepository.reports).toHaveLength(2);
  });

  it("최근 24시간 신고가 한도에 도달하면 새 대상도 거부한다", async () => {
    // Given
    const fixture = createFixture();
    for (let index = 0; index < USER_REPORT_LIMITS.DAILY_LIMIT; index += 1) {
      seedReport(
        fixture.userReportRepository,
        new Date(NOW.getTime() - HOUR_MS),
        UserReportTarget.of("TODO", String(index + 1)),
      );
    }

    // When / Then
    await expect(fixture.useCase.execute(commentReport)).rejects.toMatchObject({
      errorCode: "REPORT_2254",
    });
    expect(fixture.notifier.submissions).toEqual([]);
  });

  it("운영자 알림이 실패해도 접수한 신고는 그대로 둔다", async () => {
    // Given
    const fixture = createFixture();
    fixture.notifier.shouldFail = true;
    const warn = vi.spyOn(fixture.logger, "warn");

    // When
    const result = await fixture.useCase.execute(commentReport);

    // Then
    expect(result.report.status).toBe("OPEN");
    expect(fixture.userReportRepository.reports).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "social.report.operator-notify.failed" }),
    );
  });

  it("탈퇴했거나 없는 사용자는 신고할 수 없다", async () => {
    // Given
    const fixture = createFixture();

    // When / Then
    await expect(
      fixture.useCase.execute({ ...commentReport, targetUserId: "missing" }),
    ).rejects.toMatchObject({ errorCode: "REPORT_2252" });
  });

  it("상세 내용은 로그에 남기지 않는다", async () => {
    // Given
    const fixture = createFixture();
    const log = vi.spyOn(fixture.logger, "log");

    // When
    await fixture.useCase.execute(commentReport);

    // Then
    expect(JSON.stringify(log.mock.calls)).not.toContain(commentReport.detail);
  });
});
