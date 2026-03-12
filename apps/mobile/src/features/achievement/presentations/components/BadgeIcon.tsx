import { Image } from 'react-native';

import type { BadgeType } from '../view-models/weekly-achievement.view-model';

const BADGE_IMAGE: Record<BadgeType, number> = {
  perfect: require('@assets/images/badge_perfect.webp'),
  almost: require('@assets/images/badge_almost.webp'),
  completed: require('@assets/images/badge_completed.webp'),
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
