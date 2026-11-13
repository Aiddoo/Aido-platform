# FormStepLayout

한 화면에서 입력 하나씩 진행하는 폼 단계(회원가입, 비밀번호 변경·재설정, 이메일 인증, 회원 탈퇴, 이름 변경, 문의)의
스크롤 영역입니다. 가로 safe area, 페이드인 제목(`H3`), 입력 영역을 같은 간격으로 놓습니다.

제목 없는 화면 폼(이메일 로그인, 친구 추가, 초대 코드 입력)은 같은 스크롤인 `FormScrollView`를 쓴다.
`flex: 1`·`keyboardShouldPersistTaps="handled"`·스크롤 표시줄 숨김을 기본으로 준다.

## 키보드

주 동작 버튼(`KeyboardAdaptiveButton`)은 `footer`로 넘긴다. 레이아웃이 버튼을 스크롤 밖 아래에 두고,
버튼은 키보드가 열렸을 때의 제 높이를 레이아웃에 알린다.

포커스하면 **칸 전체**(라벨·입력 칸·오류 문구·`TextArea`의 `counter`)가 키보드에 붙은 버튼 위에 보이도록 스크롤한다.
`KeyboardAwareScrollView`는 커서 줄만 키보드 위로 올려(`bottomOffset`은 커서와 키보드 사이 거리) 여러 줄 입력의
아래쪽과 오류 문구가 버튼에 가렸으므로 쓰지 않는다. 대신 같은 라이브러리의 `useKeyboardHandler`·
`useFocusedInputHandler`·`useReanimatedFocusedInput`으로 UI 스레드에서 키보드와 같은 프레임에 스크롤한다
(`use-focused-field-keyboard-scroll.ts`).

- 칸 위치: `Input`·`TextArea`가 포커스될 때와 칸 크기가 바뀔 때 `FocusedFieldContext`로 칸 전체 뷰를 알린다.
  알리지 않는 입력(코드 입력처럼 숨은 TextInput)은 입력 자체를 칸으로 본다
- 키보드 높이가 뒤늦게 바뀌면(암호 자동 완성 줄, Writing Tools 줄, 병음 후보 줄, 이모지 자판) 새 높이로 다시 맞춘다
- 이미 보이는 칸은 스크롤하지 않는다. 칸이 보이는 곳보다 크면 커서 줄을 지키며 칸 아래(입력 끝·글자 수)나 칸 위를 맞춘다
- 키보드가 내려가면 키보드 전 스크롤로 돌아가고, 키보드 높이만큼 둔 내용 아래 여백을 지운다
- 다음 칸을 미리 보이려고 여백을 더 두지 않는다. 다음 칸 이동은 [키보드 규칙](../../../../docs/architecture/ui.md)을 따른다

## 사용법

```tsx
import { FormStepLayout, KeyboardAdaptiveButton } from '@src/shared/ui';

<View className="flex-1">
  <FormStepLayout
    title={t('changePassword.currentTitle')}
    footer={
      <KeyboardAdaptiveButton onPress={onNext}>{t('changePassword.next')}</KeyboardAdaptiveButton>
    }
  >
    <Controller
      control={form.control}
      name="currentPassword"
      render={({ field }) => <PasswordInput value={field.value} onChange={field.onChange} />}
    />
  </FormStepLayout>
</View>;
```

## Props

`ScrollView` props(`children` 제외)를 그대로 받습니다. `contentContainerStyle`은 기본 여백 뒤에 합쳐집니다.

| Prop       | 타입        | 기본값 | 설명                                                 |
| ---------- | ----------- | ------ | ---------------------------------------------------- |
| `title`    | `string`    | -      | 단계 제목. 값이 바뀌면 제목만 다시 페이드인한다      |
| `footer`   | `ReactNode` | -      | 키보드에 붙는 주 동작 버튼(`KeyboardAdaptiveButton`) |
| `children` | `ReactNode` | -      | 제목 아래 입력 영역                                  |

`FormScrollView`는 `title` 없이 `footer`와 `ScrollView` props를 받는다.

기본값: `flex: 1`, 좌우 16·위 24·아래 24 여백, `keyboardShouldPersistTaps="handled"`, 스크롤 표시줄 숨김.
