# AppToast

HeroUI `Toast` 위에 Aido 스타일(반투명 둥근 바, variant 아이콘, 선택적 액션 버튼)을 입힌 토스트 본문입니다.
화면에서는 직접 쓰지 않고 `useAppToast()`로 띄웁니다.

## 사용법

```tsx
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';

const toast = useAppToast();

toast.success(t('profile.tagCopied'), { description: t('profile.tagCopiedDescription') });
```

## Props (`AppToast`)

| Prop          | 타입                                              | 기본값      | 설명                                           |
| ------------- | ------------------------------------------------- | ----------- | ---------------------------------------------- |
| `label`       | `string`                                          | -           | 제목                                           |
| `description` | `string`                                          | -           | 보조 문구                                      |
| `variant`     | `'default' \| 'success' \| 'warning' \| 'danger'` | `'default'` | variant별 아이콘                               |
| `icon`        | `ReactNode`                                       | -           | variant 아이콘 대신 쓸 아이콘                  |
| `action`      | `{ label: string; onPress?: () => void }`         | -           | 오른쪽 액션. 누르면 토스트 닫힘                |
| `isMoved`     | `boolean`                                         | `false`     | 닫힌 시트에서 옮겨 온 토스트. 등장 움직임 없음 |
| `toastProps`  | HeroUI `Toast` props                              | -           | HeroUI가 넘기는 값                             |

`getToastTopInset`은 상단 safe area를 피한 토스트 위치를 계산합니다.

## 토스트 면

iOS 시트 route(`transparentModal`)는 루트 위에 따로 뜨는 모달이라, 루트에 그린 토스트가 시트 배경 아래에 깔리고 VoiceOver가 읽지 못합니다.
그래서 토스트를 그리는 면을 쌓습니다.

- 앱 루트 면은 `HeroUIProvider`가 둡니다(`ToastLayersProvider` + `ToastLayerRegistration isBase`).
- `SheetRouteScreen`은 `SheetToastLayer`로 자기 면을 그 위에 쌓습니다. 모달 안의 보통 View에 시트보다 뒤에 그려 시트 위에 보입니다.
- `useAppToast()`는 어디서 부르든(전역 mutation 오류 피드백 포함) 가장 위 면에 띄웁니다.
- 시트가 닫히면 아직 보이는 토스트를 남은 시간만큼 아래 면으로 옮깁니다. 같은 자리라 다시 내려오지 않습니다.
