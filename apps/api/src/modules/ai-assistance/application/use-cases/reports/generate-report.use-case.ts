import type { AiReport as AiReportDto } from "@aido/api";
import dayjs from "dayjs";

import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { type AiProvider } from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import type { UserMutationLockPort } from "#api/modules/identity/identity-user-access.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import type { SupportedLocale } from "#api/shared/domain/locale";

import { assembleAggregatedData } from "../../../domain/services/reports/report-aggregation.js";
import type {
  AggregatedReportData,
  AggregateParams,
  GeneratedReportContent,
  GenerateReportParams,
  ReportType,
} from "../../../domain/types/reports/ai-report.types.js";
import { AiReportLogEvent } from "../../observability/reports/ai-report-log.events.js";
import { type AiReportRepositoryPort } from "../../ports/reports/ai-report.repository.port.js";
import { type TodoStatsReaderPort } from "../../ports/reports/todo-stats.reader.port.js";
import { aiPromptCatalog } from "../../prompts/ai-prompt.catalog.js";
import { toAiReportView } from "../../read-models/reports/ai-report.read-model.js";
import { computePeriodLabel } from "../../read-models/reports/report-period-label.js";
import { buildFallbackContent } from "../../services/reports/report-fallback.js";

/** AI 리포트 생성 기본 설정 */
const REPORT_AI_MAX_TOKENS = 800;

/** 기간 윈도우 계산 결과 */
interface ReportWindow {
  year: number;
  period: number;
  startDate: Date;
  endDate: Date;
  prevStartDate: Date;
  prevEndDate: Date;
}

/**
 * AI 리포트 생성 use-case.
 *
 * 주간/월간 데이터를 집계하고 AI 분석을 수행하여 리포트를 저장한다.
 * 같은 기간 리포트가 이미 존재하면 생성하지 않고 null을 반환한다.
 */
interface GenerateReportDependencies {
  readonly aiReportRepository: Pick<AiReportRepositoryPort, "exists" | "findLatest" | "create">;
  readonly todoStatsReader: Pick<TodoStatsReaderPort, "fetchAggregationInputs">;
  readonly aiProvider: Pick<AiProvider, "isAvailable" | "generateStructured">;
  readonly logger: Pick<ApplicationLogger, "log" | "debug" | "warn" | "error">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "hasPremiumAccessInTx">;
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
}

export class GenerateReport {
  readonly #dependencies: GenerateReportDependencies;

  constructor(dependencies: GenerateReportDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: {
    userId: string;
    timezone: string;
    type: ReportType;
    locale?: SupportedLocale;
  }): Promise<AiReportDto | null> {
    const { userId, timezone, type, locale = "ko" } = input;
    if (!(await this.#dependencies.entitlementReader.hasPremiumAccessInTx(userId))) {
      this.#dependencies.logger.debug({
        event: AiReportLogEvent.SKIPPED,
        userId,
        type,
        reason: "not-premium",
      });
      return null;
    }
    const localNow = dayjs(now()).tz(timezone);

    const window =
      type === "WEEKLY"
        ? this.#weeklyWindow(localNow, timezone)
        : this.#monthlyWindow(localNow, timezone);

