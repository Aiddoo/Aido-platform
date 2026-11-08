# FormStepLayout

한 화면에서 입력 하나씩 진행하는 폼 단계(회원가입, 비밀번호 변경·재설정, 이메일 인증, 회원 탈퇴)의
스크롤 영역입니다. 가로 safe area, 페이드인 제목(`H3`), 입력 영역을 같은 간격으로 놓습니다.

하단 버튼(`KeyboardAdaptiveButton`)은 스크롤 밖에 두어야 키보드를 따라가므로 레이아웃에 넣지 않고
화면이 `flex-1` 컨테이너 안에 형제로 둡니다.

제목 없는 화면 폼(이메일 로그인, 친구 추가, 초대 코드 입력)은 같은 스크롤인 `FormScrollView`를 쓴다.
`KeyboardAwareScrollView`에 `bottomOffset={KEYBOARD_ADAPTIVE_BUTTON_BOTTOM_OFFSET}`·`flex: 1`·
`keyboardShouldPersistTaps="handled"`·스크롤 표시줄 숨김을 기본으로 준다. 다음 칸을 보이려고 `bottomOffset`을 더 키우지 않는다.
다음 칸은 `returnKeyType="next"`로 넘어가고, 키운 만큼 마지막 칸에서 화면이 과하게 밀려 올라간다.

## 사용법

```tsx
import { FormStepLayout, KeyboardAdaptiveButton } from '@src/shared/ui';

<View className="flex-1">
  <FormStepLayout title={t('changePassword.currentTitle')}>
    <Controller
      control={form.control}
      name="currentPassword"
      render={({ field }) => <PasswordInput value={field.value} onChange={field.onChange} />}
    />
  </FormStepLayout>

  <KeyboardAdaptiveButton onPress={onNext}>{t('changePassword.next')}</KeyboardAdaptiveButton>
</View>;
```

## Props

`KeyboardAwareScrollView` props(`children` 제외)를 그대로 받습니다. `contentContainerStyle`은 기본 여백 뒤에 합쳐집니다.

| Prop       | 타입        | 기본값 | 설명                                            |
| ---------- | ----------- | ------ | ----------------------------------------------- |
| `title`    | `string`    | -      | 단계 제목. 값이 바뀌면 제목만 다시 페이드인한다 |
| `children` | `ReactNode` | -      | 제목 아래 입력 영역                             |

기본값: `flex: 1`, 좌우 16·위 24·아래 100 여백, `keyboardShouldPersistTaps="handled"`,
스크롤 표시줄 숨김. 스크롤은 `KeyboardAwareScrollView`라 포커스한 입력이 키보드에 붙은 하단 버튼 위로 올라온다.

## 파일 구조

```
form-step-layout/
├── form-scroll-view.tsx
├── form-step-layout.tsx
├── form-step-layout.md
└── index.ts
```
