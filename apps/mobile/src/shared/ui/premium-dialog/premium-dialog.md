# PremiumDialog

프리미엄 전용 기능을 눌렀을 때 구독을 안내하는 `ConfirmDialog` 기반 다이얼로그입니다. 화면 이동과 분석 기록은 하지 않습니다.

## 사용법

기능 화면에서는 직접 렌더하지 말고 `useEntitlementGate(feature, { surface })`(`features/subscription/hooks/use-entitlement-gate`)를 씁니다. 게이트가 서버 스냅샷(`GET /v1/entitlements`)으로 시작 전에 막고(`guard`), 서버 한도 오류는 같은 다이얼로그로 안내합니다(`handleError`). 기능별 제목·설명(다시 채워지는 날, 프리미엄 혜택)은 게이트가 채우고, 노출·구독하기를 `premium_gate_*`·`limit_reached_*`로 기록한 뒤 `subscriptionHref()`로 보냅니다.

```tsx
const gate = useEntitlementGate('CUSTOM_REMINDER_TIME', { surface: 'reminder_settings' });

<SettingsTimeInput onBeforeOpen={() => gate.guard()} />;

// mutation onError
if (gate.handleError(error)) {
  return;
}
```

시트 route 안에서도 `SheetRouteScreen`이 route 안에 Overlay를 두므로 게이트를 그대로 씁니다. 구독하러 갈 때 시트를 떠나야 하면 `onSubscribe: sheet.exit`를 넘깁니다.

## Props (`PremiumDialogProps`)

| Prop                | 타입                                     | 기본값                | 설명                                                                                                                   |
| ------------------- | ---------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `isOpen`            | `boolean`                                | -                     | 열림 상태                                                                                                              |
| `onOpenChange`      | `(open: boolean) => void`                | -                     | 열림 상태 변경                                                                                                         |
| `title`             | `string`                                 | `premiumDialog.title` | 제목                                                                                                                   |
| `description`       | `string`                                 | -                     | 프리미엄이 필요한 이유                                                                                                 |
| `onSubscribe`       | `() => void`                             | -                     | 구독하기를 눌러 다이얼로그를 닫은 뒤 호출                                                                              |
| `alternativeAction` | `{ label: string; onPress: () => void }` | -                     | 구독 대신 고를 행동(예: 친구 초대로 자리 늘리기). 있으면 이 버튼을 먼저, "프리미엄으로 넉넉하게 쓰기"를 두 번째로 둔다 |

구독하기는 다이얼로그를 닫고 `onSubscribe`를 한 번만 부릅니다(연타 방지).

## 파일 구조

```
premium-dialog/
├── premium-dialog.tsx        # 컴포넌트
├── premium-dialog.types.ts   # Props 타입
├── premium-dialog.md         # 이 문서
└── index.ts                  # 배럴
```
