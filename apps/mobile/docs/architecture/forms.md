# 폼

폼을 만들거나 옮길 때 읽는다. 스키마·mapper는 [model](./model.md), mutation 옵션은 [data](./data.md#mutation-옵션), 실패 안내는 [오류 처리](../error-handling.md#mutation-오류-피드백), 화면 조립은 [ui](./ui.md#스크린)가 원본이다.

## 누가 갖나

- **화면 맨 위가 폼을 갖는다.** `useForm`은 route 파일의 맨 위 화면 컴포넌트에 둔다(params를 검증하는 route면 검증 뒤 그리는 같은 파일의 화면 컴포넌트). route가 없는 시트·피커·인라인 작성기는 그 컴포넌트가 맨 위다(할 일·카테고리 만들기 시트, 날씨 옮기기 시트).
- 단계 흐름은 `useStepper`를 가진 같은 화면이 폼 하나를 가져 앞 단계로 돌아가도 값이 남는다([useStepper](./hooks.md#usestepper)).
- `form`은 화면 → 같은 파일의 지역 단계 컴포넌트로 한 번만 내려간다. 기능 컴포넌트는 `form`·`control`을 받지 않고 `value`·`onChange`·`errorMessage`만 받는다([ui](./ui.md#컴포넌트-계약)).
- 기능이 주는 것은 스키마(`schemas/{name}-form.schema.ts`), mapper(`to{X}Request(values)`·`to{X}FormValues(model)`), mutation 옵션, 오류 판별과 칸 매핑(`domains/{feature}.error.ts`), 입력 부품이다. 화면은 이것을 잇기만 한다.
- 값을 잇기만 하는 감싸는 훅(`useWatch` + `setValue`를 감싼 `useImportRange(form)` 같은 것)과 `FormProvider`·`useFormContext`를 만들지 않는다. RHF·Zod·`zodResolver`를 그대로 쓴다.
  - 예외는 할 일 댓글 세션 하나다(`TodoCommentFormProvider`·`useTodoCommentForm`). 가상 목록 깊은 곳의 댓글·답글 행 메뉴, 작성 바, 뒤로 가기 확인이 화면 하나의 작성기를 함께 읽고 바꿔, props로 내리면 목록 여러 층을 거치는 드릴링이 된다. 세션(`todo-comment-pane.tsx`의 `TodoCommentSession`)이 폼을 소유하고 이 Context로만 나눈다.
- 생성과 수정은 스키마와 입력 부품만 공유하고 제출은 각자 소유한다. 공통 부품에 `mode`·`onSubmit` 분기를 넘기지 않는다.

```tsx
// 목표 모양: 화면이 폼을 갖고, 칸과 버튼은 그 조각만 다시 그린다
export default function InquiryScreen() {
  const { t } = useTranslation('inquiry');
  const createInquiry = useMutation(useCreateInquiryMutationOptions());
  const form = useForm({
    resolver: zodResolver(inquiryFormSchema),
    defaultValues: { content: '' },
    mode: 'onChange',
  });

  const saveInquiry = form.handleSubmit((values) => createInquiry.mutateAsync(values));
  // 실패 안내는 mutation의 meta.errorFeedback이 한 번 하고, 화면은 입력을 그대로 둔다
  const handleSavePress = useSingleTap(() => saveInquiry().catch(noop));

  return (
    <FormStepLayout
      title={t('title')}
      footer={
        <FormState
          control={form.control}
          render={({ isValid, isSubmitting }) => (
            <KeyboardAdaptiveButton isDisabled={!isValid || isSubmitting} onPress={handleSavePress}>
              {t('actions.send')}
            </KeyboardAdaptiveButton>
          )}
        />
      }
    >
      <Controller
        control={form.control}
        name="content"
        render={({ field, fieldState }) => (
          <TextArea
            ref={field.ref}
            value={field.value}
            onChange={field.onChange}
            errorMessage={fieldState.error?.message}
          />
        )}
      />
    </FormStepLayout>
  );
}
```

## 만들기

```tsx
// 수정: 다시 받은 서버 값이 비교 기준이고 고치던 칸은 남는다. 생성은 values 대신 defaultValues다
const form = useForm({
  resolver: zodResolver(todoCategoryFormSchema),
  values: toTodoCategoryFormValues(category),
  resetOptions: SERVER_VALUES_RESET_OPTIONS,
  mode: 'onChange',
});
```

- `useForm`은 제네릭 없이 `zodResolver(schema)`에서 타입을 추론하고 이름은 `form`이다. 생성은 `defaultValues`, 서버 값을 고치는 수정 폼은 `values` + `resetOptions: SERVER_VALUES_RESET_OPTIONS`(`shared/constants`)로 다시 받은 값과 맞춘다(고치지 않은 칸은 새 값, 고치던 칸·`isDirty`·칸 오류는 그대로). RHF는 `keepDirtyValues`만 주면 마운트와 다시 받을 때마다 `isDirty`와 칸 오류를 지우므로 이 상수를 쓴다. `form.reset`도 `resetOptions`를 합치니 저장한 값으로 다시 시작할 때는 `form.reset(values, SAVED_VALUES_RESET_OPTIONS)`다. `reset`을 부르는 effect를 쓰지 않는다. 처음 값은 스키마 `.default()`가 아니라 `defaultValues`에 두고 값 없는 칸은 `null`이다.
- 스키마는 `schemas/{name}-form.schema.ts` 하나다. 계약의 요청 스키마나 모델에서 `pick`·`omit`·`extend`로 유도하고 공백 정리는 `trimmed(contract.shape.title)`, 한도는 vocabulary다. 저장 가능 여부를 함수로 또 만들지 않는다. 늘 함께 바뀌는 칸은 한 값이다(`range: { startDate, endDate }`).

## 칸 잇기와 다시 그리기

RHF 7.92의 `Controller`·`Watch`·`FormState` 컴포넌트로 이어 값이 바뀌면 그 조각만 다시 그린다.

- 칸 하나는 `Controller`다. `render`에서 입력 부품에 `field.value`·`field.onChange`·칸 오류 문구를 넘기고 `field.ref`를 넘겨 검증 실패 칸에 포커스한다.
- 여러 칸에서 읽기만 하는 조각은 `<Watch control={form.control} name={[…]} render={…} />`, 제출 중·유효·오류에 달린 조각(버튼)은 `<FormState control={form.control} render={…} />`다. `Watch`의 `names`와 `FormStateSubscribe`는 deprecated라 `name`과 `FormState`를 쓴다.
- 화면 몸체에서 `form.watch()`를 부르거나 `form.formState`를 읽지 않는다. 몸체가 구독하면 글자를 칠 때마다 화면 전체가 다시 그려진다.
- 단계 전체가 그 값에 달리면 지역 단계 컴포넌트에서 `useController`·`useWatch`·`useFormState({ name })`를 쓴다.
- 렌더 중 `getValues()`는 React Compiler가 캐시해 갱신되지 않으므로 핸들러에서만 쓴다.
- 코드로 바꾼 칸(칩·받아쓰기·초안)은 `setValue(…, { shouldDirty: true })`로 고친 칸이 되게 하고, 버튼·완료 키가 `isValid`를 보면 `shouldValidate: true`도 준다.

## 버튼과 제출

- 버튼은 `isValid`·`isSubmitting`·`isSubmitSuccessful`과 mutation `isPending`·`isSuccess`로만 정한다. `safeParse`로 버튼 상태를 따로 계산하지 않는다. 단계 폼의 다음 버튼은 폼 전체가 아니라 그 단계 칸만 본다. `getFieldState(name, formState)`의 `isDirty && !invalid`로 정한다(`useFormState({ name })`로 구독). 단계 버튼이 바로 따르게 `mode: 'onChange'`로 검사하고, 오류 문구는 칸을 벗어난 뒤(`isTouched`)나 그 칸에 적은 뒤(`isDirty`)에만 보인다.
- 제출은 화면이 `form.handleSubmit`으로 만든 `submit{X}`(`submitMemo`·`submitEmailLogin`)이고, 저장이 아닌 일(로그인·확인·삭제)도 `save`가 아니라 `submit`이다. 그것을 감싼 `useSingleTap`은 누르는 버튼의 일을 말하는 `handle{X}Press`(`handleSavePress`·`handleLoginPress`)다. 같은 프레임의 두 번째 탭은 `isSubmitting`이 다음 렌더에야 켜져 `useSingleTap`으로 막는다.
- 저장하면 닫히는 폼(시트·화면)은 닫히는 동안에도 값이 남아 `isSubmitting`이 꺼지면 버튼이 다시 켜진다. 그동안 버튼과 완료 키를 `isSubmitting || isSubmitSuccessful`로 막는다. `isSubmitSuccessful`이 실패에 켜지지 않게 실패는 `handleSubmit` 안에서 받지 않고 호출부 `.catch`에서 받는다(할 일·카테고리 추가). `mutate`로 보내는 폼은 mutation `isSuccess`로 막는다(계획 검토).
- 저장을 기다린 뒤 떠나면 그 사이 화면을 떠났는지 먼저 본다([경로와 이동](./state-and-routing.md#경로와-이동)).
- 서버 4xx 중 칸에 속한 오류는 화면이 `form.setError`로 그 칸에 보인다. 코드와 칸의 매핑은 `domains/{feature}.error.ts`에 둔다. 실패해도 입력값을 지우지 않는다.
- 확인할 동작: 성공하면 닫힘·갱신·초안 삭제·이벤트 한 번, 4xx·연결 끊김이면 입력값·초안 유지와 안내 한 번, 두 번 눌러도 요청 한 번, 검증 실패나 바뀐 값 없음이면 요청 없음.

## 키보드

폼 소유를 옮겨도 키보드 동작은 바꾸지 않는다. `FormScrollView`·`FormStepLayout`·`KeyboardAdaptiveButton`·`KeyboardBottomSheet`, 시트의 키보드 여백, `field.ref` 포커스, 완료 키를 JSX째 옮긴다. 옮긴 뒤 입력칸과 저장 버튼이 키보드 위에 보이는지, 키보드가 열린 채 첫 탭에 눌리는지, 실패해도 글자가 남는지 기기에서 본다([사용성](./ui.md#사용성-구조보다-먼저)).

## 초안

- `useDraftStorage(draftKey)`가 첫 렌더에 동기로 읽어 생성 폼은 `defaultValues`에 넣고, 수정 폼은 그리기 전(`useLayoutEffect`) 고친 글자로 넣는다(`setValue(…, { shouldDirty: true })`, 메모 편집). 칸 목록(`useFieldArray`)은 그 훅의 `replace`로 넣는다. RN의 RHF는 칸 구독을 `useEffect`로 걸어 먼저 도는 effect의 `setValue`를 첫 마운트에 놓친다(댓글 작성기). `useFormDraftAutosave(form.subscribe, …)`가 렌더 없이 디바운스 저장하고, 언마운트 때 대기 저장을 flush하며, 제출 성공·취소 때 대기 저장까지 취소한 뒤 지운다.
- 초안 키는 `utils/{feature}-draft.ts`의 순수 함수가 `createDraftKey`로 만들고 사용자 id가 들어간다. 저장소는 암호화 MMKV이고 `DRAFT_TTL_MS`가 지난 초안과 원본보다 오래된 편집 초안은 버린다. 비밀번호·인증 코드는 초안으로 저장하지 않고, 긴 본문을 URL·Query 캐시에 넣지 않는다.
