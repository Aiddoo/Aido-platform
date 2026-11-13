import { HStack } from '@src/shared/ui';
import { Separator } from 'heroui-native';
import type { ReactNode } from 'react';

/** 로그인 화면 아래의 두 갈래 이동(가입 | 다른 길)을 세로 구분선으로 나눠 가운데 둔다 */
export function AuthLinkRow({ children: [first, second] }: { children: [ReactNode, ReactNode] }) {
  return (
    <HStack justify="center" align="center" gap={8}>
      {first}
      <Separator orientation="vertical" className="h-3 bg-gray-6" />
      {second}
    </HStack>
  );
}
