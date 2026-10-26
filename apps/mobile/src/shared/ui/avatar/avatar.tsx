import { Box } from '@src/shared/ui/box';
import { CheckmarkIcon } from '@src/shared/ui/icon';
import { VStack } from '@src/shared/ui/v-stack';
import { cn } from '@src/shared/utils/cn';
import { Image as ExpoImage } from 'expo-image';
import { type AvatarRootProps, Avatar as HeroUIAvatar, Skeleton } from 'heroui-native';
import type { ComponentProps } from 'react';
import type { ImageSourcePropType } from 'react-native';

import { getAvatarRecyclingKey } from './get-avatar-recycling-key';

interface AvatarProps extends AvatarRootProps {
  isSelected?: boolean;
}

export function Avatar({ isSelected, className, children, ...props }: AvatarProps) {
  const showSelection = isSelected != null;

  return (
    <Box className={cn(showSelection && 'relative overflow-visible')}>
      <HeroUIAvatar
        className={cn(
          showSelection && 'border-2',
          showSelection && (isSelected ? 'border-main' : 'border-gray-3'),
          className,
        )}
        {...props}
      >
        {children}
      </HeroUIAvatar>
      {isSelected && <SelectedBadge />}
    </Box>
  );
}

interface AvatarImageProps extends Omit<ComponentProps<typeof ExpoImage>, 'source' | 'style'> {
  source: ImageSourcePropType;
}

const AVATAR_IMAGE_STYLE = { width: '100%', height: '100%' } as const;

// HeroUI 페이드 인(opacity 0 → onLoad) 대신 expo-image로 바로 그린다. 다시 마운트돼 onLoad가 오지 않아도 보이고 디스크 캐시를 쓴다
Avatar.Image = function Image({ source, ...props }: AvatarImageProps) {
  return (
    <HeroUIAvatar.Image source={source} asChild>
      <ExpoImage
        style={AVATAR_IMAGE_STYLE}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={getAvatarRecyclingKey(source)}
        {...props}
      />
    </HeroUIAvatar.Image>
  );
};
Avatar.Fallback = HeroUIAvatar.Fallback;

Avatar.Loading = function Loading() {
  return (
    <VStack align="center" gap={8} py={8}>
      <Skeleton className="w-20 h-20 rounded-2xl" />
      <Skeleton className="h-4 w-12 rounded" />
    </VStack>
  );
};

function SelectedBadge() {
  return (
    <Box className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-main items-center justify-center z-10">
      <CheckmarkIcon width={14} height={14} colorClassName="text-white dark:text-gray-9" />
    </Box>
  );
}
