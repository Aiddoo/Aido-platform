import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  AI_REPORT_FIXTURE_NOW,
  AI_REPORT_FIXTURE_USER_ID,
  createAiReportFixture,
} from "#test/fixtures/ai-assistance/ai-report.fixture";

import { AiReportId } from "./ai-report-id.vo.js";
import { AiReport } from "./ai-report.aggregate.js";

describe("AiReport", () => {
  it("만든 리포트는 분석 시각을 now로 두고 꺼낸 값과 같은 값으로 복원된다", () => {
    // Given
    const {
      id: _id,
      userId: _userId,
      generatedAt: _at,
      ...content
    } = createAiReportFixture().toPrimitives();

    // When
    const report = AiReport.create({
      ...content,
      id: AiReportId.reconstitute(7),
      userId: UserId.reconstitute(AI_REPORT_FIXTURE_USER_ID),
      contentSource: "TEMPLATE",
      now: AI_REPORT_FIXTURE_NOW,
    });

    // Then
    expect(report.toPrimitives()).toMatchObject({ id: 7, generatedAt: AI_REPORT_FIXTURE_NOW });
    expect(AiReport.reconstitute(report.toPrimitives()).toPrimitives()).toEqual(
      report.toPrimitives(),
    );
  });

  it("입력 통계·배열을 바꿔도 저장된 리포트가 바뀌지 않는다", () => {
    // Given
    const primitives = createAiReportFixture().toPrimitives();
    const stats = { ...primitives.stats };
    const tips = [...primitives.aiTips];
    const report = AiReport.reconstitute({ ...primitives, stats, aiTips: tips });

    // When
    stats.totalTodos = 999;
    tips.push("외부 팁");

    // Then
    expect(report.stats.totalTodos).toBe(10);
    expect(report.aiTips).toEqual(primitives.aiTips);
  });
});
