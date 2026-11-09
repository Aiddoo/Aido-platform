import CommentIllustrationSvg from '@assets/illustrations/il_comment.svg';
import ErrorIllustrationSvg from '@assets/illustrations/il_error.svg';
import FriendIllustrationSvg from '@assets/illustrations/il_friend.svg';
import LocationIllustrationSvg from '@assets/illustrations/il_location.svg';
import MemoIllustrationSvg from '@assets/illustrations/il_memo.svg';
import NotificationIllustrationSvg from '@assets/illustrations/il_notification.svg';
import OfflineIllustrationSvg from '@assets/illustrations/il_offline.svg';
import SearchIllustrationSvg from '@assets/illustrations/il_search.svg';
import TodoIllustrationSvg from '@assets/illustrations/il_todo.svg';
import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';

import { createStyledIcon } from '../icon/create-styled-icon';

/** 화면 가운데 빈·오류 상태는 72, 점선 카드 같은 블록 안은 56 */
const ILLUSTRATION_SIZES = {
  screen: 72,
  block: 56,
} as const;

export type IllustrationSize = keyof typeof ILLUSTRATION_SIZES;

interface IllustrationProps {
  size?: IllustrationSize;
}

/** 몸통은 테마와 상관없이 밝은 회색(#EFEFEF)이고 덮개·배지·안쪽 줄은 currentColor라 브랜드 색을 따른다 */
function createIllustration(Svg: ComponentType<SvgProps>) {
  const StyledSvg = createStyledIcon(Svg);

  return function Illustration({ size = 'screen' }: IllustrationProps) {
    const dimension = ILLUSTRATION_SIZES[size];

    return <StyledSvg width={dimension} height={dimension} colorClassName="text-main" />;
  };
}

export const MemoIllustration = createIllustration(MemoIllustrationSvg);
export const TodoIllustration = createIllustration(TodoIllustrationSvg);
export const NotificationIllustration = createIllustration(NotificationIllustrationSvg);
export const FriendIllustration = createIllustration(FriendIllustrationSvg);
export const SearchIllustration = createIllustration(SearchIllustrationSvg);
export const CommentIllustration = createIllustration(CommentIllustrationSvg);
export const OfflineIllustration = createIllustration(OfflineIllustrationSvg);
export const ErrorIllustration = createIllustration(ErrorIllustrationSvg);
export const LocationIllustration = createIllustration(LocationIllustrationSvg);
