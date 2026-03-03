import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	AI_PROVIDER,
	type AiProvider,
} from "@/modules/ai/providers/ai.provider";
import {
	buildReportPrompt,
	reportAiResponseSchema,
} from "./prompts/weekly-report.prompt";
import type { GeneratedReportContent, GenerateReportParams } from "./types";

/** AI 리포트 생성 기본 설정 */
const REPORT_AI_MAX_TOKENS = 500;
const REPORT_AI_TEMPERATURE = 0.7;

/**
 * AI 리포트 콘텐츠 생성 서비스
 *
 * AI Provider를 사용하여 집계 데이터를 기반으로 요약과 팁을 생성합니다.
 * AI가 불가용할 경우 폴백 콘텐츠를 반환합니다.
 *
 * 시스템 호출이므로 사용자 사용량 제한에 포함되지 않습니다.
 * (AiService 대신 AI_PROVIDER를 직접 주입)
 */
@Injectable()
export class ReportGeneratorService {
	readonly #logger = new Logger(ReportGeneratorService.name);

	constructor(@Inject(AI_PROVIDER) private readonly aiProvider: AiProvider) {}

	/**
	 * AI 리포트 콘텐츠 생성
	 *
	 * AI 호출 실패 시 폴백 콘텐츠를 반환합니다.
	 */
	async generate(
		params: GenerateReportParams,
	): Promise<GeneratedReportContent> {
		const { aggregatedData, periodLabel } = params;

		if (!this.aiProvider.isAvailable()) {
			this.#logger.warn("AI Provider 불가용 — 폴백 콘텐츠 사용");
			return this.#buildFallbackContent(aggregatedData.hasActivity);
		}

		try {
			const prompt = buildReportPrompt(aggregatedData, periodLabel);

			const result = await this.aiProvider.generateStructured({
				prompt,
				schema: reportAiResponseSchema,
				maxTokens: REPORT_AI_MAX_TOKENS,
				temperature: REPORT_AI_TEMPERATURE,
			});

			this.#logger.debug(
				`AI 리포트 생성 완료: model=${result.model}, tokens=${result.usage.input}+${result.usage.output}`,
			);

			return {
				aiSummary: result.output.summary,
				aiTips: result.output.tips,
			};
		} catch (error) {
			this.#logger.error(
				`AI 리포트 생성 실패 — 폴백 사용: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
			return this.#buildFallbackContent(aggregatedData.hasActivity);
		}
	}

	/**
	 * AI 불가용 시 폴백 콘텐츠
	 */
	#buildFallbackContent(hasActivity: boolean): GeneratedReportContent {
		if (!hasActivity) {
			return {
				aiSummary:
					"이번 기간에는 등록된 할 일이 없었어요. 다음에는 작은 목표부터 시작해보세요!",
				aiTips: ["하루에 할 일 1개씩 등록하는 습관을 만들어보세요."],
			};
		}

		return {
			aiSummary:
				"이번 기간의 할 일 통계를 기반으로 리포트가 생성되었습니다. 자세한 통계는 위의 데이터를 확인해주세요.",
			aiTips: [
				"매일 같은 시간에 할 일을 정리하는 루틴을 만들어보세요.",
				"큰 할 일은 작은 단위로 나누면 달성률이 올라요.",
			],
		};
	}
}
