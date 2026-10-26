import { ArrowRightIcon, HStack, TextSkeleton, VStack } from '@src/shared/ui';

export function TimeRowSkeleton() {
  return (
    <HStack justify="between" align="center" gap={20}>
      <VStack flex={1}>
        <TextSkeleton size="b2" className="w-28" />
        <TextSkeleton size="b3" className="w-44" />
      </VStack>
      <ArrowRightIcon colorClassName="text-gray-3" />
    </HStack>
  );
}

export function NavigationSkeleton() {
  return (
    <HStack justify="between" align="center" gap={20} className="py-2">
      <TextSkeleton size="b2" className="w-24" />
      <HStack gap={8} align="center">
        <TextSkeleton size="b2" className="w-12" />
        <ArrowRightIcon colorClassName="text-gray-3" />
      </HStack>
    </HStack>
  );
}
