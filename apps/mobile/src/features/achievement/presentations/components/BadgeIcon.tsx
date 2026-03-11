import { Image } from 'react-native';

import type { BadgeType } from '../view-models/weekly-achievement.view-model';

const BADGE_IMAGE: Record<BadgeType, number> = {
  perfect: require('@assets/images/badge_perfect.png'),
  almost: require('@assets/images/badge_almost.png'),
  completed: require('@assets/images/badge_completed.png'),
};

interface BadgeIconProps {
  type: BadgeType;
  size?: 'small' | 'large';
}

export function BadgeIcon({ type, size = 'small' }: BadgeIconProps) {
  const dimension = size === 'large' ? 80 : 40;

  return (
    <Image
      source={BADGE_IMAGE[type]}
      style={{ width: dimension, height: dimension }}
      resizeMode="contain"
    />
  );
}
