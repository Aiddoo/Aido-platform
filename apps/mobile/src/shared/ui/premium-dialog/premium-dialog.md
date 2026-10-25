# PremiumDialog

프리미엄 전용 기능을 눌렀을 때 구독 화면으로 안내하는 `ConfirmDialog` 기반 다이얼로그입니다.

## 사용법

```tsx
import { usePremiumDialog } from '@src/shared/ui';

const premiumDialog = usePremiumDialog();

premiumDialog.open({ description: t('settings.reminderPremium') });
```

`usePremiumDialog().open`은 `useOverlay`로 다이얼로그를 띄웁니다. 직접 렌더해야 하면 `PremiumDialog`를 씁니다.

## Props (`PremiumDialogProps`)

| Prop           | 타입                      | 기본값                | 설명                      |
| -------------- | ------------------------- | --------------------- | ------------------------- |
| `isOpen`       | `boolean`                 | -                     | 열림 상태                 |
| `onOpenChange` | `(open: boolean) => void` | -                     | 열림 상태 변경            |
| `title`        | `string`                  | `premiumDialog.title` | 제목                      |
| `description`  | `string`                  | -                     | 프리미엄이 필요한 이유    |
| `onConfirm`    | `() => void`              | -                     | 구독하기를 눌렀을 때 호출 |

구독하기는 다이얼로그를 닫고 `/settings/subscription`으로 이동합니다.

## 파일 구조

```
premium-dialog/
├── premium-dialog.tsx        # 컴포넌트 + usePremiumDialog
├── premium-dialog.types.ts   # Props 타입
├── premium-dialog.md         # 이 문서
└── index.ts                  # 배럴
```
