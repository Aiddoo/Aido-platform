import { AiReportRepositoryPort } from "#api/modules/ai-assistance/reports/application/ports/ai-report.repository.port";
import { DuplicateAiReportError } from "#api/modules/ai-assistance/reports/application/reports.errors";
import { AiReportId } from "#api/modules/ai-assistance/reports/domain/ai-report-id.vo";
import { AiReport } from "#api/modules/ai-assistance/reports/domain/ai-report.aggregate";
import type { ReportType } from "#api/modules/ai-assistance/reports/domain/ai-report.constants";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

function copyOf(report: AiReport): AiReport {
  return AiReport.reconstitute(report.toPrimitives());
}

// Drizzle 저장소와 같은 순서(분석 시각·id 내림차순)로 나열한다
function compareLatestFirst(left: AiReport, right: AiReport): number {
  const leftPrimitives = left.toPrimitives();
  const rightPrimitives = right.toPrimitives();
  return (
    Temporal.Instant.compare(rightPrimitives.generatedAt, leftPrimitives.generatedAt) ||
    right.id.value - left.id.value
  );
}

export class InMemoryAiReportRepository extends AiReportRepositoryPort {
  readonly #reports = new Map<number, AiReport>();
  #sequence = 0;

  constructor(reports: readonly AiReport[] = []) {
    super();
    for (const report of reports) {
      this.#reports.set(report.id.value, copyOf(report));
    }
    this.#sequence = Math.max(0, ...this.#reports.keys());
  }

  get saved(): readonly AiReport[] {
    return [...this.#reports.values()].map(copyOf);
  }

  async nextId(): Promise<AiReportId> {
    this.#sequence += 1;
    return AiReportId.reconstitute(this.#sequence);
  }

  async save(report: AiReport): Promise<void> {
    const saved = report.toPrimitives();
    const duplicate = [...this.#reports.values()].some((existing) => {
      const primitives = existing.toPrimitives();
      return (
        primitives.id !== saved.id &&
        primitives.userId === saved.userId &&
        primitives.type === saved.type &&
        primitives.year === saved.year &&
        primitives.period === saved.period
      );
    });
    if (duplicate) {
      throw new DuplicateAiReportError();
    }
    this.#reports.set(saved.id, copyOf(report));
  }

  async findByIdAndUserId(reportId: AiReportId, userId: UserId): Promise<AiReport | null> {
    const report = this.#reports.get(reportId.value);
    return report != null && report.toPrimitives().userId === userId.value ? copyOf(report) : null;
  }

  async findLatest(userId: UserId, type: ReportType): Promise<AiReport | null> {
    const [latest] = await this.listByUserId({ userId, type, limit: 1 });
    return latest ?? null;
  }

  async listByUserId(params: {
    readonly userId: UserId;
    readonly type: ReportType | null;
    readonly limit: number;
  }): Promise<AiReport[]> {
    return [...this.#reports.values()]
      .filter(
        (report) =>
          report.toPrimitives().userId === params.userId.value &&
          (params.type == null || report.type === params.type),
      )
      .sort(compareLatestFirst)
      .slice(0, params.limit)
      .map(copyOf);
  }

  async existsForPeriod(params: {
    readonly userId: UserId;
    readonly type: ReportType;
    readonly year: number;
    readonly period: number;
  }): Promise<boolean> {
    return [...this.#reports.values()].some((report) => {
      const primitives = report.toPrimitives();
      return (
        primitives.userId === params.userId.value &&
        primitives.type === params.type &&
        primitives.year === params.year &&
        primitives.period === params.period
      );
    });
  }
}
