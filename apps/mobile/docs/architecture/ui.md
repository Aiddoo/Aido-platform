# UI: 컴포넌트와 스크린

부품 고르기는 [ui-catalog](./ui-catalog.md), 색·글꼴·톤은 [design](../design.md)과 [DESIGN.md](../../DESIGN.md), route·시트 띄우기는 [state-and-routing](./state-and-routing.md), 공용 훅은 [hooks](./hooks.md), 쿼리·`select`는 [data](./data.md)를 본다.

## 기준 컴포넌트

참고 저장소(frontend-fundamentals-mock-exam-1)의 세 컴포넌트가 모든 기능의 모양이다. 아래 예시의 `MemoSummary`·`useSelectedCategoryId`·`useGetCategoriesQueryOptions`·`MemoActionButtonProps`는 모양을 보이려고 지은 이름이라 코드에 없다. 실제 쓰임은 `CategoryPickForm`(`filters` → `useGetTodoCategoriesQueryOptions({ filters })`의 `select`), `MemoList.Item`, `NotificationList`를 본다.

**`AmountInput`: 역할이 있는 래퍼만 만들고 원본 Props를 지킨다.**

- 래퍼는 자기 일(단위·포맷·도메인 문구·저장)이 있을 때만 만든다. 없으면 원본을 쓴다.
- `interface MemoActionButtonProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'>`처럼 직접 구현하는 prop만 `Omit`한다. `className`·`style`·`testID`·접근성 prop·`hitSlop`은 남긴다.
- 제어 prop은 원본 이름이다: shared `Input`·`TextArea`는 `value`/`onChange`, `Checkbox`·`Switch`·`ControlField`는 `isSelected`/`onSelectedChange`, `RadioGroup`·`Tabs`는 `value`/`onValueChange`, 시트·다이얼로그는 `isOpen`/`onOpenChange`, 비활성은 `isDisabled`다. `disabled`·`selected`·`onToggle`을 새로 만들지 않는다.
- Props는 인터페이스로 적는다. `ReturnType<typeof useX>`로 만들지 않는다.

**`CalculationResult`: id는 route 튜플에서 읽고, `== null`이면 빈 조각, 좁힌 id는 `.Contents`가 조회한다.**

```tsx
export function MemoSummary() {
  const [selectedMemoId] = useSelectedMemoId();

  if (selectedMemoId == null) {
    return <MemoSummary.Empty />;
  }

  return <MemoSummary.Contents memoId={selectedMemoId} />;
}

MemoSummary.Contents = function Contents({ memoId }: { memoId: number }) {
  const { t } = useTranslation('memo');

  const { data: memo } = useSuspenseQuery(useGetMemoQueryOptions({ memoId }));

  if (memo.todoCount === 0) {
    return <MemoSummary.NoTodos />;
  }

  return (
    <VStack gap={8}>
      <Row label={t('summary.todos')} value={memo.todoCount} />
      <Row label={t('summary.done')} value={memo.doneCount} />
    </VStack>
  );
};
```

**`ProductList`: 목록은 `filters`·`orderBy`·`limit`를 받고, 행은 부모가 만든 값을 받는다.**

```tsx
export function CategoryList({ filters, orderBy = 'position', limit }: CategoryListProps) {
  const [selectedId, setSelectedId] = useSelectedCategoryId();

  const { data: categories } = useSuspenseQuery(
    useGetCategoriesQueryOptions({ filters, orderBy, limit }),
  );

  return categories.map((category) => (
    <CategoryList.Item
      key={category.id}
      category={category}
      isSelected={category.id === selectedId}
      onSelect={setSelectedId}
    />
  ));
}
```

- 인터페이스는 실제로 쓰는 곳이 있을 때만 둔다. 거르기·정렬은 쿼리 `select`가 하고 타입은 모델의 `FilterX`·`OrderByX`다.
- 행은 route 훅을 부르지 않는다. 부모가 한 번 읽어 `isSelected` 같은 파생 값과 같은 핸들러를 넘긴다.
- 원본을 넘기기만 하는 `X.Item = (props) => <UserList.Item {...props} />`을 만들지 않는다. 같은 fallback은 `X.Error = UserList.Error`로 잇는다.

## 네임스페이스·반복 UI·추출

