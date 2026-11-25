# UI: 컴포넌트와 스크린

부품 고르기는 [ui-catalog](./ui-catalog.md), 색·글꼴·톤은 [design](../design.md)과 [DESIGN.md](../../DESIGN.md), route·시트 띄우기는 [state-and-routing](./state-and-routing.md), 공용 훅은 [hooks](./hooks.md), 쿼리·`select`는 [data](./data.md), 폼은 [forms](./forms.md)를 본다.

## 컴포넌트 계약

기능 컴포넌트는 자기 데이터를 조회하고 그리고 동작한다. 조회, mutation 옵션, 오류 판별, 시트 열기는 기능 컴포넌트·훅이 갖고 화면은 그것을 나열한다. 레이아웃은 모른다.

- **데이터는 쓰는 컴포넌트가 조회한다.** 화면이 조회해 내리면 경계를 블록 단위로 나눌 수 없다. 지역 부속에 좁힌 값을 넘기는 것은 괜찮다(`MemoList.Item`의 `memo`).
- **화면 id는 route 튜플 훅에서 읽는다**(`const [todoId] = useTodoId()`). id·search param을 Props로 내리지 않는다. 예외는 목록 행의 id다(댓글 기능은 `aido/no-route-id-props`).
- **바깥 여백을 모른다.** 루트에 margin·`self-*`·위치·safe area를 두지 않는다. 자기 모양(`rounded-2xl bg-gray-1`)과 안쪽 여백만 컴포넌트 몫이고, 바깥 간격은 화면의 `Spacing`이나 화면이 원본 `className`으로 넘긴 값이다(`<UnreadNotificationCard className="mx-4 my-2" />`).
- **입력은 `value`/`onChange`다.** 값은 모델 값이다. 누르면 시트를 열어 고르게 하는 입력도 고른 값을 `onChange`로 준다. heroui 원본을 넓힌 부품만 원본 이름을 따른다: shared `Input`·`TextArea`는 `value`/`onChange`, `Checkbox`·`Switch`·`ControlField`는 `isSelected`/`onSelectedChange`, `RadioGroup`·`Tabs`는 `value`/`onValueChange`, 시트·다이얼로그는 `isOpen`/`onOpenChange`, 비활성은 `isDisabled`다. `disabled`·`selected`·`onToggle`을 새로 만들지 않는다.
- **목록은 `filters`·`orderBy`·`limit`를 받는다.** 타입은 모델의 `Filter{X}`·`OrderBy{X}`이고 거르기·정렬은 쿼리 `select`가 한다([data](./data.md#흐름-mapper--캐시--select--view-model)). 거르기·정렬을 바꿀 곳이 생긴 목록만 연다(`CategoryPickForm`의 `filters`). 쓰는 화면이 하나인 목록은 인자 없이 자기 조회를 부른다(`CategoryList`, `SuggestionsList`).
- **받지 않는 것.** 폼(`form`·`control`, [forms](./forms.md)), 단계(`stepper`), 내비게이션 객체, 화면 하나만 쓰는 boolean 모드. 자리는 같고 구현이 갈리면 `mode` 대신 컴포넌트를 prop으로 넘긴다(`toolbar={MemoEditor.StackToolbar}`).
- **원본을 확장하면 원본 Props를 지킨다.** `interface XProps extends Omit<ComponentProps<typeof X>, …>`로 적고 남은 Props는 `...props`로 원본에 넘긴다. 직접 구현하는 prop만 `Omit`하고 `className`·`style`·`testID`·접근성 prop·`hitSlop`은 남긴다. Props는 `interface`이고 더할 것 없는 별칭만 `type`이다. `ReturnType<typeof useX>`로 만들지 않는다.
- 레이아웃 원시(`Box`·`HStack`·`VStack`·`Flex`)를 감쌀 때는 `ComponentProps<typeof Box>`를 펼치지 않고 쓰는 prop(`children`, `className`, 필요한 접근성 prop)만 적는다.
- 래퍼는 자기 일(단위·포맷·도메인 문구·저장)이 있을 때만 만든다. 없으면 원본을 쓴다.

```tsx
// features/identity/user/components/user-avatar.tsx
interface UserAvatarProps extends Omit<ComponentProps<typeof Avatar>, 'children'> {
  profileImage: string | null;
}

export function UserAvatar({ profileImage, ...props }: UserAvatarProps) {
  return (
    <Avatar {...props}>
      <Avatar.Image source={getProfileIconSource(profileImage)} />
    </Avatar>
  );
}
```

```tsx
// 목표 모양: route id가 없으면 빈 조각, 좁힌 id는 .Contents가 조회한다
export function MemoSummary() {
  const [selectedMemoId] = useSelectedMemoId();

  if (selectedMemoId == null) {
    return <MemoSummary.Empty />;
  }

  return <MemoSummary.Contents memoId={selectedMemoId} />;
}
```

- 행은 route 훅을 부르지 않는다. 부모가 한 번 읽어 `isSelected` 같은 파생 값과 같은 핸들러를 넘긴다.
- 행의 현재 값은 값만 그리는 컴포넌트가 자기 경계로 읽는다(`FriendCountValue`, 실패하면 `QueryErrorFallback.Hidden`, 로딩은 `Suspense fallback={null}`).
- 배타 상태는 `match(…).exhaustive()`, 단순 표시는 `&&`다. 저장 진행은 mutation `isPending`을 `Button`의 `isLoading`에 넘긴다.
- 메모는 React Compiler가 한다. `useMemo`·`useCallback`·`memo`는 이유가 있을 때만 둔다(가상 목록·캘린더 칸의 `memo`). 이유 없는 직접 메모는 그 파일을 고칠 때 지운다.
- 색은 토큰 클래스만 쓴다. 조건부 className은 `cn`, 변형이 둘 이상이면 `tv`(`*.variants.ts`)다. 템플릿 리터럴·삼항으로 문자열을 잇지 않는다(`aido/no-classname-concat`). 인라인 `style`은 동적 값(잰 크기, 애니메이션 스타일, 계산한 inset)에만 쓴다.

## 네임스페이스·지역 컴포넌트

- 부모 없이 의미 없는 조각은 **무엇이든** 부모 파일 아래 `Parent.Part`로 둔다(`PlanSummary.Quota`, `DailyForecast.TemperatureBar`, `TodoCommentThreadList.SortBar`). 부모를 지우면 함께 지워지고, 이름이 부모와의 결합을 알린다.
- 같은 뜻은 같은 조각 이름이다: `.Loading`·`.Error`·`.Empty`·`.Item`(행), `.Link`(행을 감싼 Link), `.Contents`(id를 좁혀 받는 조각). `Row`·`Cell`·`Entry`·`PaneLoading`·`ItemLink`와 객체 묶음 네임스페이스를 쓰지 않는다. 행마다 로딩은 `X.Item.Loading`이다.
- 형태는 `X.Part = function Part() {}`다(`Object.assign` 금지). 부속에 또 `.Loading`을 달면 TS가 `X.Part.Loading`을 모르므로 그 부속만 함수 선언을 대입한다(`SettingsListGroup.Item`, `ListRow.Texts`). 쓰지 않는 부속은 만들지 않는다.
- **스스로 조회하면 `.Loading`·`.Error`를 짝으로 둔다.** 부모 경계 하나에 묶여 함께 그려지는 조각(날씨 리포트 칸)은 그 부모의 조각이고 자기 짝을 두지 않는다. route 시트는 `RouteBottomSheet`가 오류·문의를 그리므로 `.Error`를 두지 않는다. 원본을 넘기기만 하는 `X.Item = (props) => <UserList.Item {...props} />`을 만들지 않고, 같은 fallback은 `X.Error = UserList.Error`로 잇는다.
- 같은 모양으로 반복되는 **고정** UI는 역할이 드러나는 지역 컴포넌트로 추상화하고(`Fact`, `Stat`) 항목마다 **한 줄씩** 쓴다. 설정 배열을 `.map`하지 않는다. "이 항목만 강조·숨김" 같은 기획 수정이 그 한 줄에서 끝난다. `.map`·`FlashList`는 서버 데이터 목록에만 쓴다([목록](#레이아웃-시프트워터폴목록)). 화면 등록 설정(`app/(app)/_layout.tsx`의 `SHEET_ROUTES.map`)은 UI가 아니라 예외다. 본보기는 `plan-comparison-table.tsx`의 비교 줄이다.

```tsx
// Before: 항목 하나를 고치려면 배열·조건·map을 함께 읽는다
const facts = compact([t('daily.precipitation', …), wind == null ? null : t('daily.windMax', …)]);
{facts.map((fact) => <Text key={fact} size="b4">{fact}</Text>)}

// After
<HStack className="flex-wrap gap-x-3 gap-y-1">
  <Fact>{t('daily.precipitation', { amount: round(day.precipitationAmount, 1) })}</Fact>
  <Fact>{t('daily.uvMax', { value: day.uvIndexMax })}</Fact>
  {wind != null && <Fact>{t('daily.windMax', { speed: round(wind, 1) })}</Fact>}
</HStack>
```

- **한 곳만 쓰는 컴포넌트·훅은 쓰는 파일 안에 둔다.** 파일을 따로 두는 경우와 route 파일의 지역 조각은 [structure의 공개 면](./structure.md#공개-면)이다. 두 기능 이상이 쓰고 도메인 뜻이 없으면 `shared/ui`다([새 부품](./ui-catalog.md#새-부품-추가)).
- **추출은 추상화가 아니다.** JSX를 다른 파일로 옮기기만 하면 변경 이유는 줄지 않고 읽는 사람만 오간다. 파일이 길다고 나누지 않고, 책임이 여럿이면 같은 파일 안에서 지역 컴포넌트·지역 훅·네임스페이스로 나눈다. 역할 없이 한 줄을 감싼 조각은 쓰는 곳에 인라인한다.
- **위치 이름 금지.** `*Section`, `*Detail`, `*Content`, `*Panel`, `*Area`, `*Info`, `*Body`, `*Frame`, `*Wrapper`, `*Inner`, 단독 `*Header`·`*Footer`(`*Inner` 밖은 `aido/component-name`). 원본 이름을 접미사로 쓰는 확장(`HintPopoverContent`, `MenuContent`)과 부모 아래 부속(`TodoCommentThreadList.Header`)은 이름이 역할을 말하므로 쓴다.
- **글꼴·화면 크기 주석은 함께 옮긴다.** 큰 글자·작은 화면·폴더블·iPad·Mac을 이유로 적은 주석은 코드로 알 수 없는 이유라 지우지 않는다. 컴포넌트를 옮기면 주석과 그 줄의 className·상수(`min-h-0 shrink`, `flex-wrap`, 고정 칸 크기)를 함께 옮긴다.

## 스크린

route 파일이 화면을 조립한다. 제목, 경계, 문구, `Spacing`, `match(view)`, 단계(`<stepper.Render>`, [useStepper](./hooks.md#usestepper)), 폼([forms](./forms.md))이 위에서 아래로 보인다.

```tsx
// app/(app)/(tabs)/(me,memos,todos)/notifications/index.tsx 발췌
<Stack.Screen options={{ title: t('titles.notifications') }} />

{match(visibleDirection)
  .with('received', () => (
    <Tabs.Content value={category} className="flex-1">
      <QueryErrorBoundary resetKeys={[category]} fallback={NotificationList.Error}>
        <Suspense fallback={<NotificationList.Loading />}>
          <NotificationList />
        </Suspense>
      </QueryErrorBoundary>
    </Tabs.Content>
  ))
  .with('sent', () => (/* SentNudgeList를 같은 모양으로 */))
  .exhaustive()}
```

- **화면이 갖는 것.** 단계·경계·제목·화면 문구·`Spacing`·`match(view)`와 폼(`useForm`, 칸 연결, `handleSubmit`, `setError`). 그 화면만 쓰는 지역 훅·지역 컴포넌트(`useView`, 진행 점, 단계 화면, 제목 줄)는 같은 route 파일 아래에 둔다. 파일이 길어도 다른 파일로 옮기지 않는다.
- **화면이 하지 않는 것.** 조회 값 가공, 규칙 계산, 요청 만들기, 오류 판별, 시트 열기. 이것은 기능 컴포넌트·훅·모델이 준다.
- params가 있는 route는 맨 위 컴포넌트가 검증과 redirect만 하고, 같은 파일의 화면 컴포넌트가 조립한다([params 튜플](./state-and-routing.md#params-튜플)).
- 블록마다 `QueryErrorBoundary` → `Suspense fallback={<X.Loading />}` → `<X />`를 화면에 나열한다. 경계를 기능 컴포넌트·훅 안에 숨기지 않는다(값만 그리는 조각은 예외, [위](#컴포넌트-계약)).
- **fallback은 `fallback={X.Error}`다.** 실패하면 비우는 값 조각은 `fallback={QueryErrorFallback.Hidden}`이다. 인라인 화살표, `() => null`, `null`만 돌려주는 `.Error`를 쓰지 않는다. 예외는 시트를 닫아야 하는 시트 안 경계의 `(props) => <X.Error {...props} onInquiry={…} />`뿐이다.
- 상태별 화면은 `match(view).with(…).exhaustive()`로 화면에서 고른다. 넘기기용 래퍼(`Content → Header → Section`), 재수출한 화면, JSX 상수(`const progress = <Steps.Dots … />`)를 만들지 않고 지역 컴포넌트로 둔다.
- 한 쿼리를 두 경계에서 읽지 않는다(한 오류는 한 곳). 로딩·오류·빈·데이터 4상태를 그린다.
- 스스로 숨는 블록은 간격도 함께 사라진다. 조건을 화면이 알면 `{isAvailable && (…)}` 안에 `Spacing`과 블록을 함께 두고, 조회해야 아는 카드만 화면이 `className`으로 바깥 여백을 넘긴다.
- 여러 탭에서 여는 화면(친구·설정류)은 탭마다 함께 쓰는 그룹에 파일 하나로 두고 제목은 화면이 정한다. 어느 탭에 열리는지와 더하는 법은 [탭과 함께 쓰는 화면](./state-and-routing.md#탭과-함께-쓰는-화면)이다.

## 코드 배치

1. **컴포넌트 몸체.** `t`·DI → route params → 쿼리·prefetch → 지역 상태·ref → mutation·동작 훅 → 파생 값 → effect → 조기 반환 → 핸들러 → JSX. 그룹 사이에 빈 줄 하나, 그룹 안에는 두지 않는다. 데이터 의존으로 순서를 바꾸면 주석을 단다.
2. **스크린 JSX.** 형제 구역은 빈 줄로 나눈다. 세로 간격은 `<Spacing>`만 쓰고 위아래에 빈 줄을 둔다. 블록에 `mb`·`pb`를 주지 않는다(스스로 숨는 카드는 예외).
3. **여백 표기.** 레이아웃 prop(`p`, `gap`)과 `className` 여백을 한 태그에, 형제끼리 섞지 않는다(`aido/spacing-props-with-classname`, `aido/one-spacing-notation`).
4. **파일 순서.** 상수·타입 → 기본 export → 네임스페이스 부속 → `.Loading` → `.Error` → `.Empty` → 지역 컴포넌트 → 지역 훅 → 순수 helper. route 파일도 같아 화면 컴포넌트 아래에 단계 화면·지역 훅이 온다.

## 사용성 (구조보다 먼저)

| 상황                 | 기대                                    | 쓰는 것                                                                                              |
| -------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 입력칸을 누름        | 칸·오류 문구가 키보드 위에 보임         | 화면 폼 `FormStepLayout`·`FormScrollView`, 시트 `KeyboardBottomSheet`, 편집기 `KeyboardAvoidingView` |
| 저장 버튼            | 키보드에 가리지 않음                    | `KeyboardAdaptiveButton`, 시트 `footer`                                                              |
| 키보드가 열린 채 탭  | 첫 탭에 동작                            | `keyboardShouldPersistTaps="handled"`, 입력을 이어 가는 칩 줄·시트·댓글은 `"always"`                 |
| 키보드 위치          | 실제 키보드와 같이 움직임               | `react-native-keyboard-controller`. `Keyboard.addListener` 타이밍으로 흉내 내지 않는다               |
| 키보드 내리기        | 화면·시트가 바뀌어도 키보드가 남지 않음 | `useDismissKeyboard()`(keyboard-controller, 실패는 로그). 시트가 열리고 닫힐 때는 시트 부품이 내린다 |
| 다음·완료 키, 입력값 | 다음 칸·제출, 맞는 키보드               | `returnKeyType`, `onSubmitEditing`, `setFocus`, `keyboardType`, `textContentType`                    |
| 검증·저장 실패       | 틀린 칸 포커스, 글자 유지               | `Controller`의 `field.ref`, `isPending`, 초안                                                        |
| 뒤로 가기            | 작성 중 글자를 잃지 않음                | 초안 또는 확인 다이얼로그                                                                            |
| 큰 글꼴·작은 화면    | 주 버튼에 닿음, 짧은 라벨 한 줄         | 스크롤 틀, 고정 높이 컨트롤, `numberOfLines`                                                         |

구조를 고치다 사용성이 나빠지면 구조를 양보한다.

## 레이아웃 시프트·워터폴·목록

- `X.Loading`은 받은 뒤와 같은 슬롯·높이다. 글자는 `TextSkeleton size`, 행 글자는 `ListRow.Texts.Loading`이고, 데이터로 생기는 줄(설명·하위 항목)은 그리지 않는다.
- 받은 뒤 나타나는 버튼·배너는 자리를 먼저 비운다. 대부분 안 보이는 블록만 `Suspense fallback={null}`이고 이유를 주석으로 남긴다. 남의 높이를 매직 넘버로 복제하지 않는다(재야 하면 `useLayoutSize()`). 이미지는 `AspectRatio`, 오류 문구는 `preserveErrorSpace`다. 데이터가 있으면 재조회 중에 fallback으로 바꾸지 않는다. 부품을 바꾸면 전후를 겹쳐 비교하고 다르면 바꾸지 않는다.
- **워터폴.** 한 컴포넌트의 독립 조회는 `useSuspenseQueries({ queries: [a, b] })`로 함께 건다. `useSuspenseQuery`를 차례로 부르면 둘째는 첫 응답 뒤에 나간다. 안쪽 블록이 멈춘 뒤에야 시작될 조회는 바깥에서 `usePrefetchQuery`로 함께 시작한다([data](./data.md#쿼리-키)). Suspense로 멈추는 훅은 이름이 `useSuspense{X}`다(멈춤을 이름에서 숨기지 않는다).
- **목록.** 서버 커서 목록은 `InfiniteList`(FlashList v2: 하단 로딩·재시도·중복 호출 방지·당겨서 새로고침), 길이가 정해지지 않은 서버 목록은 `FlashList`, 상수로 개수가 묶인 서버 목록은 `.map`, 고정 개수 스켈레톤은 `range(n).map`이다. 길이 제한 없는 `.map`은 쓰지 않는다.
- 날짜 구역 나누기는 쿼리 `select`다. 머리말·꼬리말(카드·정렬 바)은 `ListHeaderComponent`·`ListFooterComponent`에 직접 적는다(목록 밖으로 옮기면 스크롤과 첫 위치가 바뀐다). 긴 안내 글은 `WordWrapText`, 가상 목록 행은 `lineBreakStrategyIOS="hangul-word"`다.

## 글꼴과 기기

- **글꼴.** 단계·OS 배율·크기 토큰은 [design](../design.md#글꼴)이 원본이다(앱 5단계, `allowFontScaling: false`). `HeroUIProvider`가 heroui 글자에도 배율을 끈다. 크기는 `Text size` 토큰, 아이콘·장식 그림은 `useFontScaledSize()`(배율 변화의 절반, 날씨 카드 안은 글자와 같은 `useFontScaleRatio()`), 버튼 누름 칸은 고정(아래), 스켈레톤은 `TextSkeleton size`다.
- **아이콘만 있는 버튼.** 누름 칸(원·배경)은 고정 크기(`size-9` 등)이고 안의 아이콘만 `useFontScaledSize()`로 글꼴 단계를 따른다. 칸까지 배율을 따르면 큰 단계에서 버튼이 상하좌우로 늘어나 옆 버튼과 크기가 어긋난다(작성 줄 보내기·말하기·지우기). 아이콘만 있는 누름은 `IconButton`이다.
- **누르는 영역은 44pt 이상이다.** 44는 최소이고, 이미 넓은 영역은 줄이지 않는다. 보이는 모양은 두고 모자란 축만 `hitSlop`으로 채운다. 값은 `getTouchTargetInset(보이는 크기)`(`(44 - 크기) / 2`)이고 보이는 크기는 이름 있는 상수(`CHECKBOX_SIZE`)로 둔다. 글꼴로 커지는 글줄·아이콘은 가장 작은 단계 크기로 잰다. `TextButton`은 받은(또는 기본) 위아래 여백과 지금 단계의 줄 높이로 44를 채우는 여백 가운데 큰 쪽을 쓴다.
  - 옆 컨트롤·다음 줄과 누르는 영역이 겹치는 축은 사이 간격의 절반까지만 넓히고(약관 화살표), 한쪽이 막히면 막힌 쪽은 간격만큼, 나머지를 반대쪽에 준다(카테고리 알약). 목록 행 안 작은 버튼(할 일 ⋯)은 위아래 행의 버튼과 겹쳐 44에 못 미친 채 둔다.
- 높이가 정해진 컨트롤(버튼·칩·탭)은 고정 높이와 좌우 padding이다. 짧은 라벨은 작은 iPhone 최대 단계에서 ko·en 모두 한 줄이다. 바뀌는 숫자는 `tabular-nums`다.
- **기기.** iPhone, iPad, 폴더블(접음·펼침), iPhone Duo, Android 휴대폰·태블릿을 지원한다. 칸 수는 사이드바·레일 inset을 뺀 탭 안 내용 폭(Android는 시스템 바·컷아웃 inset을 빼지 않은 폭) `usePaneSizeClass()`(`compact`·`medium`·`expanded`), 창 전체 정책(방향·시트 배치)은 `useWindowSizeClass()`로 정한다. 기기 이름·힌지로 나누지 않는다. 플랫폼 분기는 `process.env.EXPO_OS`다(`Platform.OS`는 `no-restricted-properties`. 개발 빌드에서도 글자로 바뀌는 `process.env.EXPO_OS` 하나로 맞춘다).
- 2열은 `AdaptivePane` 하나라 접고 펴도 다시 마운트되지 않는다. 폭마다 다시 만드는 무거운 부품은 `useDeferredValue`로 늦춘다. 배치 규칙(짧은 창, 방향 잠금, 칸 나누기, 접힘선)은 `shared/ui/adaptive-pane/window-layout.ts`의 `WindowLayoutPolicy`다. Mac(Designed for iPad)은 늘 `compact`다.
- Duo 세로 레일(84pt)은 safe area로 피한다. 탭 Stack 페이지 스크롤은 `SafeAreaScrollView`, 고정 헤더·하단 버튼·가상 목록 화면은 루트 `edges`에 `left`·`right`를 더한다. 같은 축을 두 번 감싸지 않는다. 헤더는 네이티브 Stack 헤더와 `Stack.Toolbar`만 쓴다.
- 탭 안 스크롤 목록은 루트 `edges`에 `bottom`을 넣지 않고 목록에 `contentInsetAdjustmentBehavior="automatic"`을 준다(피드·메모·알림함·배지·녹음 저장 공간). 아래 inset에 떠 있는 탭 막대가 들어 있어 `bottom`을 넣으면 목록이 막대 위에서 잘리고 막대 뒤가 빈 띠로 남는다. 내용 칸 `flexGrow`는 빈 안내를 그릴 때만 준다. 행이 있을 때도 주면 짧은 목록이 자동 inset만큼 끌려 올라간 채 머문다. Android 탭은 내용을 막대 위에 놓아 따로 띄우지 않는다.

## 모션과 Skia

- Reanimated 4 `.get()`·`.set()`을 쓰고(`.value` 금지, `aido/shared-value-accessor`) transform·opacity만 움직인다(`width`·`height` 금지). ease-out, 시간은 `ANIMATION` 상수다. 예외는 옆 요소가 함께 밀리거나 둥근 끝이 늘어나 transform으로 같은 모양을 낼 수 없는 아래 넷뿐이다(저사양 Android 60fps는 기기에서 확인한다).
  - 피드 달력의 주↔월 높이(`CalendarHeightTransition`): 아래 피드가 접히는 달력을 따라 올라가야 해 높이만 UI 스레드에서 움직이고, 내용 폭은 안쪽에서 재어 전환 중 다시 재지 않는다
  - `Steps` 뒤로 버튼·체크 슬롯 `width`·`marginRight`: 슬롯이 열리며 다음 버튼 폭이 함께 줄어든다
  - `StepsDots` 진행 막대 `width`: `scaleX`면 둥근 끝이 함께 늘어난다
  - `KeyboardAdaptiveButton` 좌우·아래 `padding`과 `borderRadius`: 키보드에 붙으면 버튼이 화면 폭을 채운다. `KeyboardStickyView`와 같은 시간에 맞춘다
- 탭 전환은 애니메이션하지 않는다. 모션 줄이기는 `reduceMotion: ReduceMotion.System`이고 반복·강조 모션은 `useIsReduceMotionEnabled()`면 생략한다. 누름은 heroui `PressableFeedback`, 햅틱은 `useHaptics()` 한 번이다.

1. **만들기.** `RuntimeEffect`·고정 `Path`·`Picture`는 모듈 수준이나 입력이 같으면 다시 만들지 않는 메모로 만든다. 렌더·프레임마다 `Skia.*.Make`하지 않는다.
2. **정리.** `SkPath`·`SkImage`·텍스처는 Canvas가 더 읽지 않게 된 뒤 만든 쪽이 `dispose`한다. prop으로 넘긴 경로는 Canvas가 커밋 때 복사해 기록하므로 만든 effect의 정리 함수에서 바로 놓는다(`frost-layer`·`night-sky-layer`·재생 바 깃발). shared value에 든 경로·텍스처는 Canvas 매퍼가 UI 스레드에서 읽으므로 UI 스레드에서 새 값(내려갈 때는 빈 값)을 먼저 넣고 앞의 것을 놓는다(`useRebuiltPath`·`useOwnedTexture`). `PathBuilder`는 `detach` 뒤 바로 놓고, 되쓰는 빌더는 주인이 내려갈 때 놓는다. 값이 바뀔 때마다 다시 그리는 경로는 `useRebuiltPath(read, draw)`(`shared/hooks`)로 만든다. `read`가 읽은 값(`===`)이나 `draw`가 바뀔 때만 다시 그린다. 모양이 시계의 구간마다 바뀌면 시계 대신 구간 번호를 돌려준다(번개). Skia `usePathValue`는 앞 경로를 놓지 않아 쓰지 않는다. 경로에 넣는 사각형은 `Skia.XYWHRect`·`RRectXY` 대신 같은 모양의 평범한 객체(`toRoundedBar`)로 넘긴다.
3. **프레임 작업.** worklet의 shared·derived value로만 한다. 프레임마다 React 상태를 바꾸거나 JS로 건너가지 않는다(`scheduleOnRN`은 이벤트만). 파티클 배열은 미리 만든다. 컴포넌트·훅 안 worklet(`useDerivedValue` 콜백 포함)에는 아무것도 잡지 않는 인라인 콜백(`values.map((count) => …)`)을 두지 않는다. React Compiler가 모듈 함수 `_temp`로 빼내 UI 스레드가 worklet이 아닌 함수를 불러 멈춘다([facebook/react#32580](https://github.com/facebook/react/issues/32580)). 바꾼 배열은 렌더에서 만들어 넘기거나 모듈 수준 `'worklet'` 함수 안에서 돈다(`completion-hour-chart`).
4. **멈춤 조건 하나.** 꾸밈 프레임 콜백·`withRepeat`는 `useIsAnimationActive()`(화면 포커스 + 앱 앞 + 모션 줄이기)로 켜고 끈다. 값을 모으는 프레임 콜백·재생 위치는 투명 시트·제어 센터(`inactive`)에도 이어져야 해서 `useIsAppInBackground()`일 때만 멈춘다.
5. **크기.** Skia 2.14의 `Canvas onSize`는 멈출 수 없는 프레임 콜백으로 매 프레임 잰다. 감싼 View의 `onLayout`에서 shared value로 `set`한다(JS 값이 필요하면 `useLayoutSize`). `onSize`는 이미 프레임마다 그리는 Canvas에서만 쓴다.
6. **품질.** 기기 등급별 입자 상한을 지킨다(날씨는 `weather-scene-particles.view-model.ts`의 `PARTICLE_BUDGETS`, 저사양은 `lowEndCap`). 그린 화면을 다시 읽는 셰이더(`BackdropFilter`, 무더위 아지랑이)는 저사양(`isLowEndDevice`)에서 끈다.

## 확인

- 화면을 건드린 PR마다 Maestro Before/After를 찍는다: 글꼴 최소·최대 × 작은 iPhone·접은 Duo·펼친 Duo·iPad × ko·en(라이트·다크는 색을 바꿨을 때). 로딩 중과 완료 후를 같은 자리에서 찍어 위치·잘림·줄바꿈을 비교한다.
- 주요 흐름, 실패와 재시도, 키보드, 뒤로 가기는 직접 해 보고 한 것과 못 한 것을 나눠 보고한다. 누름 동작은 기기에서도 확인한다.
- 모션·Skia는 날씨(비·눈·번개·밤하늘)와 음성 시각화를 iPhone·저사양 Android에서 30초 돌려 프레임 드롭률을 Before/After로 센다. 20번 열고 닫은 뒤 메모리가 돌아오는지, 앱을 뒤로 보내면 프레임 콜백이 0인지 본다.
