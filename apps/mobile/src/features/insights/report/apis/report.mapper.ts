import type {
  AiReport as AiReportDto,
  ReportStatus as ReportStatusDto,
} from '@aido/api/contracts/ai/v1';
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
      'perfectDays',
    ]),
    categoryBreakdown: dto.categoryBreakdown.map((item) =>
      pick(item, ['name', 'color', 'total', 'completed', 'rate']),
    ),
    timePatterns: dto.timePatterns.map((item) => pick(item, ['hour', 'count'])),
    peakHour: dto.peakHour,
    dailyCompletions:
      dto.dailyCompletions?.map((day) => ({
        ...pick(day, ['total', 'completed']),
        date: dateKeySchema.parse(day.date),
      })) ?? null,
    aiContentSource: dto.aiContentSource ?? null,
    generatedAt: toInstant(dto.generatedAt),
  };
}

export function toReportStatus(dto: ReportStatusDto): ReportStatus {
  return {
    nextWeeklyAt: toInstant(dto.nextWeeklyAt),
    nextMonthlyAt: toInstant(dto.nextMonthlyAt),
  };
}
