import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, ListRow, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { type DateSectionKey, formatRelativeTime } from '@src/shared/utils/date';
import { times } from 'es-toolkit/compat';
import { PressableFeedback, Separator } from 'heroui-native';
import { type ComponentProps, Fragment } from 'react';
import { ScrollView } from 'react-native';

interface NotificationListRowProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children'
> {
  label: string;
  title: string;
  body: string;
  createdAt: Date;
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
  return (
    <PressableFeedback {...props}>
      <HStack className={isUnread ? 'bg-highlight' : 'bg-background'}>
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
                  maxLines={1}
                  className="shrink"
                >
                  {label}
                </Text>
                <Text size="b4" shade={5}>
                  {formatRelativeTime(createdAt, new Date())}
                </Text>
              </HStack>

              <ListRow.Texts
                type="2RowTypeA"
                top={title}
                topProps={{ weight: isUnread ? 'semibold' : 'medium' }}
                bottom={body}
                bottomProps={{ size: 'b3', shade: isUnread ? 6 : 5, maxLines: 2 }}
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
      {times(5, (index) => (
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
    <Box px={16} py={8} className="bg-background">
      <Text size="b3" shade={5} weight="semibold">
        {t(`dateSections.${section}`)}
      </Text>
    </Box>
  );
};
