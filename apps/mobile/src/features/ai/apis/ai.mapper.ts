import type {
  AiReport as AiReportDto,
  RecurringSuggestion as RecurringSuggestionDto,
  ReportStatus as ReportStatusDto,
  SuggestionActionResponse as SuggestionActionResponseDto,
} from '@aido/api';

import type {
  AiReport,
  AiSuggestion,
  AiSuggestionActionResult,
  ReportStatus,
} from '../domains/ai.model';

export const toAiReport = (dto: AiReportDto): AiReport => ({
  ...dto,
  generatedAt: new Date(dto.generatedAt),
});

export const toReportStatus = (dto: ReportStatusDto): ReportStatus => ({
  ...dto,
  nextWeeklyAt: new Date(dto.nextWeeklyAt),
  nextMonthlyAt: new Date(dto.nextMonthlyAt),
  latestWeekly: dto.latestWeekly ? toAiReport(dto.latestWeekly) : null,
  latestMonthly: dto.latestMonthly ? toAiReport(dto.latestMonthly) : null,
});

export const toAiSuggestion = (dto: RecurringSuggestionDto): AiSuggestion => ({
  ...dto,
  expiresAt: new Date(dto.expiresAt),
  createdAt: new Date(dto.createdAt),
});

export const toAiSuggestionActionResult = (
  dto: SuggestionActionResponseDto,
): AiSuggestionActionResult => ({ ...dto, suggestion: toAiSuggestion(dto.suggestion) });
