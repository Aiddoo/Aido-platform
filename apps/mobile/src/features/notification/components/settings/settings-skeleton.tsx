import { HStack, VStack } from '@src/shared/ui';
import { range } from 'es-toolkit';
import { Separator, Skeleton, SkeletonGroup } from 'heroui-native';
import { View } from 'react-native';

import { SettingsCard } from './settings-card';

export function ToggleSkeleton() {
  return (
    <SkeletonGroup isLoading isSkeletonOnly>
      <HStack justify="between" align="center" className="py-2">
        <VStack flex={1} gap={2}>
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-4 w-48 rounded" />
        </VStack>
        <Skeleton className="h-8 w-14 rounded-full" />
      </HStack>
    </SkeletonGroup>
  );
}

export function GroupSkeleton({ rows }: { rows: number }) {
  return (
    <VStack gap={8}>
      <SkeletonGroup isLoading isSkeletonOnly>
        <VStack gap={2} className="px-2">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-4 w-52 rounded" />
        </VStack>
      </SkeletonGroup>

      <SettingsCard>
        <SkeletonGroup isLoading isSkeletonOnly>
          {range(rows).map((i) => (
            <View key={i}>
              {i > 0 && <Separator className="bg-gray-2" />}
              <HStack justify="between" align="center" className="py-2">
                <VStack flex={1} gap={2}>
                  <Skeleton className="h-5 w-28 rounded" />
                  <Skeleton className="h-4 w-44 rounded" />
                </VStack>
                <Skeleton className="h-5 w-16 rounded" />
              </HStack>
            </View>
          ))}
        </SkeletonGroup>
      </SettingsCard>
    </VStack>
  );
}

export function NavigationSkeleton() {
  return (
    <SkeletonGroup isLoading isSkeletonOnly>
      <HStack justify="between" align="center" className="py-2">
        <Skeleton className="h-5 w-24 rounded" />
        <Skeleton className="h-5 w-12 rounded" />
      </HStack>
    </SkeletonGroup>
  );
}