    const exists = await this.#dependencies.aiReportRepository.exists(
      userId,
      type,
      window.year,
      window.period,
    );
    if (exists) {
      this.#dependencies.logger.debug({
        event: AiReportLogEvent.SKIPPED,
        userId,
        type,
        reason: "already-exists",
      });
      return null;
    }

    return this.#generateReport({
      userId,
      timezone,
      type,
      year: window.year,
      period: window.period,
      startDate: window.startDate,
      endDate: window.endDate,
      prevStartDate: window.prevStartDate,
      prevEndDate: window.prevEndDate,
      periodLabel: computePeriodLabel(type, window.year, window.period, locale),
      locale,
    });
  }

  /** 지난 주(월~일) 윈도우 */
  #weeklyWindow(localNow: dayjs.Dayjs, timezone: string): ReportWindow {
    // 달력 label을 먼저 계산하고 각 경계를 다시 타임존에 적용해 DST offset을 갱신한다.
    const lastWeekStart = dayjs
      .utc(localNow.format("YYYY-MM-DD"))
      .subtract(1, "week")
      .startOf("isoWeek");
    const lastWeekEnd = lastWeekStart.add(1, "week");
    const prevWeekStart = lastWeekStart.subtract(1, "week");
    const prevWeekEnd = lastWeekStart;
    return {
      year: lastWeekStart.isoWeekYear(),
      period: lastWeekStart.isoWeek(),
      startDate: parseLocalDateTime(lastWeekStart.format("YYYY-MM-DD"), "00:00", timezone),
      endDate: parseLocalDateTime(lastWeekEnd.format("YYYY-MM-DD"), "00:00", timezone),
      prevStartDate: parseLocalDateTime(prevWeekStart.format("YYYY-MM-DD"), "00:00", timezone),
      prevEndDate: parseLocalDateTime(prevWeekEnd.format("YYYY-MM-DD"), "00:00", timezone),
    };
  }

  /** 지난 달 윈도우 */
  #monthlyWindow(localNow: dayjs.Dayjs, timezone: string): ReportWindow {
    const lastMonth = dayjs.utc(localNow.format("YYYY-MM-DD")).subtract(1, "month");
    const lastMonthStart = lastMonth.startOf("month");
    const lastMonthEnd = lastMonthStart.add(1, "month");
    const prevMonthStart = lastMonthStart.subtract(1, "month");
    const prevMonthEnd = lastMonthStart;
    return {
      year: lastMonthStart.year(),
      period: lastMonthStart.month() + 1,
      startDate: parseLocalDateTime(lastMonthStart.format("YYYY-MM-DD"), "00:00", timezone),
      endDate: parseLocalDateTime(lastMonthEnd.format("YYYY-MM-DD"), "00:00", timezone),
      prevStartDate: parseLocalDateTime(prevMonthStart.format("YYYY-MM-DD"), "00:00", timezone),
      prevEndDate: parseLocalDateTime(prevMonthEnd.format("YYYY-MM-DD"), "00:00", timezone),
    };
  }

  /**
   * 리포트 생성 오케스트레이션
   */
  async #generateReport(params: {
    userId: string;
    timezone: string;
    locale: SupportedLocale;
    type: ReportType;
    year: number;
    period: number;
    startDate: Date;
    endDate: Date;
    prevStartDate: Date;
    prevEndDate: Date;
    periodLabel: string;
  }): Promise<AiReportDto | null> {
    const {
      userId,
      timezone,
      type,
      year,
      period,
      startDate,
      endDate,
      prevStartDate,
      prevEndDate,
      periodLabel,
      locale,
    } = params;

    const [aggregatedData, prevReport] = await Promise.all([
      this.#aggregate({
        userId,
        startDate,
        endDate,
        prevStartDate,
        prevEndDate,
        timezone,
      }),
      this.#dependencies.aiReportRepository.findLatest(userId, type),
    ]);

    const prevTips = prevReport === null ? null : [...prevReport.aiTips];

    const aiContent = await this.#generateAiContent({
      aggregatedData,
      type,
      periodLabel,
      prevTips,
      locale,
    });

    // 외부 공급자 호출 뒤에만 transaction을 시작한다.
    const report = await this.#dependencies.unitOfWork.run(async () => {
      const { userMutationLock, entitlementReader, aiReportRepository } = this.#dependencies;
      if (
        !(await userMutationLock.lockById(userId)) ||
        !(await entitlementReader.hasPremiumAccessInTx(userId))
      ) {
        return null;
      }
      if (await aiReportRepository.exists(userId, type, year, period)) return null;
      return aiReportRepository.create({
        userId,
        type,
        year,
        period,
        stats: {
          totalTodos: aggregatedData.totalTodos,
          completedTodos: aggregatedData.completedTodos,
          completionRate: aggregatedData.completionRate,
          prevCompletionRate: aggregatedData.prevCompletionRate,
          streakDays: aggregatedData.streakDays,
        },
        categoryBreakdown: aggregatedData.categoryBreakdown,
        dayPatterns: aggregatedData.dayPatterns,
        timePatterns: aggregatedData.timePatterns,
        aiSummary: aiContent.aiSummary,
        aiTips: aiContent.aiTips,
        locale,
        hasActivity: aggregatedData.hasActivity,
        generatedAt: now(),
      });
    });
    if (report === null) {
      this.#dependencies.logger.debug({
        event: AiReportLogEvent.SKIPPED,
        userId,
        type,
        reason: "save-ineligible-or-duplicate",
      });
      return null;
    }
    this.#dependencies.logger.log({
      event: AiReportLogEvent.SAVED,
      reportId: report.id,
      userId,
      type,
    });

    return toAiReportView(report);
  }

  /**
   * 데이터 집계: 할 일 통계 읽기 포트로 원시 집계를 조회하고 도메인 서비스로 계산.
   */
  async #aggregate(params: AggregateParams): Promise<AggregatedReportData> {
    const inputs = await this.#dependencies.todoStatsReader.fetchAggregationInputs(params);
    return assembleAggregatedData(inputs, params.startDate, params.endDate, params.timezone);
  }

  /**
   * AI 콘텐츠 생성: AI Provider로 요약·팁 생성. 불가용/실패 시 폴백.
   * 시스템 호출이므로 사용량 제한에 포함되지 않는다(AI_PROVIDER 직접 사용).
   */
  async #generateAiContent(params: GenerateReportParams): Promise<GeneratedReportContent> {
    const { aggregatedData, periodLabel, type, locale = "ko" } = params;

    if (!this.#dependencies.aiProvider.isAvailable()) {
      this.#dependencies.logger.warn({ event: AiReportLogEvent.PROVIDER_UNAVAILABLE });
      return buildFallbackContent(aggregatedData.hasActivity, locale);
    }

    try {
      const { build, schema } = aiPromptCatalog[locale].report;
      const { system, prompt } = build(aggregatedData, periodLabel, type, {
        prevTips: params.prevTips,
      });

      const result = await this.#dependencies.aiProvider.generateStructured({
        system,
        prompt,
        schema,
        maxOutputTokens: REPORT_AI_MAX_TOKENS,
      });

      this.#dependencies.logger.debug({
        event: AiReportLogEvent.GENERATION_COMPLETED,
        model: result.model,
        tokenUsage: result.usage,
      });

      return {
        aiSummary: result.output.summary,
        aiTips: result.output.tips,
      };
    } catch {
      this.#dependencies.logger.error({
        event: AiReportLogEvent.PROVIDER_FAILED,
        errorType: "AiProviderError",
      });
      return buildFallbackContent(aggregatedData.hasActivity, locale);
    }
  }
}
