import { Box } from '@src/shared/ui/box';
import { CheckmarkIcon } from '@src/shared/ui/icon';
import { VStack } from '@src/shared/ui/v-stack';
import { cn } from '@src/shared/utils/cn';
import { type AvatarRootProps, Avatar as HeroUIAvatar, Skeleton } from 'heroui-native';
import type { ComponentProps } from 'react';

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

type AvatarImageProps = Omit<
  Extract<ComponentProps<typeof HeroUIAvatar.Image>, { asChild?: false }>,
  'isAnimatedStyleActive'
>;

// 다시 마운트된 아바타는 캐시된 이미지의 onLoad를 받지 못해 HeroUI 페이드 인(opacity 0)에 멈추므로 바로 보이게 한다
Avatar.Image = function Image(props: AvatarImageProps) {
  return <HeroUIAvatar.Image {...props} isAnimatedStyleActive={false} />;
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
