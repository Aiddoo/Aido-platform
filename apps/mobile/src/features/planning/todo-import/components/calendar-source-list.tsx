import type { DateKey } from '@src/shared/date/date-key';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  CalendarIllustration,
  Checkbox,
  HStack,
  ListRow,
  SettingsListGroup,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { groupBy } from 'es-toolkit';
import { Accordion, ControlField, Skeleton } from 'heroui-native';
import { type ComponentProps, useMemo } from 'react';

import {
  type FilterImportCollection,
  type ImportCollection,
  type OrderByImportCollection,
  TodoImportCollectionPolicy,
} from '../domains/todo-import-collection.model';
import { useGetImportCollectionsQueryOptions } from '../queries/todo-import-source.queries';

interface CalendarSourceListProps {
  startDate: DateKey;
  endDate: DateKey;
  /** 고른 캘린더 키. null은 아직 고르지 않아 기본 선택(공휴일·생일·구독 제외)을 보인다 */
  value: readonly string[] | null;
  onValueChange: (collectionKeys: string[]) => void;
  filters?: FilterImportCollection;
  orderBy?: OrderByImportCollection;
}

/** 계정이 이보다 많으면 계정마다 접어 한 화면에 결정 하나만 보이게 한다 */
const ACCORDION_ACCOUNT_THRESHOLD = 3;

/** 고른 기간의 캘린더를 계정별로 묶어 보인다. 기간이 바뀔 때만 기기 캘린더를 다시 읽는다 */
export function CalendarSourceList({
  startDate,
  endDate,
  value,
  onValueChange,
  filters,
  orderBy,
}: CalendarSourceListProps) {
  const { t } = useTranslation('todoImport');
  const { data: collections } = useSuspenseQuery(
    useGetImportCollectionsQueryOptions({ startDate, endDate, filters, orderBy }),
  );

  // 캘린더가 수십 개여도 고른 키·계정 묶음은 목록이나 선택이 바뀔 때만 다시 만든다
  const selectedKeys = useMemo(
    () =>
      new Set(
        TodoImportCollectionPolicy.getSelectedCollections(collections, value).map(
          (collection) => collection.collectionKey,
        ),
      ),
    [collections, value],
  );
  const otherAccountName = t('calendars.otherAccount');
  const accounts = useMemo(
    () =>
      Object.entries(
        groupBy(collections, (collection) => collection.accountName ?? otherAccountName),
      ),
    [collections, otherAccountName],
  );

  if (!collections.some(TodoImportCollectionPolicy.isSelectable)) {
    return <CalendarSourceList.Empty />;
  }

  const handleSelectedChange = (collectionKey: string, isSelected: boolean) => {
    onValueChange(
      collections
        .filter((collection) =>
          collection.collectionKey === collectionKey
            ? isSelected
            : selectedKeys.has(collection.collectionKey),
        )
        .map((collection) => collection.collectionKey),
    );
  };

  const renderGroup = (accountName: string, group: readonly ImportCollection[]) => (
    <CalendarSourceList.Group key={accountName} accountName={accountName}>
      {group.map((collection, index) => (
        <Box key={collection.collectionKey}>
          {index > 0 && <SettingsListGroup.Separator />}
          <CalendarSourceList.Item
            collection={collection}
            isSelected={selectedKeys.has(collection.collectionKey)}
            onSelectedChange={(isSelected) =>
              handleSelectedChange(collection.collectionKey, isSelected)
            }
          />
        </Box>
      ))}
    </CalendarSourceList.Group>
  );

  if (accounts.length <= ACCORDION_ACCOUNT_THRESHOLD) {
    return <VStack gap={12}>{accounts.map(([name, group]) => renderGroup(name, group))}</VStack>;
  }

  return (
    <Accordion
      selectionMode="multiple"
      defaultValue={accounts
        .filter(([, group]) =>
          group.some((collection) => selectedKeys.has(collection.collectionKey)),
        )
        .map(([name]) => name)}
      hideSeparator
      className="gap-3"
    >
      {accounts.map(([name, group]) => (
        <Accordion.Item key={name} value={name}>
          <Accordion.Trigger className="px-1 py-2">
            <Text size="b2" weight="semibold" shade={9} numberOfLines={1} className="flex-1">
              {name}
            </Text>
            <Accordion.Indicator />
          </Accordion.Trigger>
          <Accordion.Content className="px-0 pb-0">{renderGroup(name, group)}</Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

interface GroupProps extends Omit<ComponentProps<typeof SettingsListGroup>, 'label'> {
  accountName: string;
}

/** 계정 하나(iCloud·Google·Outlook)의 캘린더 묶음 */
CalendarSourceList.Group = function Group({ accountName, ...props }: GroupProps) {
  return <SettingsListGroup label={accountName} {...props} />;
};

interface ItemProps extends Omit<ComponentProps<typeof ListRow>, 'left' | 'contents' | 'right'> {
  collection: ImportCollection;
  isSelected: boolean;
  onSelectedChange: (isSelected: boolean) => void;
}

/** 캘린더 하나: 색 점, 이름(한 줄), 일정 수, 체크. 일정이 없으면 고를 수 없다. 데모가 같은 줄을 값만 바꿔 쓴다 */
CalendarSourceList.Item = function Item({
  collection,
  isSelected,
  onSelectedChange,
  className,
  ...props
}: ItemProps) {
  const { t } = useTranslation('todoImport');
  const isDisabled = !TodoImportCollectionPolicy.isSelectable(collection);
  const countLabel = t('calendars.itemCount', { count: collection.itemCount });

  return (
    <ControlField
      isSelected={isSelected}
      isDisabled={isDisabled}
      onSelectedChange={onSelectedChange}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, disabled: isDisabled }}
      accessibilityLabel={`${collection.title}, ${countLabel}`}
      className="px-4"
    >
      <ListRow
        verticalPadding="medium"
        isDisabled={isDisabled}
        className={cn('flex-1', className)}
        {...props}
        left={
          <Box
            className="size-2.5 rounded-full bg-gray-4"
            style={collection.color == null ? undefined : { backgroundColor: collection.color }}
          />
        }
        contents={
          <Text size="b2" shade={8} numberOfLines={1}>
            {collection.title}
          </Text>
        }
        right={
          <HStack align="center" gap={12}>
            <Text size="b3" shade={6} className="tabular-nums">
              {countLabel}
            </Text>
            <ControlField.Indicator>
              <Checkbox />
            </ControlField.Indicator>
          </HStack>
        }
      />
    </ControlField>
  );
};

CalendarSourceList.Loading = function Loading() {
  return (
    <SettingsListGroup>
      <ItemSkeleton />
      <SettingsListGroup.Separator />
      <ItemSkeleton />
      <SettingsListGroup.Separator />
      <ItemSkeleton />
    </SettingsListGroup>
  );
};

CalendarSourceList.Error = SettingsListGroup.Error;

CalendarSourceList.Empty = function Empty() {
  const { t } = useTranslation('todoImport');

  return (
    <SettingsListGroup.Empty
      icon={<CalendarIllustration size="block" />}
      title={t('calendars.emptyTitle')}
      description={t('calendars.emptyDescription')}
    />
  );
};

function ItemSkeleton() {
  return (
    <ListRow
      verticalPadding="medium"
      horizontalPadding="medium"
      left={<Skeleton className="size-2.5 rounded-full" />}
      contents={<TextSkeleton size="b2" className="w-28" />}
      right={<Skeleton className="size-5 rounded-md" />}
    />
  );
}
