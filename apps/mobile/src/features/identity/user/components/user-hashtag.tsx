import { Text } from '@src/shared/ui';
import type { ComponentProps } from 'react';

import { formatUserHashtag } from '../utils/user-tag.view-model';

interface UserHashtagProps extends Omit<ComponentProps<typeof Text>, 'children'> {
  userTag: string;
}

/** 접두어 없는 사용자 태그를 해시태그(`#ABCD1234`)로 보인다 */
export function UserHashtag({ userTag, ...props }: UserHashtagProps) {
  return <Text {...props}>{formatUserHashtag(userTag)}</Text>;
}
