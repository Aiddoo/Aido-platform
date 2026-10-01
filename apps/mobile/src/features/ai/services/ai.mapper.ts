import type {
  AiReport as AiReportDto,
  ParsedMemoData as ParsedMemoDataDto,
  RecurringSuggestion as RecurringSuggestionDto,
  ReportStatus as ReportStatusDto,
  SuggestionActionResponse as SuggestionActionResponseDto,
} from '@aido/validators';

import {
  type AiReport,
  type AiSuggestion,
  type AiSuggestionActionResult,
  aiReportModelSchema,
  aiSuggestionActionResultSchema,
  aiSuggestionModelSchema,
  type ParsedMemoResult,
  parsedMemoResultSchema,
  type ReportStatus,
  reportStatusModelSchema,
} from '../models/ai.model';

export const toAiReport = (dto: AiReportDto): AiReport =>
  aiReportModelSchema.parse({ ...dto, generatedAt: new Date(dto.generatedAt) });

export const toReportStatus = (dto: ReportStatusDto): ReportStatus =>
  reportStatusModelSchema.parse({
    ...dto,
    nextWeeklyAt: new Date(dto.nextWeeklyAt),
    nextMonthlyAt: new Date(dto.nextMonthlyAt),
    latestWeekly: dto.latestWeekly ? toAiReport(dto.latestWeekly) : null,
    latestMonthly: dto.latestMonthly ? toAiReport(dto.latestMonthly) : null,
  });

export const toAiSuggestion = (dto: RecurringSuggestionDto): AiSuggestion =>
  aiSuggestionModelSchema.parse({
    ...dto,
    expiresAt: new Date(dto.expiresAt),
    createdAt: new Date(dto.createdAt),
  });

export const toAiSuggestionActionResult = (
  dto: SuggestionActionResponseDto,
): AiSuggestionActionResult =>
  aiSuggestionActionResultSchema.parse({ ...dto, suggestion: toAiSuggestion(dto.suggestion) });

export const toParsedMemoResult = (dto: ParsedMemoDataDto): ParsedMemoResult =>
  parsedMemoResultSchema.parse(dto);
