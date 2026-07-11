import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { HStack, ListRow } from '@src/shared/ui';
import { Avatar, Skeleton } from 'heroui-native';
import type { ReactNode } from 'react';

export interface UserListRowProps {
  /** 상단 표시 이름 (이미 fallback 처리된 값) */
  displayName: string;
  /** 하단 보조 텍스트 (예: @태그). 생략 시 1줄 행 */
  subtitle?: string;
  profileImage: string | null;
  /** 우측 액션 슬롯 (버튼 등) */
  action?: ReactNode;
}

/**
 * 사용자 행 공용 컴포넌트 (아바타 + 이름/보조텍스트 + 액션 슬롯).
 * 역할 기반 Props만 받아 도메인 타입 누출을 막는다.
 * 친구 요청 목록·검색 결과 등 사용자 리스트에서 재사용한다.
 */
export const UserListRow = ({ displayName, subtitle, profileImage, action }: UserListRowProps) => (
  <ListRow
    horizontalPadding="none"
    left={
      <Avatar alt={displayName} className="size-10">
        <Avatar.Image source={getProfileIconSource(profileImage)} />
      </Avatar>
    }
    contents={
      subtitle != null ? (
        <ListRow.Texts
          type="2RowTypeA"
          top={displayName}
          topProps={{ maxLines: 1 }}
          bottom={subtitle}
          bottomProps={{ maxLines: 1 }}
        />
      ) : (
        <ListRow.Texts type="1RowTypeA" top={displayName} topProps={{ maxLines: 1 }} />
      )
    }
    right={action}
  />
);

export interface UserListRowLoadingProps {
  /** 우측 액션 스켈레톤 표시 여부 */
  hasAction?: boolean;
}

UserListRow.Loading = function Loading({ hasAction = true }: UserListRowLoadingProps) {
  return (
    <HStack align="center" className="py-2" gap={12}>
      <Skeleton className="w-10 h-10 rounded-full" />
      <Skeleton className="flex-1 h-5" />
      {hasAction ? <Skeleton className="w-12 h-8 rounded" /> : null}
    </HStack>
  );
};
