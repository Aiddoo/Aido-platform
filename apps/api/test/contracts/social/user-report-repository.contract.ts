import type { UserReportRepositoryPort } from "#api/modules/social/reports/application/ports/user-report.repository.port";
import { UserReportId } from "#api/modules/social/reports/domain/user-report-id.vo";
import { UserReportResolutionNote } from "#api/modules/social/reports/domain/user-report-resolution-note.vo";
import { UserReportTarget } from "#api/modules/social/reports/domain/user-report-target.vo";
import type {
  UserReport,
  UserReportPrimitives,
} from "#api/modules/social/reports/domain/user-report.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createUserReportFixture,
  USER_REPORT_FIXTURE_ADMIN_ID,
  USER_REPORT_FIXTURE_COMMENT_ID,
  USER_REPORT_FIXTURE_NOW,
  USER_REPORT_FIXTURE_REPORTER_ID,
  USER_REPORT_FIXTURE_REPORTER_TAG,
  USER_REPORT_FIXTURE_TARGET_USER_ID,
  USER_REPORT_FIXTURE_TARGET_USER_TAG,
} from "#test/fixtures/social/user-report.fixture";

const REPORTER_ID = UserId.reconstitute(USER_REPORT_FIXTURE_REPORTER_ID);
const TARGET_USER_ID = UserId.reconstitute(USER_REPORT_FIXTURE_TARGET_USER_ID);
const MISSING_USER_ID = UserId.reconstitute("clz7x5p8k0999qz0z8z8z8z8z");
const NOW = USER_REPORT_FIXTURE_NOW;
const COMMENT_TARGET = UserReportTarget.reconstitute({
  type: "COMMENT",
  contentId: USER_REPORT_FIXTURE_COMMENT_ID,
});

async function saveReport(
  repository: UserReportRepositoryPort,
  overrides: Partial<UserReportPrimitives> = {},
): Promise<UserReport> {
  const report = createUserReportFixture({ id: UserReportId.generate().value, ...overrides });
  await repository.save(report);
  return report;
}

function resolvedCopyOf(report: UserReport, adminId: string, note: string): UserReport {
  const copy = createUserReportFixture(report.toPrimitives());
  copy.resolve({
    resolvedById: UserId.reconstitute(adminId),
    note: UserReportResolutionNote.create(note),
    now: NOW.add({ hours: 3 }),
  });
  return copy;
}

