import type { AiReport as AiReportDto, ReportStatus as ReportStatusDto } from '@aido/api';
import { dateKeySchema } from '@src/shared/date/date-key';
import { toInstant } from '@src/shared/date/instant';
import { pick } from 'es-toolkit';

import type { ReportStatus } from '../domains/report-status.model';
import type { AiReport } from '../domains/report.model';

export function toAiReport(dto: AiReportDto): AiReport {
  return {
    ...pick(dto, ['id', 'year', 'period', 'aiSummary', 'aiTips', 'hasActivity']),
    type: dto.type,
    dateRange: {
      startDate: dateKeySchema.parse(dto.dateRange.startDate),
      endDate: dateKeySchema.parse(dto.dateRange.endDate),
    },
    stats: pick(dto.stats, [
      'totalTodos',
      'completedTodos',
      'completionRate',
      'prevCompletionRate',
      'streakDays',
    ]),
    categoryBreakdown: dto.categoryBreakdown.map((item) =>
      pick(item, ['name', 'color', 'total', 'completed', 'rate']),
    ),
    dayPatterns: dto.dayPatterns.map((item) => pick(item, ['day', 'total', 'completed', 'rate'])),
    timePatterns: dto.timePatterns.map((item) => pick(item, ['hour', 'count'])),
    generatedAt: toInstant(dto.generatedAt),
  };
}

export function toReportStatus(dto: ReportStatusDto): ReportStatus {
  return pick(dto, ['daysUntilWeekly', 'daysUntilMonthly']);
}
