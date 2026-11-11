import { formatRelativeTimeLabel } from '@src/shared/date/format/date-labels';
import { type Instant } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { Box, HStack, ListRow, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { type Href, Link } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactElement } from 'react';

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

interface NotificationListRowLinkProps {
  /** 없으면 행만 그린다 */
  href: Href | null;
  children: ReactElement;
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
      <HStack className={cn('bg-white', isUnread && 'bg-highlight')}>
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

/**
 * 화면으로 가는 행을 Link로 감싸 길게 누르면 목적지를 미리본다(iOS, 다른 플랫폼은 행만 그린다).
 * 탭은 행의 onPress(연타 막기·읽음·추적)가 맡고 Link는 미리보기를 눌러 가는 이동만 맡는다
 */
NotificationListRow.Link = function RowLink({ href, children }: NotificationListRowLinkProps) {
  if (href == null) {
    return children;
  }

  return (
    <Link href={href} asChild onPress={(event) => event.preventDefault()}>
      <Link.Trigger>{children}</Link.Trigger>
      <Link.Preview />
    </Link>
  );
};

/** 받은 뒤의 행과 같은 여백·글자 줄로 그려 목록이 채워질 때 행 높이가 바뀌지 않는다 */
NotificationListRow.Loading = function Loading() {
  return (
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
  );
};