// 신고자·신고 대상 fixture 사용자가 그 태그로 활성 사용자인 저장소를 받는다
export function describeUserReportRepositoryContract(
  createRepository: () => Promise<UserReportRepositoryPort>,
): void {
  describe("사용자 신고 저장소 계약", () => {
    it("저장한 신고를 id로 그대로 읽고 없는 id는 null이다", async () => {
      // Given
      const repository = await createRepository();
      const report = await saveReport(repository, {
        targetType: "PROFILE",
        targetId: null,
        reason: "IMPERSONATION",
        detail: "다른 사람을 사칭해요",
      });

      // When
      const found = await repository.findById(report.id);
      const missing = await repository.findById(UserReportId.generate());

      // Then
      expect(found?.toPrimitives()).toEqual(report.toPrimitives());
      expect(missing).toBeNull();
    });

    it("since 이후(경계 포함) 같은 신고자가 같은 콘텐츠에 남긴 가장 최근 신고를 찾는다", async () => {
      // Given
      const repository = await createRepository();
      await saveReport(repository, { createdAt: NOW.subtract({ hours: 3 }) });
      const latest = await saveReport(repository, { createdAt: NOW.subtract({ hours: 2 }) });
      await saveReport(repository, { createdAt: NOW, targetId: "clz7x5p8k0098qz0z8z8z8z8z" });
      await saveReport(repository, { createdAt: NOW, targetType: "TODO", targetId: "42" });
      await saveReport(repository, {
        createdAt: NOW,
        reporterId: USER_REPORT_FIXTURE_TARGET_USER_ID,
        targetUserId: USER_REPORT_FIXTURE_REPORTER_ID,
      });
      const query = {
        reporterId: REPORTER_ID,
        targetUserId: TARGET_USER_ID,
        target: COMMENT_TARGET,
      };

      // When
      const atBoundary = await repository.findRecentByTarget({
        ...query,
        since: NOW.subtract({ hours: 2 }),
      });
      const afterLatest = await repository.findRecentByTarget({
        ...query,
        since: NOW.subtract({ hours: 2 }).add({ milliseconds: 1 }),
      });

      // Then
      expect(atBoundary?.toPrimitives()).toEqual(latest.toPrimitives());
      expect(afterLatest).toBeNull();
    });

    it("프로필 신고는 콘텐츠 id가 없는 프로필 신고끼리만 같은 대상이다", async () => {
      // Given
      const repository = await createRepository();
      await saveReport(repository);
      const profile = await saveReport(repository, { targetType: "PROFILE", targetId: null });

      // When
      const found = await repository.findRecentByTarget({
        reporterId: REPORTER_ID,
        targetUserId: TARGET_USER_ID,
        target: UserReportTarget.reconstitute({ type: "PROFILE", contentId: null }),
        since: NOW.subtract({ hours: 24 }),
      });

      // Then
      expect(found?.id.value).toBe(profile.id.value);
    });

    it("신고 수는 그 신고자가 since 이후(경계 포함) 남긴 것만 센다", async () => {
      // Given
      const repository = await createRepository();
      const since = NOW.subtract({ hours: 24 });
      await saveReport(repository, { createdAt: since });
      await saveReport(repository, { createdAt: NOW, targetType: "TODO", targetId: "1" });
      await saveReport(repository, { createdAt: since.subtract({ milliseconds: 1 }) });
      await saveReport(repository, {
        createdAt: NOW,
        reporterId: USER_REPORT_FIXTURE_TARGET_USER_ID,
        targetUserId: USER_REPORT_FIXTURE_REPORTER_ID,
      });

      // When
      const count = await repository.countByReporterSince(REPORTER_ID, since);

      // Then
      expect(count).toBe(2);
    });

    it("읽은 때의 상태 그대로일 때만 저장하고, 먼저 처리된 신고의 기록은 덮지 않는다", async () => {
      // Given
      const repository = await createRepository();
      const report = await saveReport(repository);
      const first = resolvedCopyOf(report, USER_REPORT_FIXTURE_ADMIN_ID, "댓글 삭제");
      const late = resolvedCopyOf(report, USER_REPORT_FIXTURE_TARGET_USER_ID, "위반 아님");

      // When
      const saved = [
        await repository.saveIfUnchanged(first, report.version),
        await repository.saveIfUnchanged(late, report.version),
      ];
      const stored = await repository.findById(report.id);

      // Then
      expect(saved).toEqual([true, false]);
      expect(stored?.toPrimitives()).toEqual(first.toPrimitives());
    });

    it("사용자 태그는 찾은 사용자만 담는다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const userTags = await repository.findUserTags([
        REPORTER_ID,
        TARGET_USER_ID,
        MISSING_USER_ID,
      ]);

      // Then
      expect(userTags).toEqual(
        new Map([
          [USER_REPORT_FIXTURE_REPORTER_ID, USER_REPORT_FIXTURE_REPORTER_TAG],
          [USER_REPORT_FIXTURE_TARGET_USER_ID, USER_REPORT_FIXTURE_TARGET_USER_TAG],
        ]),
      );
    });

    it("활성 사용자는 있다고 보고 없는 사용자는 없다고 본다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const exists = [
        await repository.existsActiveUser(TARGET_USER_ID),
        await repository.existsActiveUser(MISSING_USER_ID),
      ];

      // Then
      expect(exists).toEqual([true, false]);
    });
  });
}
