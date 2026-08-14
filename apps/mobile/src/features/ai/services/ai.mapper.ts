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

export const toAiReport = (dto: AiReportDto): AiReport => aiReportModelSchema.parse(dto);

export const toReportStatus = (dto: ReportStatusDto): ReportStatus =>
  reportStatusModelSchema.parse(dto);

export const toAiSuggestion = (dto: RecurringSuggestionDto): AiSuggestion =>
  aiSuggestionModelSchema.parse(dto);

export const toAiSuggestionActionResult = (
  dto: SuggestionActionResponseDto,
): AiSuggestionActionResult => aiSuggestionActionResultSchema.parse(dto);

export const toParsedMemoResult = (dto: ParsedMemoDataDto): ParsedMemoResult =>
  parsedMemoResultSchema.parse(dto);
