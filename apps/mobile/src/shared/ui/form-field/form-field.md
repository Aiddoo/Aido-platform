# FormField

Native 입력과 React Hook Form의 field·오류 binding을 연결한다. 폼의 schema, 초기값, 제출은 상위 화면이 소유한다.

```tsx
<FormField control={form.control} name="email">
  {(field, { error }) => (
    <Input {...field} isInvalid={error != null} errorMessage={error?.message} />
  )}
</FormField>
```

| Props                                                                      | 의미                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------- |
| `control`, `name`, `rules`, `disabled`, `defaultValue`, `shouldUnregister` | RHF `UseControllerProps` 원본 계약                  |
| `children(field, fieldState)`                                              | controlled 입력과 field 오류를 조합하는 render 함수 |

파일: `FormField.tsx`. 접근성 이름과 오류 문구는 기존 Input/TextArea가 담당한다. 깊은 field 조각은 FormProvider의 control을 소비하고 전체 폼 값을 별도 state에 복제하지 않는다.
