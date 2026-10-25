# AppToast

HeroUI `Toast` 위에 Aido 스타일(반투명 둥근 바, variant 아이콘, 선택적 액션 버튼)을 입힌 토스트 본문입니다.
화면에서는 직접 쓰지 않고 `useAppToast()`로 띄웁니다.

## 사용법

```tsx
import { useAppToast } from '@src/shared/hooks/use-app-toast';

const toast = useAppToast();

toast.success(t('profile.tagCopied'), { description: t('profile.tagCopiedDescription') });
```

## Props (`AppToast`)

| Prop          | 타입                                              | 기본값      | 설명                            |
| ------------- | ------------------------------------------------- | ----------- | ------------------------------- |
| `label`       | `string`                                          | -           | 제목                            |
| `description` | `string`                                          | -           | 보조 문구                       |
| `variant`     | `'default' \| 'success' \| 'warning' \| 'danger'` | `'default'` | variant별 아이콘                |
| `icon`        | `ReactNode`                                       | -           | variant 아이콘 대신 쓸 아이콘   |
| `action`      | `{ label: string; onPress?: () => void }`         | -           | 오른쪽 액션. 누르면 토스트 닫힘 |
| `toastProps`  | HeroUI `Toast` props                              | -           | HeroUI가 넘기는 값              |

`getToastTopInset`은 상단 safe area를 피한 토스트 위치를 계산합니다.

## 파일 구조

```
toast/
├── app-toast.tsx                  # 컴포넌트
├── get-toast-top-inset.ts         # 상단 여백 계산
├── get-toast-top-inset.test.ts    # 테스트
├── toast.md                       # 이 문서
└── index.ts                       # 배럴
```
