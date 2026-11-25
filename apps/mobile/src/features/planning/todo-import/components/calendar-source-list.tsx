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
import { Accordion, ControlField, Skeleton } from 'heroui-native';
import type { ComponentProps } from 'react';

import {
  type ImportCollection,
  TodoImportCollectionPolicy,
} from '../domains/todo-import-collection.model';
import { useFormatCalendarSource } from '../hooks/use-format-calendar-source';
import { useGetImportCollectionsQueryOptions } from '../queries/todo-import-source.queries';
import { groupCollectionsByAccount } from '../utils/todo-import.view-model';

interface CalendarSourceListProps {
  startDate: DateKey;
  endDate: DateKey;
  /** null은 아직 고르지 않아 기본 선택(공휴일·생일·구독 제외)을 보인다 */
  value: readonly string[] | null;
  onValueChange: (collectionKeys: string[]) => void;
}

const RECEIVED_ACCORDION_VALUE = 'received';

export function CalendarSourceList({
  startDate,
  endDate,
  value,
  onValueChange,
}: CalendarSourceListProps) {
  const { t } = useTranslation('todoImport');
  const { data: collections } = useSuspenseQuery(
    useGetImportCollectionsQueryOptions({ startDate, endDate }),
  );

  const selected = TodoImportCollectionPolicy.getSelectedCollections(collections, value);
  const selectedKeys = new Set(selected.map((collection) => collection.collectionKey));
  const isAtLimit = TodoImportCollectionPolicy.isAtCollectionLimit(selected);
  const formatCalendarSource = useFormatCalendarSource();
  const { accounts, receivedCollections } = groupCollectionsByAccount(collections);

  if (!collections.some((collection) => TodoImportCollectionPolicy.isSelectable(collection))) {
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

  // 접는 목록은 머리말이 계정 이름이라 묶음에 다시 적지 않는다
  const renderGroup = (group: readonly ImportCollection[], account?: ImportCollection) => (
    <CalendarSourceList.Group
      accountName={account == null ? undefined : formatCalendarSource(account)}
    >
      {group.map((collection, index) => (
        <Box key={collection.collectionKey}>
          {index > 0 && <SettingsListGroup.Separator />}
          <CalendarSourceList.Item
            collection={collection}
            isSelected={selectedKeys.has(collection.collectionKey)}
            // 한 번에 고를 수 있는 캘린더 수에 닿으면 고르지 않은 캘린더를 막는다. 이유는 스크린이 버튼 위에 보인다
            isDisabled={isAtLimit && !selectedKeys.has(collection.collectionKey)}
            onSelectedChange={(isSelected) =>
              handleSelectedChange(collection.collectionKey, isSelected)
            }
          />
        </Box>
      ))}
    </CalendarSourceList.Group>
  );

  const hasSelectedReceived = receivedCollections.some((collection) =>
    selectedKeys.has(collection.collectionKey),
  );

  return (
    <VStack gap={12}>
      {accounts.map(({ accountKey, account, collections: group }) => (
        <Box key={accountKey}>{renderGroup(group, account)}</Box>
      ))}

      {receivedCollections.length > 0 && (
        <Accordion
          selectionMode="multiple"
          defaultValue={hasSelectedReceived ? [RECEIVED_ACCORDION_VALUE] : []}
          hideSeparator
        >
          <Accordion.Item value={RECEIVED_ACCORDION_VALUE}>
            <Accordion.Trigger className="min-h-12 px-1 py-2">
              <Text size="b2" weight="semibold" shade={9} numberOfLines={1} className="flex-1">
                {t('calendars.receivedTitle', { count: receivedCollections.length })}
              </Text>
              <Accordion.Indicator />
            </Accordion.Trigger>
            <Accordion.Content className="px-0 pb-0">
              {renderGroup(receivedCollections)}
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>
      )}
    </VStack>
  );
}

interface GroupProps extends Omit<ComponentProps<typeof SettingsListGroup>, 'label'> {
  accountName?: string;
}

/** 회사 로고는 상표 규정상 쓰지 않고, iOS 캘린더처럼 계정 이름만 글자로 보인다 */
CalendarSourceList.Group = function Group({ accountName, ...props }: GroupProps) {
  return <SettingsListGroup label={accountName} {...props} />;
};

interface ItemProps extends Omit<ComponentProps<typeof ControlField>, 'children'> {
  collection: ImportCollection;
}

/** 데모가 같은 줄을 값만 바꿔 쓴다. 일정이 없는 캘린더는 스스로 막는다 */
CalendarSourceList.Item = function Item({
  collection,
  isSelected,
  isDisabled: isDisabledByParent = false,
  className,
  ...props
}: ItemProps) {
  const { t } = useTranslation('todoImport');
  const hasEvents = TodoImportCollectionPolicy.isSelectable(collection);
  const isDisabled = !hasEvents || isDisabledByParent;
  // 고른 기간에 일정이 없어 고를 수 없는 이유를 개수 대신 말로 보인다
  const countLabel = hasEvents
    ? t('calendars.itemCount', { count: collection.itemCount })
    : t('calendars.noEventsInRange');

  return (
    <ControlField
      isSelected={isSelected}
      isDisabled={isDisabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected === true, disabled: isDisabled }}
      accessibilityLabel={`${collection.title}, ${countLabel}`}
      className={cn('min-h-12 px-4', className)}
      {...props}
    >
      <ListRow
        verticalPadding="medium"
        isDisabled={isDisabled}
        className="flex-1"
        left={
          <Box
            className="size-2.5 rounded-full bg-gray-4"
            style={collection.color == null ? undefined : { backgroundColor: collection.color }}
          />
        }
        contents={
          <Text size="b2" shade={8} numberOfLines={2}>
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
      <Box className="px-4 pt-4 pb-1">
        <TextSkeleton size="b2" className="w-24" />
      </Box>
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
      className="min-h-12"
      left={<Skeleton className="size-2.5 rounded-full" />}
      contents={<TextSkeleton size="b2" className="w-28" />}
      right={<Skeleton className="size-5 rounded-md" />}
    />
  );
}
