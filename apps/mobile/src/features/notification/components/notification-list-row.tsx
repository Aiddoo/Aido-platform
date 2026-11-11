import { formatRelativeTimeLabel } from '@src/shared/date/format/date-labels';
import { type Instant } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, ListRow, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { range } from 'es-toolkit';
import { PressableFeedback, Separator } from 'heroui-native';
import { type ComponentProps, Fragment } from 'react';
import { ScrollView } from 'react-native';

import type { DateSectionKey } from '../utils/date-section';

const LOADING_ROW_COUNT = 5;

interface NotificationListRowProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children'
> {
  label: string;
  title: string;
  body: string;
  createdAt: Instant;
  isUnread?: boolean;
}

export function NotificationListRow({
  label,
  title,
  body,
  createdAt,
  isUnread = false,
  ...props
}: NotificationListRowProps) {
  const dateFormatContext = useDateFormatContext();
  const now = useMinuteNow();

  return (
    <PressableFeedback {...props}>
      {/* oxlint-disable-next-line aido/no-classname-concat -- 1.15.2 전환 #1400 */}
      <HStack className={isUnread ? 'bg-highlight' : 'bg-white'}>
        {isUnread && <Box className="w-[3.5px] bg-main self-stretch" />}

        <ListRow
          contents={
            <VStack gap={3}>
              <HStack justify="between" align="center">
                <Text
                  size="b4"
                  tone={isUnread ? 'brand' : 'neutral'}
                  shade={isUnread ? undefined : 5}
                  weight="medium"
                  numberOfLines={1}
                  className="shrink"
                >
                  {label}
                </Text>
                <Text size="b4" shade={5}>
                  {formatRelativeTimeLabel(createdAt, now, dateFormatContext)}
                </Text>
              </HStack>

              <ListRow.Texts
                type="2RowTypeA"
                top={title}
                topProps={{ weight: isUnread ? 'semibold' : 'medium' }}
                bottom={body}
                bottomProps={{ size: 'b3', shade: isUnread ? 6 : 5, numberOfLines: 2 }}
              />
            </VStack>
          }
          className="flex-1 bg-transparent"
          horizontalPadding="medium"
          verticalPadding="large"
        />
      </HStack>
    </PressableFeedback>
  );
}

NotificationListRow.Loading = function Loading() {
  return (
    <ScrollView className="flex-1">
      <Box px={16} py={8}>
        <TextSkeleton size="b3" className="w-32" />
      </Box>
      {range(LOADING_ROW_COUNT).map((index) => (
        <Fragment key={index}>
          {index > 0 && <Separator className="mx-4" />}
          <ListRow
            horizontalPadding="medium"
            verticalPadding="large"
            contents={
              <VStack gap={3}>
                <HStack justify="between" align="center">
                  <TextSkeleton size="b4" className="w-10" />
                  <TextSkeleton size="b4" className="w-12" />
                </HStack>
                <ListRow.Texts.Loading
                  type="2RowTypeA"
                  topProps={{ className: 'w-3/4' }}
                  bottomProps={{ size: 'b3', className: 'w-full' }}
                />
              </VStack>
            }
          />
        </Fragment>
      ))}
    </ScrollView>
  );
};

NotificationListRow.SectionHeader = function SectionHeader({
  section,
}: {
  section: DateSectionKey;
}) {
  const { t } = useTranslation('common');

  return (
    <Box className="bg-white px-4 py-2">
      <Text size="b3" shade={5} weight="semibold">
        {t(`dateSections.${section}`)}
      </Text>
    </Box>
  );
};
