import { Inject, Injectable, Logger } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "@/ai";
import {
	buildReportPrompt,
	getReportAiResponseSchema,
} from "../../domain/services/prompts/report.prompt";
import { buildFallbackContent } from "../../domain/services/prompts/report-fallback";
import type {
	GeneratedReportContent,
	GenerateReportParams,
} from "../../domain/types";

/** AI 리포트 생성 기본 설정 */
const REPORT_AI_MAX_TOKENS = 800;
const REPORT_AI_TEMPERATURE = 0.7;

/**
 * AI 리포트 콘텐츠 생성 서비스
 *
 * AI Provider를 사용하여 집계 데이터를 기반으로 요약과 팁을 생성합니다.
 * AI가 불가용할 경우 폴백 콘텐츠를 반환합니다.
 *
 * 시스템 호출이므로 사용자 사용량 제한에 포함되지 않습니다.
 * (AiFacade 대신 AI_PROVIDER를 직접 주입)
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
		const { aggregatedData, periodLabel, type, locale = "ko" } = params;

		if (!this.aiProvider.isAvailable()) {
			this.#logger.warn("AI Provider 불가용 — 폴백 콘텐츠 사용");
			return buildFallbackContent(aggregatedData.hasActivity, locale);
		}

		try {
			const prompt = buildReportPrompt(
				aggregatedData,
				periodLabel,
				type,
				{
					prevTips: params.prevTips,
				},
				locale,
			);

			const result = await this.aiProvider.generateStructured({
				prompt,
				schema: getReportAiResponseSchema(locale),
				maxOutputTokens: REPORT_AI_MAX_TOKENS,
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
			return buildFallbackContent(aggregatedData.hasActivity, locale);
		}
	}
}
