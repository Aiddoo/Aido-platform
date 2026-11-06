import type { AiReport as AiReportDto, ReportStatus as ReportStatusDto } from '@aido/api';

import type { AiReport, ReportStatus } from '../domains/report.model';

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
