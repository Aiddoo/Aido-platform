import { ErrorCode } from "@aido/api/errors";
import { USER_REPORT_LIMITS } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryUserReportRepository } from "#test/doubles/social/in-memory-user-report.repository";
import { RecordingUserReportNotifier } from "#test/doubles/social/recording-user-report-notifier";
import {
  createUserReportFixture,
  USER_REPORT_FIXTURE_COMMENT_ID,
  USER_REPORT_FIXTURE_NOW,
  USER_REPORT_FIXTURE_REPORTER_ID,
  USER_REPORT_FIXTURE_REPORTER_TAG,
  USER_REPORT_FIXTURE_TARGET_USER_ID,
  USER_REPORT_FIXTURE_TARGET_USER_TAG,
} from "#test/fixtures/social/user-report.fixture";

import type { UserReport } from "../../domain/user-report.aggregate.js";
import { UserReportLockKeys } from "../reports.lock-keys.js";
import { UserReportLogEvent } from "../reports.log-events.js";
import { type ReportContentDependencies, ReportContentUseCase } from "./report-content.use-case.js";

const NOW = USER_REPORT_FIXTURE_NOW;

const COMMENT_REPORT = {
  reporterId: USER_REPORT_FIXTURE_REPORTER_ID,
  targetUserId: USER_REPORT_FIXTURE_TARGET_USER_ID,
  targetType: "COMMENT",
  targetId: USER_REPORT_FIXTURE_COMMENT_ID,
  reason: "HARASSMENT",
  detail: "계속 욕설을 해요",
} as const;

function createRepository(reports: readonly UserReport[] = []): InMemoryUserReportRepository {
  return new InMemoryUserReportRepository({
    reports,
    activeUserTags: {
      [USER_REPORT_FIXTURE_REPORTER_ID]: USER_REPORT_FIXTURE_REPORTER_TAG,
      [USER_REPORT_FIXTURE_TARGET_USER_ID]: USER_REPORT_FIXTURE_TARGET_USER_TAG,
    },
  });
}

function createReportContentUseCase(overrides: Partial<ReportContentDependencies> = {}) {
  return new ReportContentUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    userReportRepository: createRepository(),
    notifier: new RecordingUserReportNotifier(),
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
    ...overrides,
  });
}

function sameCommentReportAt(createdAt: Temporal.Instant, index = 0): UserReport {
  return createUserReportFixture({
    id: `cseed${String(index).padStart(20, "0")}`,
    createdAt,
  });
}

