import type { ReportType } from '@src/features/insights/report/domains/report.model';
import type { Chip } from 'heroui-native';
import type { ComponentProps } from 'react';

export const REPORT_TYPE_LABEL_KEYS = {
  WEEKLY: 'report.typeWeekly',
  MONTHLY: 'report.typeMonthly',
} as const satisfies Record<ReportType, string>;

export const REPORT_TYPE_CHIP_COLORS = {
  WEEKLY: 'accent',
  MONTHLY: 'success',
} as const satisfies Record<ReportType, ComponentProps<typeof Chip>['color']>;