- 부모 없이 의미 없는 조각은 **무엇이든** 부모 파일 아래 `Parent.Part`로 둔다. `.Loading`·`.Error`·`.Empty`·`.Item`·`.Contents`만이 아니다: `PlanSummary.Quota`, `DailyForecast.TemperatureBar`, `TodoCommentThreadList.SortBar`, `VoiceNoteRecorder.Controls`. 부모를 지우면 함께 지워지고, 이름이 부모와의 결합을 알린다.
- 형태는 `X.Part = function Part() {}`다(`Object.assign` 금지). 부속에 또 `.Loading`을 달면 TS가 `X.Part.Loading`을 모르므로 그 부속만 함수 선언을 대입한다(`SettingsListGroup.Item`, `ListRow.Texts`). 쓰지 않는 부속은 만들지 않고, `.Loading`이 있으면 `.Error`도 짝으로 둔다. 예외로 route 시트는 `RouteBottomSheet`가 오류·문의를 그리므로 `.Error`를 두지 않는다. `.Contents`는 null을 좁혀 받는 조각에만 쓴다.
- 같은 모양으로 반복되는 **고정** UI는 역할이 드러나는 지역 컴포넌트로 추상화한다. 이름은 자유다(`Fact`, `Row`, `Message`, `Stat`). 항목마다 **한 줄씩** 쓰고 설정 배열을 `.map`하지 않는다. "이 항목만 강조·숨김" 같은 기획 수정이 그 한 줄에서 끝난다.

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

