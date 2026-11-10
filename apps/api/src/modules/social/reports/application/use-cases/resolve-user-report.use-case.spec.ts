import { ErrorCode } from "@aido/api/errors";

import type { UserReportId } from "#api/modules/social/reports/domain/user-report-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { InMemoryUserReportRepository } from "#test/doubles/social/in-memory-user-report.repository";
import {
  createUserReportFixture,
  USER_REPORT_FIXTURE_ADMIN_ID,
  USER_REPORT_FIXTURE_NOW,
} from "#test/fixtures/social/user-report.fixture";

import type { UserReport } from "../../domain/user-report.aggregate.js";
import {
  type ResolveUserReportDependencies,
  ResolveUserReportUseCase,
} from "./resolve-user-report.use-case.js";

const RESOLVED_AT = USER_REPORT_FIXTURE_NOW.add({ hours: 3 });
const OPEN_REPORT = createUserReportFixture();
const RESOLVED_REPORT = createUserReportFixture({
  status: "RESOLVED",
  resolvedAt: USER_REPORT_FIXTURE_NOW.add({ hours: 1 }),
  resolvedById: "clz7x5p8k0204qz0z8z8z8z8z",
  resolutionNote: "위반 아님",
});

// 처음 읽은 직후 다른 운영자가 먼저 처리한 기록을 저장해 둔다
class ResolvedAfterReadRepository extends InMemoryUserReportRepository {
  #winner: UserReport | null;

  constructor(report: UserReport, winner: UserReport) {
    super({ reports: [report] });
    this.#winner = winner;
  }

  override async findById(reportId: UserReportId): Promise<UserReport | null> {
    const found = await super.findById(reportId);
    const winner = this.#winner;
    this.#winner = null;
    if (winner != null) {
      await this.save(winner);
    }
    return found;
  }
}

function createResolveUserReportUseCase(overrides: Partial<ResolveUserReportDependencies> = {}) {
  return new ResolveUserReportUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    userReportRepository: new InMemoryUserReportRepository({ reports: [OPEN_REPORT] }),
    clock: new FixedClock(RESOLVED_AT),
    ...overrides,
  });
}

describe("ResolveUserReportUseCase — 운영자 신고 처리", () => {
  it("조치 내용을 남기고 처리 완료로 바꿔 저장한다", async () => {
    // Given
    const userReportRepository = new InMemoryUserReportRepository({ reports: [OPEN_REPORT] });
    const useCase = createResolveUserReportUseCase({ userReportRepository });

    // When
    const report = await useCase.execute({
      reportId: OPEN_REPORT.id.value,
      adminId: USER_REPORT_FIXTURE_ADMIN_ID,
      note: " 댓글 삭제 후 경고 ",
    });

    // Then
    expect(report.toPrimitives()).toEqual({
      ...OPEN_REPORT.toPrimitives(),
      status: "RESOLVED",
      resolvedAt: RESOLVED_AT,
      resolvedById: USER_REPORT_FIXTURE_ADMIN_ID,
      resolutionNote: "댓글 삭제 후 경고",
    });
    expect((await userReportRepository.findById(OPEN_REPORT.id))?.toPrimitives()).toEqual(
      report.toPrimitives(),
    );
  });

  it("없는 신고는 조치 내용 검증보다 먼저 REPORT_2255로 거부한다", async () => {
    // Given
    const useCase = createResolveUserReportUseCase({
      userReportRepository: new InMemoryUserReportRepository(),
    });

    // When
    const result = useCase.execute({
      reportId: OPEN_REPORT.id.value,
      adminId: USER_REPORT_FIXTURE_ADMIN_ID,
      note: "   ",
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.REPORT_2255,
      details: { reportId: OPEN_REPORT.id.value },
    });
  });

  it("이미 처리한 신고는 첫 처리 기록을 그대로 돌려준다", async () => {
    // Given
    const userReportRepository = new InMemoryUserReportRepository({ reports: [RESOLVED_REPORT] });
    const useCase = createResolveUserReportUseCase({ userReportRepository });

    // When
    const report = await useCase.execute({
      reportId: RESOLVED_REPORT.id.value,
      adminId: USER_REPORT_FIXTURE_ADMIN_ID,
      note: "다시 처리",
    });

    // Then
    expect(report.toPrimitives()).toEqual(RESOLVED_REPORT.toPrimitives());
    expect((await userReportRepository.findById(RESOLVED_REPORT.id))?.toPrimitives()).toEqual(
      RESOLVED_REPORT.toPrimitives(),
    );
  });

  it("읽은 뒤 다른 운영자가 먼저 처리했으면 먼저 저장된 처리 기록을 돌려준다", async () => {
    // Given
    const userReportRepository = new ResolvedAfterReadRepository(OPEN_REPORT, RESOLVED_REPORT);
    const useCase = createResolveUserReportUseCase({ userReportRepository });

    // When
    const report = await useCase.execute({
      reportId: OPEN_REPORT.id.value,
      adminId: USER_REPORT_FIXTURE_ADMIN_ID,
      note: "댓글 삭제",
    });

    // Then
    expect(report.toPrimitives()).toEqual(RESOLVED_REPORT.toPrimitives());
  });
});
