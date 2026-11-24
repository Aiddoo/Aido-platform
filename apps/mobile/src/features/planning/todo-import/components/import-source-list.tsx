import { useTranslation } from '@src/shared/i18n';
import { HStack, SettingsListGroup, Text, VStack } from '@src/shared/ui';
import { compact } from 'es-toolkit';
import type { ComponentProps } from 'react';

import type { ImportCollection } from '../domains/todo-import-collection.model';
import {
  CALENDAR_SOURCE_LABEL_KEYS,
  groupCollectionsBySource,
  type ImportSourceGroup,
} from '../utils/todo-import.view-model';
import { CalendarSourceBadge } from './calendar-source-badge';

interface ImportSourceListProps extends Omit<
  ComponentProps<typeof SettingsListGroup>,
  'children' | 'label'
> {
  collections: readonly ImportCollection[];
}

/** 가져올 일정을 출처 계정마다 한 줄로 줄여 보인다. 캘린더가 많아도 계정 수만큼만 길어진다 */
export function ImportSourceList({ collections, ...props }: ImportSourceListProps) {
  const groups = groupCollectionsBySource(collections);

  return (
    <SettingsListGroup {...props}>
      {groups.map((group, index) => (
        <VStack key={group.sourceKey}>
          {index > 0 && <SettingsListGroup.Separator />}
          <ImportSourceList.Row group={group} />
        </VStack>
      ))}
    </SettingsListGroup>
  );
}

/** [서비스] 캘린더 이름들 · 일정 수. 같은 서비스 계정이 둘이면 둘째 줄에 계정을 붙여 가린다 */
ImportSourceList.Row = function Row({ group }: { group: ImportSourceGroup }) {
  const { t } = useTranslation('todoImport');
  const count = t('calendars.itemCount', { count: group.itemCount });

  return (
    <HStack
      align="center"
      accessible
      accessibilityLabel={compact([
        t(CALENDAR_SOURCE_LABEL_KEYS[group.provider]),
        group.accountLabel,
        group.calendarNames,
        count,
      ]).join(', ')}
      className="min-h-12 gap-2 px-4 py-3"
    >
      <CalendarSourceBadge provider={group.provider} />
      <VStack flex={1} gap={2}>
        <Text size="b3" shade={8} numberOfLines={1}>
          {group.calendarNames}
        </Text>
        {group.accountLabel != null && (
          <Text size="b4" shade={6} numberOfLines={1}>
            {group.accountLabel}
          </Text>
        )}
      </VStack>
      <Text size="b3" shade={7} className="tabular-nums">
        {count}
      </Text>
    </HStack>
  );
};
