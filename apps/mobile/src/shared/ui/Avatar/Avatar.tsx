import { Box } from '@src/shared/ui/Box';
import { CheckmarkIcon } from '@src/shared/ui/Icon';
import { VStack } from '@src/shared/ui/VStack';
import { cn } from '@src/shared/utils/cn';
import { type AvatarRootProps, Avatar as HeroUIAvatar, Skeleton } from 'heroui-native';

interface AvatarProps extends AvatarRootProps {
  isSelected?: boolean;
}

export function Avatar({ isSelected, className, children, ...props }: AvatarProps) {
  const showSelection = isSelected !== undefined;

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

Avatar.Image = HeroUIAvatar.Image;
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
    <Box className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-main items-center justify-center z-10">
      <CheckmarkIcon width={12} height={12} colorClassName="text-white" />
    </Box>
  );
}
