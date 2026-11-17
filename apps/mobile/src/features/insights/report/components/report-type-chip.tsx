import { useTranslation } from '@src/shared/i18n';
import { LabelChip } from '@src/shared/ui';
import type { Chip } from 'heroui-native';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

import type { ReportType } from '../domains/report.model';
import { getReportTypeLabelKey } from '../utils/report-label.view-model';

type ReportTypeChipProps = Omit<ComponentProps<typeof Chip>, 'children' | 'color' | 'variant'> & {
  type: ReportType;
};

export function ReportTypeChip({ type, ...props }: ReportTypeChipProps) {
  const { t } = useTranslation('ai');

  return match(type)
    .with('WEEKLY', () => (
      <LabelChip color="accent" label={t(getReportTypeLabelKey('WEEKLY'))} {...props} />
    ))
    .with('MONTHLY', () => (
      <LabelChip color="success" label={t(getReportTypeLabelKey('MONTHLY'))} {...props} />
    ))
    .exhaustive();
}
