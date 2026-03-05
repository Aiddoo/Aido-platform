import type { AiReport as AiReportDto, ReportStatus as ReportStatusDto } from '@aido/validators';
import {
  type AiReport,
  aiReportModelSchema,
  type ReportStatus,
  reportStatusModelSchema,
} from '../models/ai.model';

export const toAiReport = (dto: AiReportDto): AiReport => aiReportModelSchema.parse(dto);

export const toReportStatus = (dto: ReportStatusDto): ReportStatus =>
  reportStatusModelSchema.parse(dto);
