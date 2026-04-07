# SwipePager

수평 스와이프로 페이지를 전환하는 범용 페이저 컴포넌트.

## 사용법

```tsx
import { SwipePager } from '@src/shared/ui';

<SwipePager
  initialPage={1}
  onPageSelected={(index) => console.log(index)}
>
  <View><Text>Page 1</Text></View>
  <View><Text>Page 2</Text></View>
  <View><Text>Page 3</Text></View>
</SwipePager>
```

## Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| children | `React.ReactNode` | - | 페이지로 배치할 노드들 |
| onPageSelected | `(index: number) => void` | - | 스와이프 완료 후 도착 페이지 인덱스 |
| initialPage | `number` | `0` | 시작 페이지 인덱스 |
| resetKey | `string \| number` | - | 변경 시 initialPage 위치로 리셋 |
| className | `string` | - | NativeWind 스타일링 |

## 파일 구조

```
SwipePager/
  SwipePager.tsx   # 컴포넌트 구현
  SwipePager.md    # 이 문서
  index.ts         # re-export
```
