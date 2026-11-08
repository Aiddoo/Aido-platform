import { useTranslation } from '@src/shared/i18n';
import {
  Flex,
  ListRow,
  type ListRowProps,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Result,
} from '@src/shared/ui';
import { range } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { UserAvatar } from './user-avatar';

export const USER_LIST_CONTENT_STYLE = { flexGrow: 1 };

interface UserListItemProps extends Omit<ListRowProps, 'left' | 'contents'> {
  displayName: string;
  subtitle?: string;
  profileImage: string | null;
}

function Item({ displayName, subtitle, profileImage, ...props }: UserListItemProps) {
  return (
    <ListRow
      left={<UserAvatar alt={displayName} className="size-10" profileImage={profileImage} />}
      contents={
        subtitle == null ? (
          <ListRow.Texts type="1RowTypeA" top={displayName} topProps={{ numberOfLines: 1 }} />
        ) : (
          <ListRow.Texts
            type="2RowTypeA"
            top={displayName}
            topProps={{ numberOfLines: 1 }}
            bottom={subtitle}
            bottomProps={{ numberOfLines: 1 }}
          />
        )
      }
      {...props}
    />
  );
}

interface UserListLoadingProps {
  rows?: number;
  hasSubtitle?: boolean;
  right?: ReactNode;
  ListHeaderComponent?: ReactNode;
}

function Loading({
  rows = 3,
  hasSubtitle = false,
  right,
  ListHeaderComponent,
}: UserListLoadingProps) {
  return (
    <ScrollView className="flex-1" contentContainerStyle={USER_LIST_CONTENT_STYLE}>
      {ListHeaderComponent}
      {range(rows).map((index) => (
        <ListRow
          key={index}
          left={<Skeleton className="size-10 rounded-full" />}
          contents={<ListRow.Texts.Loading type={hasSubtitle ? '2RowTypeA' : '1RowTypeA'} />}
          right={right}
        />
      ))}
    </ScrollView>
  );
}

function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation();
  return <Result title={t('errorBoundary.title')} button={<QueryErrorActions onRetry={reset} />} />;
}

function Empty(props: ComponentProps<typeof Result>) {
  return (
    <Flex flex={1} justify="center" align="center">
      <Result {...props} />
    </Flex>
  );
}

/** 사용자 행 목록의 행, 로딩, 오류, 빈 상태. 목록 자체는 InfiniteList가 맡는다 */
export const UserList = { Item, Loading, Error: ErrorFallback, Empty };
