import {
  HStack,
  ListRow,
  type ListRowProps,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Result,
} from '@src/shared/ui';
import { range } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

import { UserAvatar } from './user-avatar';

export const USER_LIST_CONTENT_STYLE = { flexGrow: 1 };

/** 사용자 행을 위에서부터 쌓는 스크롤 목록. 행·로딩·비었을 때·오류 조각을 함께 단다 */
export function UserList({ children, ...props }: ScrollViewProps) {
  return (
    <ScrollView className="flex-1" contentContainerStyle={USER_LIST_CONTENT_STYLE} {...props}>
      {children}
    </ScrollView>
  );
}

interface UserListItemProps extends Omit<ListRowProps, 'left' | 'contents'> {
  displayName: string;
  subtitle?: string;
  profileImage: string | null;
}

UserList.Item = function Item({
  displayName,
  subtitle,
  profileImage,
  ...props
}: UserListItemProps) {
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
};

interface UserListLoadingProps {
  rows?: number;
  hasSubtitle?: boolean;
  right?: ReactNode;
  ListHeaderComponent?: ReactNode;
  /** 헤더 inset·키보드 inset처럼 화면이 스크롤 부모에 요구하는 값 */
  scrollProps?: ScrollViewProps;
}

UserList.Loading = function Loading({
  rows = 3,
  hasSubtitle = false,
  right,
  ListHeaderComponent,
  scrollProps,
}: UserListLoadingProps) {
  return (
    <UserList {...scrollProps}>
      {ListHeaderComponent}
      {range(rows).map((index) => (
        <ListRow
          key={index}
          left={<Skeleton className="size-10 rounded-full" />}
          contents={<ListRow.Texts.Loading type={hasSubtitle ? '2RowTypeA' : '1RowTypeA'} />}
          right={right}
        />
      ))}
    </UserList>
  );
};

UserList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return <QueryErrorFallback reset={reset} />;
};

UserList.Empty = function Empty(props: ComponentProps<typeof Result>) {
  return (
    <HStack flex={1} justify="center" align="center">
      <Result {...props} />
    </HStack>
  );
};
