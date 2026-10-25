# FormStepLayout

한 화면에서 입력 하나씩 진행하는 폼 단계(회원가입, 비밀번호 변경·재설정, 이메일 인증, 회원 탈퇴)의
스크롤 영역입니다. 가로 safe area, 페이드인 제목(`H3`), 입력 영역을 같은 간격으로 놓습니다.

하단 버튼(`KeyboardAdaptiveButton`)은 스크롤 밖에 두어야 키보드를 따라가므로 레이아웃에 넣지 않고
화면이 `flex-1` 컨테이너 안에 형제로 둡니다.

## 사용법

```tsx
import { FormStepLayout, KeyboardAdaptiveButton } from '@src/shared/ui';

<View className="flex-1">
  <FormStepLayout title={t('changePassword.currentTitle')}>
    <FormField control={control} name="currentPassword">
      {({ onChange, value }) => <PasswordInput value={value} onChange={onChange} />}
    </FormField>
  </FormStepLayout>

  <KeyboardAdaptiveButton onPress={onNext}>{t('changePassword.next')}</KeyboardAdaptiveButton>
</View>;
```

## Props

`ScrollView` props(`children` 제외)를 그대로 받습니다. `contentContainerStyle`은 기본 여백 뒤에 합쳐집니다.

| Prop       | 타입        | 기본값 | 설명                                            |
| ---------- | ----------- | ------ | ----------------------------------------------- |
| `title`    | `string`    | -      | 단계 제목. 값이 바뀌면 제목만 다시 페이드인한다 |
| `children` | `ReactNode` | -      | 제목 아래 입력 영역                             |

기본값: `className="flex-1"`, 좌우 16·위 24·아래 100 여백, `keyboardShouldPersistTaps="handled"`,
스크롤 표시줄 숨김.

## 파일 구조

```
form-step-layout/
├── form-step-layout.tsx
├── form-step-layout.md
└── index.ts
```