describe("ReportContentUseCase — 콘텐츠 신고", () => {
  it("신고자 잠금 안에서 저장하고 운영자에게 사유·대상 라벨과 태그, 한국 시각을 담아 알린다", async () => {
    // Given
    const userReportRepository = createRepository();
    const notifier = new RecordingUserReportNotifier();
    const mutationLock = new RecordingMutationLock();
    const useCase = createReportContentUseCase({ userReportRepository, notifier, mutationLock });

    // When
    const report = await useCase.execute(COMMENT_REPORT);

    // Then
    expect(report.toPrimitives()).toEqual({
      id: report.id.value,
      reporterId: USER_REPORT_FIXTURE_REPORTER_ID,
      targetUserId: USER_REPORT_FIXTURE_TARGET_USER_ID,
      targetType: "COMMENT",
      targetId: USER_REPORT_FIXTURE_COMMENT_ID,
      reason: "HARASSMENT",
      detail: "계속 욕설을 해요",
      status: "OPEN",
      createdAt: NOW,
      resolvedAt: null,
      resolvedById: null,
      resolutionNote: null,
    });
    expect((await userReportRepository.findById(report.id))?.toPrimitives()).toEqual(
      report.toPrimitives(),
    );
    expect(notifier.submissions).toEqual([
      {
        reportId: report.id.value,
        reporterId: USER_REPORT_FIXTURE_REPORTER_ID,
        reporterTag: USER_REPORT_FIXTURE_REPORTER_TAG,
        targetUserId: USER_REPORT_FIXTURE_TARGET_USER_ID,
        targetUserTag: USER_REPORT_FIXTURE_TARGET_USER_TAG,
        targetType: "COMMENT",
        targetId: USER_REPORT_FIXTURE_COMMENT_ID,
        reason: "HARASSMENT",
        detail: "계속 욕설을 해요",
        submittedAt: NOW,
      },
    ]);
    expect(mutationLock.acquiredKeys).toEqual([
      [UserReportLockKeys.reporter(UserId.reconstitute(USER_REPORT_FIXTURE_REPORTER_ID))],
    ]);
  });

  it.each([
    { name: "23시간 전", createdAt: NOW.subtract({ hours: 23 }) },
    { name: "정확히 24시간 전", createdAt: NOW.subtract({ hours: 24 }) },
  ])(
    "$name 같은 댓글을 신고했으면 기존 신고를 돌려주고 새로 저장하거나 다시 알리지 않는다",
    async ({ createdAt }) => {
      // Given
      const earlier = sameCommentReportAt(createdAt);
      const userReportRepository = createRepository([earlier]);
      const notifier = new RecordingUserReportNotifier();
      const logger = new SilentLogger();
      const useCase = createReportContentUseCase({ userReportRepository, notifier, logger });

      // When
      const report = await useCase.execute(COMMENT_REPORT);

      // Then
      expect(report.toPrimitives()).toEqual(earlier.toPrimitives());
      expect(userReportRepository.size).toBe(1);
      expect(notifier.submissions).toEqual([]);
      expect(logger.messages).toEqual([
        {
          event: UserReportLogEvent.DUPLICATE_IGNORED,
          userId: USER_REPORT_FIXTURE_REPORTER_ID,
          reportId: earlier.id.value,
        },
      ]);
    },
  );

  it("24시간이 지난 같은 대상 신고는 새로 접수한다", async () => {
    // Given
    const userReportRepository = createRepository([
      sameCommentReportAt(NOW.subtract({ hours: 24 }).subtract({ milliseconds: 1 })),
    ]);
    const useCase = createReportContentUseCase({ userReportRepository });

    // When
    await useCase.execute(COMMENT_REPORT);

    // Then
    expect(userReportRepository.size).toBe(2);
  });

  it("최근 24시간 신고가 한도에 도달하면 새 대상도 REPORT_2254로 거부하고 저장·알림하지 않는다", async () => {
    // Given
    const userReportRepository = createRepository(
      Array.from({ length: USER_REPORT_LIMITS.DAILY_LIMIT }, (_, index) =>
        createUserReportFixture({
          id: `cseed${String(index).padStart(20, "0")}`,
          targetType: "TODO",
          targetId: String(index + 1),
          createdAt: NOW.subtract({ hours: 1 }),
        }),
      ),
    );
    const notifier = new RecordingUserReportNotifier();
    const useCase = createReportContentUseCase({ userReportRepository, notifier });

    // When
    const result = useCase.execute(COMMENT_REPORT);

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.REPORT_2254,
      details: { current: USER_REPORT_LIMITS.DAILY_LIMIT },
    });
    expect(userReportRepository.size).toBe(USER_REPORT_LIMITS.DAILY_LIMIT);
    expect(notifier.submissions).toEqual([]);
  });

  it("한도에 도달했어도 24시간 안의 같은 대상 재신고는 한도보다 먼저 기존 신고로 돌려준다", async () => {
    // Given
    const reports = Array.from({ length: USER_REPORT_LIMITS.DAILY_LIMIT }, (_, index) =>
      sameCommentReportAt(NOW.subtract({ hours: 1 }), index),
    );
    const useCase = createReportContentUseCase({ userReportRepository: createRepository(reports) });

    // When
    const report = await useCase.execute(COMMENT_REPORT);

    // Then
    expect(report.status).toBe("OPEN");
    expect(reports.map((seeded) => seeded.id.value)).toContain(report.id.value);
  });

  it("24시간이 지난 신고는 하루 한도에 세지 않는다", async () => {
    // Given
    const userReportRepository = createRepository(
      Array.from({ length: USER_REPORT_LIMITS.DAILY_LIMIT }, (_, index) =>
        createUserReportFixture({
          id: `cseed${String(index).padStart(20, "0")}`,
          targetType: "TODO",
          targetId: String(index + 1),
          createdAt: NOW.subtract({ hours: 24 }).subtract({ milliseconds: 1 }),
        }),
      ),
    );
    const useCase = createReportContentUseCase({ userReportRepository });

    // When
    await useCase.execute(COMMENT_REPORT);

    // Then
    expect(userReportRepository.size).toBe(USER_REPORT_LIMITS.DAILY_LIMIT + 1);
  });

  it("탈퇴했거나 없는 사용자는 REPORT_2252로 거부한다", async () => {
    // Given
    const missingUserId = "clz7x5p8k0999qz0z8z8z8z8z";
    const useCase = createReportContentUseCase();

    // When
    const result = useCase.execute({ ...COMMENT_REPORT, targetUserId: missingUserId });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.REPORT_2252,
      details: { targetUserId: missingUserId },
    });
  });

  it("대상 콘텐츠 id 형식 오류는 자기 신고보다 먼저 REPORT_2253으로 거부하고 잠금을 잡지 않는다", async () => {
    // Given
    const mutationLock = new RecordingMutationLock();
    const useCase = createReportContentUseCase({ mutationLock });

    // When
    const result = useCase.execute({
      ...COMMENT_REPORT,
      targetUserId: USER_REPORT_FIXTURE_REPORTER_ID,
      targetId: "42",
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.REPORT_2253,
      details: { targetType: "COMMENT" },
    });
    expect(mutationLock.acquiredKeys).toEqual([]);
  });

  it("자기 자신은 REPORT_2251로 거부한다", async () => {
    // Given
    const useCase = createReportContentUseCase();

    // When
    const result = useCase.execute({
      ...COMMENT_REPORT,
      targetUserId: USER_REPORT_FIXTURE_REPORTER_ID,
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.REPORT_2251 });
  });

  it.each([
    {
      name: "거절",
      notifier: new RecordingUserReportNotifier({
        status: "rejected",
        reason: "queue_unavailable",
      }),
      warning: { errorType: "delivery-rejected", reason: "queue_unavailable" },
    },
    {
      name: "예외",
      notifier: new RecordingUserReportNotifier(new Error("발송 실패")),
      warning: { errorType: "delivery-error" },
    },
  ])(
    "운영자 알림이 $name로 끝나도 접수한 신고는 그대로 두고 경고를 남긴다",
    async ({ notifier, warning }) => {
      // Given
      const userReportRepository = createRepository();
      const logger = new SilentLogger();
      const useCase = createReportContentUseCase({ userReportRepository, notifier, logger });

      // When
      const report = await useCase.execute(COMMENT_REPORT);

      // Then
      expect((await userReportRepository.findById(report.id))?.status).toBe("OPEN");
      expect(logger.messages.at(-1)).toEqual({
        event: UserReportLogEvent.OPERATOR_NOTIFY_FAILED,
        reportId: report.id.value,
        ...warning,
      });
    },
  );

  it("상세 내용은 로그에 남기지 않는다", async () => {
    // Given
    const logger = new SilentLogger();
    const useCase = createReportContentUseCase({ logger });

    // When
    await useCase.execute(COMMENT_REPORT);

    // Then
    expect(JSON.stringify(logger.messages)).not.toContain(COMMENT_REPORT.detail);
  });
});