- `.map`·`FlashList`는 서버에서 오는 데이터 목록에만 쓴다. 개수가 고정된 반복(스켈레톤, `InputOTP.Slot`)은 es-toolkit `range(n).map`이다.
- **추출은 추상화가 아니다.** JSX를 다른 파일로 옮기기만 하면 변경 이유는 줄지 않고 읽는 사람만 오간다. 파일이 길다고 나누지 않고, 책임이 여럿이면 같은 파일 안에서 지역 컴포넌트·지역 훅·네임스페이스로 나눈다.
- 둘 곳: 한 곳만 쓰면 그 파일 아래 지역 컴포넌트, 부모 없이 의미 없으면 `Parent.Part`, 같은 기능 두 곳 이상이면 `components/`의 독립 파일, 두 기능 이상이고 도메인 뜻이 없으면 `shared/ui`([새 부품](./ui-catalog.md#새-부품-추가))다.
- **위치 이름 금지.** `*Section`, `*Detail`, `*Content`, `*Panel`, `*Area`, `*Info`, `*Body`, `*Frame`, `*Wrapper`, `*Inner`, 단독 `*Header`·`*Footer`. 원본 이름을 접미사로 쓰는 확장(`HintPopoverContent`, `MenuContent`)과 부모 아래 부속(`TodoCommentThreadList.Header`)은 이름이 역할을 말하므로 쓴다.

## 컴포넌트 계약

- **데이터는 쓰는 컴포넌트가 조회한다.** 화면이 조회해 내리면 경계를 블록 단위로 나눌 수 없다. 지역 부속에 좁힌 값을 넘기는 것은 괜찮다(`MemoList.Item`의 `memo`).
- **화면 id는 route 튜플 훅에서 읽는다**(`const [todoId] = useTodoId()`). id·search param을 Props로 내리지 않는다. 예외는 목록 행의 id다.
- **바깥 여백을 모른다.** 루트에 margin·폭·위치를 두지 않는다. 자기 모양(`rounded-2xl bg-gray-1`)과 안쪽 여백만 컴포넌트 몫이고, 바깥 간격은 스크린의 `Spacing`이다.
- 행의 현재 값은 값만 그리는 컴포넌트가 자기 경계(`fallback={null}`)로 읽는다(`FriendCountValue`). 자리는 같고 구현이 갈리면 `mode` 대신 컴포넌트를 prop으로 넘긴다(`toolbar={MemoEditor.StackToolbar}`).
- 배타 상태는 `match(…).exhaustive()`, 단순 표시는 `&&`다. 저장 진행은 mutation `isPending`을 `Button`의 `isLoading`에 넘긴다. 변환은 es-toolkit(`groupBy`, `partition`, `sumBy`)으로 view-model 순수 함수에 둔다.
- 메모는 React Compiler가 한다. 새 코드에 `useMemo`·`useCallback`·`memo`를 더하지 않는다. 있는 직접 메모는 일괄 삭제하지 않고 손대는 파일에서 필요 없는 것만 지운다(가상 목록·캘린더 칸의 `memo`처럼 이유가 있으면 둔다).
- 색은 토큰 클래스만 쓴다. 조건부 className은 `cn`, 변형이 둘 이상이면 `tv`(`*.variants.ts`)다. 템플릿 리터럴·삼항으로 문자열을 잇지 않는다. 인라인 `style`은 동적 값(잰 크기, 애니메이션 스타일, 계산한 inset)에만 쓴다.

## 스크린

```tsx
export default function NotificationsScreen() {
  const [direction] = useNotificationDirection();

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['left', 'right', 'bottom']}>
      {match(direction)
        .with('received', () => (
          <QueryErrorBoundary fallback={NotificationList.Error}>
            <Suspense fallback={<NotificationList.Loading />}>
              <NotificationList />
            </Suspense>
          </QueryErrorBoundary>
        ))
        .with('sent', () => (
          <QueryErrorBoundary fallback={SentNudgeList.Error}>
            <Suspense fallback={<SentNudgeList.Loading />}>
              <SentNudgeList />
            </Suspense>
          </QueryErrorBoundary>
        ))
        .exhaustive()}
    </StyledSafeAreaView>
  );
}
```

- 위에서 아래로 읽힌다. 순서·간격·화면 문구·경계가 스크린 파일에 보이고, 줄이 길어도 쪼개지 않는다. 화면·구역 제목과 안내 문구도 스크린에 적는다.
- 블록마다 `QueryErrorBoundary` → `Suspense fallback={<X.Loading />}` → `<X />`를 나열한다. fallback은 `fallback={X.Error}`이고 화살표로 감싸지 않는다(닫기 핸들러가 필요한 시트 안 경계만 `(props) => <X.Error {...props} onInquiry={…} />`).
- 상태별 화면은 `match(view).with(…).exhaustive()`로 스크린에서 고른다. 넘기기용 래퍼(`Content → Header → Section`), 재수출한 화면, JSX 상수(`const waveform = …`)를 만들지 않는다.
- 한 쿼리를 두 경계에서 읽지 않는다(한 오류는 한 곳). 로딩·오류·빈·데이터 4상태를 그린다. route 파일은 params 검증과 경계만 맡는다([state-and-routing](./state-and-routing.md#params-튜플)).
- 스스로 숨는 블록은 간격도 함께 사라진다. 조건을 스크린이 알면 `{isAvailable && (…)}` 안에 `Spacing`과 블록을 함께 두고, 조회해야 아는 카드만 `className`으로 바깥 여백을 받는다.

## 코드 배치

1. **컴포넌트 몸체.** `t`·DI → route params → 쿼리·prefetch → 지역 상태·ref → mutation·동작 훅 → 파생 값 → effect → 조기 반환 → 핸들러 → JSX. 그룹 사이에 빈 줄 하나, 그룹 안에는 두지 않는다. 데이터 의존으로 순서를 바꾸면 주석을 단다.
2. **스크린 JSX.** 형제 구역은 빈 줄로 나눈다. 세로 간격은 `<Spacing>`만 쓰고 위아래에 빈 줄을 둔다. 블록에 `mb`·`pb`를 주지 않는다(스스로 숨는 카드는 예외).
3. **여백 표기.** 레이아웃 prop(`p`, `gap`)과 `className` 여백을 한 태그에, 한 파일의 형제끼리 섞지 않는다.
4. **파일 순서.** 상수·타입 → 기본 export → 네임스페이스 부속 → `.Loading` → `.Error` → `.Empty` → 지역 컴포넌트 → 지역 훅 → 순수 helper.

## 사용성 (구조보다 먼저)

| 상황                 | 기대                            | 쓰는 것                                                                                              |
| -------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 입력칸을 누름        | 칸·오류 문구가 키보드 위에 보임 | 화면 폼 `FormStepLayout`·`FormScrollView`, 시트 `KeyboardBottomSheet`, 편집기 `KeyboardAvoidingView` |
| 저장 버튼            | 키보드에 가리지 않음            | `KeyboardAdaptiveButton`, 시트 `footer`                                                              |
| 키보드가 열린 채 탭  | 첫 탭에 동작                    | `keyboardShouldPersistTaps="handled"`, 입력을 이어 가는 칩 줄·시트·댓글은 `"always"`                 |
| 키보드 위치          | 실제 키보드와 같이 움직임       | `react-native-keyboard-controller`. `Keyboard.addListener` 타이밍으로 흉내 내지 않는다               |
| 다음·완료 키, 입력값 | 다음 칸·제출, 맞는 키보드       | `returnKeyType`, `onSubmitEditing`, `setFocus`, `keyboardType`, `textContentType`                    |
| 검증·저장 실패       | 틀린 칸 포커스, 글자 유지       | `Controller`의 `field.ref`, `isPending`, 초안                                                        |
| 뒤로 가기            | 작성 중 글자를 잃지 않음        | 초안 또는 확인 다이얼로그                                                                            |
| 큰 글꼴·작은 화면    | 주 버튼에 닿음, 짧은 라벨 한 줄 | 스크롤 틀, 고정 높이 컨트롤, `numberOfLines`                                                         |

구조를 고치다 사용성이 나빠지면 구조를 양보한다.

## 레이아웃 시프트·워터폴·목록

- `X.Loading`은 받은 뒤와 같은 슬롯·높이다. 글자는 `TextSkeleton size`, 행 글자는 `ListRow.Texts.Loading`이고, 데이터로 생기는 줄(설명·하위 항목)은 그리지 않는다.
- 받은 뒤 나타나는 버튼·배너는 자리를 먼저 비운다. 대부분 안 보이는 블록만 `fallback={null}`이고 이유를 주석으로 남긴다. 남의 높이를 매직 넘버로 복제하지 않는다(재야 하면 `useLayoutSize()`). 이미지는 `AspectRatio`, 오류 문구는 `preserveErrorSpace`다.
- 데이터가 있으면 재조회 중에 fallback으로 바꾸지 않는다. 부품을 바꾸면 전후를 겹쳐 비교하고 다르면 바꾸지 않는다.
- **워터폴.** 한 컴포넌트의 독립 조회는 `useSuspenseQueries({ queries: [a, b] })`로 함께 건다. `useSuspenseQuery`를 차례로 부르면 둘째는 첫 응답 뒤에 나간다. 훅 안에 Suspense 조회를 숨기지 않는다.
- **목록.** 서버 커서 목록은 `InfiniteList`(FlashList v2: 하단 로딩·재시도·중복 호출 방지·당겨서 새로고침), 길이가 정해지지 않은 서버 목록은 `FlashList`, 상수로 개수가 묶인 서버 목록은 `.map`, 고정 개수 스켈레톤은 `range(n).map`이다. 길이 제한 없는 `.map`은 쓰지 않는다.
- 날짜 구역 나누기는 쿼리 `select`다. 머리말·꼬리말(카드·정렬 바)은 `ListHeaderComponent`·`ListFooterComponent`에 직접 적는다(목록 밖으로 옮기면 스크롤과 첫 위치가 바뀐다). 긴 안내 글은 `WordWrapText`, 가상 목록 행은 `lineBreakStrategyIOS="hangul-word"`다.

## 글꼴과 기기

- **글꼴.** 단계·OS 배율·크기 토큰은 [design](../design.md#글꼴)이 원본이다(앱 5단계, `allowFontScaling: false`). `HeroUIProvider`가 heroui 글자에도 배율을 끈다. 크기는 `Text size` 토큰, 아이콘·고정 크기는 `useFontScaledSize()`, 스켈레톤은 `TextSkeleton size`다.
- 높이가 정해진 컨트롤(버튼·칩·탭)은 고정 높이와 좌우 padding이다. 짧은 라벨은 작은 iPhone 최대 단계에서 ko·en 모두 한 줄이다. 바뀌는 숫자는 `tabular-nums`다.
- **기기.** iPhone, iPad, 폴더블(접음·펼침), iPhone Duo, Android 휴대폰·태블릿을 지원한다. 칸 수는 사이드바·레일 inset을 뺀 탭 안 내용 폭(Android는 시스템 바·컷아웃 inset을 빼지 않은 폭) `usePaneSizeClass()`(`compact`·`medium`·`expanded`), 창 전체 정책(방향·시트 배치)은 `useWindowSizeClass()`로 정한다. 기기 이름·힌지로 나누지 않는다.
- 2열은 `AdaptivePane` 하나라 접고 펴도 다시 마운트되지 않는다. 폭마다 다시 만드는 무거운 부품은 `useDeferredValue`로 늦춘다. 배치 규칙(짧은 창, 방향 잠금, 칸 나누기, 접힘선)은 `shared/domains/window-layout.model.ts`의 `WindowLayoutPolicy`다. Mac(Designed for iPad)은 늘 `compact`다.
- 플랫폼 분기는 `process.env.EXPO_OS`다(번들에서 다른 플랫폼 코드가 빠진다).
- Duo 세로 레일(84pt)은 safe area로 피한다. 탭 Stack 페이지 스크롤은 `SafeAreaScrollView`, 고정 헤더·하단 버튼·가상 목록 화면은 루트 `edges`에 `left`·`right`를 더한다. 같은 축을 두 번 감싸지 않는다. 헤더는 네이티브 Stack 헤더와 `Stack.Toolbar`만 쓴다.

## 모션과 Skia

- Reanimated 4 `.get()`·`.set()`을 쓰고 transform·opacity만 움직인다(`width`·`height` 금지). 예외는 피드 달력의 주↔월 높이(`CalendarHeightTransition`) 하나다: 아래 피드가 접히는 달력을 따라 올라가야 해 transform으로는 같은 모양을 낼 수 없어 높이만 UI 스레드에서 움직이고, 내용 폭은 안쪽에서 재어 전환 중 다시 재지 않는다. ease-out, 시간은 `ANIMATION` 상수다. 탭 전환은 애니메이션하지 않는다. 모션 줄이기는 `reduceMotion: ReduceMotion.System`이고 반복·강조 모션은 `useIsReduceMotionEnabled()`면 생략한다. 누름은 heroui `PressableFeedback`, 햅틱은 `useHaptics()` 한 번이다.

1. **만들기.** `RuntimeEffect`·고정 `Path`·`Picture`는 모듈 수준이나 입력이 같으면 다시 만들지 않는 메모로 만든다. 렌더·프레임마다 `Skia.*.Make`하지 않는다.
2. **정리.** `SkPath`·`SkImage`·텍스처는 만든 effect의 정리 함수에서 `dispose`한다. 교체할 때는 앞의 것을 먼저 `dispose`한다. 값이 바뀔 때마다 다시 그리는 경로는 voice `useRebuiltPath(read, draw)`(빌더 하나를 되쓰고 앞 경로를 바로 `dispose`)로 만들고, 경로에 넣는 사각형은 `Skia.XYWHRect`·`RRectXY` 대신 같은 모양의 평범한 객체(`toRoundedBar`)로 넘긴다. `useRebuiltPath`는 빌더를 렌더 메모로 만들고 언마운트 정리에서 놓아, effect만 다시 도는 환경(StrictMode, expo-router `activityEnabled`의 React Activity)에서는 놓은 빌더를 다시 쓴다. 앱은 둘 다 쓰지 않는다. 켜려면 먼저 빌더·경로를 effect 안에서 만들고 기기에서 메모리 그래프를 확인한다.
3. **프레임 작업.** worklet의 shared·derived value로만 한다. 프레임마다 React 상태를 바꾸거나 JS로 건너가지 않는다(`scheduleOnRN`은 이벤트만). 파티클 배열은 미리 만든다.
4. **멈춤 조건 하나.** 꾸밈 프레임 콜백·`withRepeat`는 `useIsAnimationActive()`(화면 포커스 + 앱 앞 + 모션 줄이기)로 켜고 끈다. 값을 모으는 프레임 콜백·재생 위치는 투명 시트·제어 센터(`inactive`)에도 이어져야 해서 `useIsAppInBackground()`일 때만 멈춘다.
5. **크기.** Skia 2.14의 `Canvas onSize`는 멈출 수 없는 프레임 콜백으로 매 프레임 잰다. 감싼 View의 `onLayout`에서 shared value로 `set`한다(JS 값이 필요하면 `useLayoutSize`). `onSize`는 이미 프레임마다 그리는 Canvas에서만 쓴다.
6. **품질.** 기기 메모리 품질 단계를 지키고 저사양 Android는 `*_PARTICLE_COUNT_BY_TIER` 상수로 줄인다.
7. **값.** 애니메이션 값도 `.get()`·`.set()`이다. `.value`를 쓰지 않는다.

측정: 날씨(비·눈·번개·밤하늘)와 음성 시각화를 iPhone·저사양 Android에서 30초 돌려 프레임 드롭률을 Before/After로 센다. 20번 열고 닫은 뒤 메모리가 돌아오는지, 앱을 뒤로 보내면 프레임 콜백이 0인지 본다.

## 확인

- 화면 PR마다 Maestro Before/After를 찍는다: 라이트·다크 × 글꼴 최소·기본·최대 × ko·en × 작은 iPhone·iPad·폴더블. 로딩 중과 완료 후를 같은 자리에서 찍어 위치를 비교한다.
- 주요 흐름, 실패와 재시도, 키보드, 뒤로 가기는 직접 해 보고 한 것과 못 한 것을 나눠 보고한다. 누름 동작은 기기에서도 확인한다.
