import { useTranslation } from '@src/shared/i18n';
import { Text } from '@src/shared/ui';
import { Chip } from 'heroui-native';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

import { REPORT_TYPE_LABEL_KEYS } from '../constants/report.constants';
import type { ReportType } from '../schemas/report.schema';

type ReportTypeChipProps = Omit<ComponentProps<typeof Chip>, 'children' | 'color'> & {
  type: ReportType;
};

export function ReportTypeChip({ type, ...props }: ReportTypeChipProps) {
  const { t } = useTranslation('ai');

  return match(type)
    .with('WEEKLY', () => (
      <Chip size="sm" variant="soft" color="accent" {...props}>
        <Text size="e1" weight="medium" className="text-accent">
          {t(REPORT_TYPE_LABEL_KEYS.WEEKLY)}
        </Text>
      </Chip>
    ))
    .with('MONTHLY', () => (
      <Chip size="sm" variant="soft" color="success" {...props}>
        <Text size="e1" weight="medium" className="text-success">
          {t(REPORT_TYPE_LABEL_KEYS.MONTHLY)}
        </Text>
      </Chip>
    ))
    .exhaustive();
}
