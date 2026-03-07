import type {
  AiReport as AiReportDto,
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
  type ReportStatus,
  reportStatusModelSchema,
} from '../models/ai.model';

export const toAiReport = (dto: AiReportDto): AiReport => aiReportModelSchema.parse(dto);

export const toReportStatus = (dto: ReportStatusDto): ReportStatus =>
  reportStatusModelSchema.parse(dto);

export const toAiSuggestion = (dto: RecurringSuggestionDto): AiSuggestion =>
  aiSuggestionModelSchema.parse(dto);

export const toAiSuggestionActionResult = (
  dto: SuggestionActionResponseDto,
): AiSuggestionActionResult => aiSuggestionActionResultSchema.parse(dto);
