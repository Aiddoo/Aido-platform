import { Text } from '@src/shared/ui';
import type { ComponentProps } from 'react';

import { formatUserHashtag } from '../utils/user-tag.view-model';

interface UserHashtagProps extends Omit<ComponentProps<typeof Text>, 'children'> {
  userTag: string;
}

export function UserHashtag({ userTag, ...props }: UserHashtagProps) {
  return <Text {...props}>{formatUserHashtag(userTag)}</Text>;
}
