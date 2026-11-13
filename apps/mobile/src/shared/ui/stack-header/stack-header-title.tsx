import { Text } from '../text/text';

/** 네이티브 제목과 같은 글자(b2 bold, gray-9)로 그리는 헤더 제목 뷰. `headerTitle`에 넘긴다 */
export function StackHeaderTitle({ children }: { children: string }) {
  return (
    <Text size="b2" weight="bold" shade={9} numberOfLines={1}>
      {children}
    </Text>
  );
}
