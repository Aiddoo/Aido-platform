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
import { match, P } from 'ts-pattern';

import {
  type TodoImportCollection,
  TodoImportCollectionPolicy,
} from '../domains/todo-import-collection.model';
import type { TodoImportRange } from '../domains/todo-import-range.model';
import {
  selectCollectionsByAccount,
  useGetImportCollectionsQueryOptions,
} from '../queries/todo-import-source.queries';

interface CalendarSourceListProps extends TodoImportRange {
  // null은 아직 고르지 않아 기본 선택(공휴일·생일·구독 제외)을 보인다
  value: readonly string[] | null;
  onChange: (collectionKeys: string[]) => void;
}

const RECEIVED_ACCORDION_VALUE = 'received';

// 고른 기간에 일정이 있는 캘린더를 계정마다 묶어 고르게 한다
export function CalendarSourceList({
  startDate,
  endDate,
  value,
  onChange,
}: CalendarSourceListProps) {
  const { t } = useTranslation('todoImport');
  const formatCalendarSource = useFormatCalendarSource();

  const { data: groups } = useSuspenseQuery({
    ...useGetImportCollectionsQueryOptions({ startDate, endDate }),
    select: selectCollectionsByAccount,
  });

  const { collections, accounts, receivedCollections } = groups;
  const selected = TodoImportCollectionPolicy.getSelectedCollections(collections, value);
  const selectedKeys = new Set(selected.map((collection) => collection.collectionKey));
  const isAtLimit = TodoImportCollectionPolicy.isAtCollectionLimit(selected);
  const hasSelectedReceived = receivedCollections.some((collection) =>
    selectedKeys.has(collection.collectionKey),
  );

  if (!collections.some((collection) => TodoImportCollectionPolicy.isSelectable(collection))) {
    return <CalendarSourceList.Empty />;
  }

  const getItemProps = (collection: TodoImportCollection) => ({
    collection,
    isSelected: selectedKeys.has(collection.collectionKey),
    // 한 번에 고를 수 있는 캘린더 수에 닿으면 고르지 않은 캘린더를 막는다. 이유는 스크린이 버튼 위에 보인다
    isDisabled: isAtLimit && !selectedKeys.has(collection.collectionKey),
    onSelectedChange: (isSelected: boolean) =>
      onChange(
        collections
          .filter(({ collectionKey }) =>
            collectionKey === collection.collectionKey
              ? isSelected
              : selectedKeys.has(collectionKey),
          )
          .map(({ collectionKey }) => collectionKey),
      ),
  });

  return (
    <VStack gap={12}>
      {accounts.map(({ accountKey, account, collections: group }) => (
        // 회사 로고는 상표 규정상 쓰지 않고, iOS 캘린더처럼 계정 이름만 글자로 보인다
        <SettingsListGroup key={accountKey} label={formatCalendarSource(account)}>
          {group.map((collection, index) => (
            <Box key={collection.collectionKey}>
              {index > 0 && <SettingsListGroup.Separator />}
              <CalendarSourceList.Item {...getItemProps(collection)} />
            </Box>
          ))}
        </SettingsListGroup>
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
              {/* 접는 목록은 머리말이 묶음 이름이라 묶음에 다시 적지 않는다 */}
              <SettingsListGroup>
                {receivedCollections.map((collection, index) => (
                  <Box key={collection.collectionKey}>
                    {index > 0 && <SettingsListGroup.Separator />}
                    <CalendarSourceList.Item {...getItemProps(collection)} />
                  </Box>
                ))}
              </SettingsListGroup>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>
      )}
    </VStack>
  );
}

interface ItemProps extends Omit<ComponentProps<typeof ControlField>, 'children'> {
  collection: TodoImportCollection;
}

// 데모가 같은 줄을 값만 바꿔 쓴다. 일정이 없는 캘린더는 스스로 막는다
function CalendarSourceListItem({
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
}

CalendarSourceListItem.Loading = function Loading() {
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
};

CalendarSourceList.Item = CalendarSourceListItem;

CalendarSourceList.Loading = function Loading() {
  return (
    <SettingsListGroup>
      <Box className="px-4 pt-4 pb-1">
        <TextSkeleton size="b2" className="w-24" />
      </Box>
      <CalendarSourceList.Item.Loading />
      <SettingsListGroup.Separator />
      <CalendarSourceList.Item.Loading />
      <SettingsListGroup.Separator />
      <CalendarSourceList.Item.Loading />
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

// 계정 캘린더는 계정 이름이고, 공휴일·생일·구독 캘린더는 계정과 상관없이 따로 모은 묶음 이름이다
function useFormatCalendarSource(): (collection: TodoImportCollection) => string {
  const { t } = useTranslation('todoImport');

  return (collection) => {
    if (TodoImportCollectionPolicy.isReceivedCalendar(collection)) {
      return t('calendars.accounts.received');
    }
    const email = TodoImportCollectionPolicy.findAccountEmail(collection);
    return match(collection.accountProvider)
      .with('icloud', () => t('calendars.accounts.icloud'))
      .with('google', () =>
        email == null
          ? t('calendars.accounts.google')
          : t('calendars.accounts.googleWithEmail', { email }),
      )
      .with('outlook', () =>
        email == null
          ? t('calendars.accounts.outlook')
          : t('calendars.accounts.outlookWithEmail', { email }),
      )
      .with('device', () => t('calendars.accounts.device'))
      .with(P.union('subscribed', 'birthdays'), () => t('calendars.otherAccount'))
      .with('other', () => collection.accountName ?? t('calendars.otherAccount'))
      .exhaustive();
  };
}
