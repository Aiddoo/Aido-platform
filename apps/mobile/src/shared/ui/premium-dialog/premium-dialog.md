# PremiumDialog

프리미엄 전용 기능을 눌렀을 때 구독을 안내하는 `ConfirmDialog` 기반 다이얼로그입니다. 화면 이동과 분석 기록은 하지 않습니다.

## 사용법

기능 화면에서는 직접 렌더하지 말고 `usePremiumGate(feature)`(`features/subscription/hooks/use-premium-gate`)를 씁니다. 안내 노출(`premium_gate_shown`)을 기록하고 이 다이얼로그를 `useOverlay`로 띄운 뒤, 구독하기는 `subscriptionHref()`로 보냅니다.

```tsx
const premiumGate = usePremiumGate('CUSTOM_REMINDER_TIME');

premiumGate.open({ description: t('settings.reminderPremium') });
```

route가 바뀌면 overlay가 닫히는 시트 route 안에서는 `PremiumDialog`를 직접 렌더하고 `premiumGate.trackShown()`·`onSubscribe={premiumGate.subscribe}`를 연결합니다.

## Props (`PremiumDialogProps`)

| Prop                | 타입                                     | 기본값                | 설명                                                                                                            |
| ------------------- | ---------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `isOpen`            | `boolean`                                | -                     | 열림 상태                                                                                                       |
| `onOpenChange`      | `(open: boolean) => void`                | -                     | 열림 상태 변경                                                                                                  |
| `title`             | `string`                                 | `premiumDialog.title` | 제목                                                                                                            |
| `description`       | `string`                                 | -                     | 프리미엄이 필요한 이유                                                                                          |
| `onSubscribe`       | `() => void`                             | -                     | 구독하기를 눌러 다이얼로그를 닫은 뒤 호출                                                                       |
| `alternativeAction` | `{ label: string; onPress: () => void }` | -                     | 구독 대신 고를 행동(예: 친구 초대로 자리 늘리기). 있으면 이 버튼을 먼저, "프리미엄으로 무제한"을 두 번째로 둔다 |

구독하기는 다이얼로그를 닫고 `onSubscribe`를 한 번만 부릅니다(연타 방지).

## 파일 구조

```
premium-dialog/
├── premium-dialog.tsx        # 컴포넌트
├── premium-dialog.types.ts   # Props 타입
├── premium-dialog.md         # 이 문서
└── index.ts                  # 배럴
```
