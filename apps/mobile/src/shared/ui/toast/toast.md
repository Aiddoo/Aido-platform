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
| `isMoved`     | `boolean`                                         | `false`     | 이미 보이다가 옮겨 온 토스트. 등장 움직임 없음 |
| `toastProps`  | HeroUI `Toast` props                              | -           | HeroUI가 넘기는 값                             |

`getToastTopInset`은 상단 safe area를 피한 토스트 위치를 계산합니다.

## 토스트 면

iOS 시트 route(`transparentModal`)는 루트 위에 따로 뜨는 모달이라, 루트에 그린 토스트가 시트 배경 아래에 깔리고 VoiceOver가 읽지 못합니다.
그래서 토스트를 그리는 면을 쌓습니다.

- 앱 루트 면은 `HeroUIProvider`가 둡니다(`ToastLayersProvider` + `ToastLayerRegistration isBase`).
- `SheetRouteScreen`은 `SheetToastLayer`로 자기 면을 그 위에 쌓습니다. 모달 안의 보통 View에 시트보다 뒤에 그려 시트 위에 보입니다.
- `useAppToast()`는 어디서 부르든(전역 mutation 오류 피드백 포함) 닫히는 중이 아닌 가장 위 면에 띄웁니다. 열린 시트에서 저장이 실패하면 오류 토스트는 그 시트 위에 남습니다.
- 시트 route의 시트가 닫히기 시작하면(`useSheetRoute`의 `close`·`exit`, 끌어 내림·바깥 누름·뒤로 가기로 닫힘 애니메이션이 시작될 때) 그 면은 새 토스트를 받지 않고, 보이던 토스트를 그때 남은 시간만큼 아래 면으로 옮깁니다. 시트가 내려간 뒤 옮기면 시트와 함께 사라졌다가 다시 떠 두 번 뜬 것처럼 보입니다.
- 이미 보이던 토스트는 같은 자리라 다시 내려오지 않습니다(`isMoved`). 화면에 오르기 전에 옮겨진 토스트(저장 성공 토스트 뒤 바로 시트를 닫는 흐름)는 아래 면에서 한 번 내려옵니다. 시트 면에 남은 사본은 그 자리에서 감춰 보이지도 읽히지도 않습니다.
- route 안에 띄운 overlay 시트(`useOpenSheet` 피커 등)와 Portal 안 시트는 route 시트가 아니라, 닫혀도 route의 면을 닫지 않습니다. `OverlayProvider`가 `ToastLayerClosingContext`를 비웁니다.
