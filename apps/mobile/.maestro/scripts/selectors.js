// 흐름이 찾는 화면 요소의 단 하나의 원천(Maestro runScript, GraalJS). 앱의 testID·문구가 바뀌면 이 파일만 고친다.
// ids는 앱 testID(`<feature>-<element>[-<action>]`)이고 묶음 이름은 앱 기능 이름이다. 목록 행처럼 id가 붙는 것은 함수다.
// labels는 testID를 받지 않는 네이티브 헤더 버튼·시스템 창·다른 앱의 글자(ko|en 정규식)다.
// 묶음 위 주석은 그 testID·문구가 사는 앱 파일이다(apps/mobile 기준).
// docs: https://docs.maestro.dev/get-started/supported-platform/react-native

output.ids = {
  // src/shared/ui/hint-popover/hint-popover.tsx
  hint: {
    popover: 'hint-popover',
    close: 'hint-popover-close',
  },
  // app/_layout.tsx, src/shared/ui/offline-banner/offline-banner.tsx,
  // src/shared/ui/query-error-boundary/query-error-fallback.tsx
  app: {
    rootError: 'root-error-fallback',
    offlineBanner: 'offline-banner',
    queryErrorRetry: 'query-error-retry',
  },
  // app/(auth)/login.tsx, app/(auth)/email-login.tsx
  auth: {
    emailEntry: 'login-email-entry',
    emailInput: 'email-login-email',
    passwordInput: 'email-login-password',
    submitButton: 'email-login-submit',
  },
  // app/(app)/(tabs)/(todos)/feed/index.tsx
  feed: {
    screen: 'feed-screen',
  },
  // app/(app)/whats-new/index.tsx
  whatsNew: {
    screen: 'whats-new-screen',
  },
  // src/features/planning/todo/components/todo-list/todo-list.tsx(행·추가),
  // src/features/planning/composer/components/todo-create-bottom-sheet.tsx(추가 시트),
  // src/features/planning/todo/components/todo-list/todo-actions-bottom-sheet.tsx(더보기),
  // app/(app)/todo/[todoId]/index.tsx(상세)
  todo: {
    addButton: (categoryId) => 'todo-add-' + categoryId,
    addSheet: 'todo-add-sheet',
    titleInput: 'todo-add-title-input',
    submitButton: 'todo-add-submit',
    checkbox: (todoId) => 'todo-checkbox-' + todoId,
    moreButton: (todoId) => 'todo-more-' + todoId,
    deleteAction: 'todo-action-delete',
    detail: 'todo-detail',
  },
  // src/features/engagement/comment/components/todo-comment-form.tsx(작성 칸은 이어 쓰기 순서마다 index),
  // src/features/engagement/comment/components/todo-comment-item.tsx(본문·좋아요)
  comment: {
    input: (index) => 'todo-comment-input-' + index,
    submitButton: 'todo-comment-submit',
    body: (commentId) => 'todo-comment-body-' + commentId,
    likeButton: (commentId) => 'todo-comment-like-' + commentId,
  },
  // src/features/planning/category/components/category-list.tsx(삭제 버튼),
  // src/features/planning/category/components/category-delete-bottom-sheet.tsx(삭제 시트),
  // src/features/planning/category/components/category-pick-form.tsx(옮길 카테고리 고르기)
  category: {
    deleteButton: (categoryId) => 'category-delete-' + categoryId,
    deleteSheet: 'category-delete-sheet',
    handlingOption: (todoHandling) => 'category-delete-handling-' + todoHandling,
    moveTargetRow: 'category-delete-move-target',
    submitButton: 'category-delete-submit',
    pickOption: (categoryId) => 'category-select-option-' + categoryId,
    pickSubmit: 'category-select-submit',
  },
  // src/features/notes/memo/components/memo-create-button.tsx, app/(app)/memo/create.tsx,
  // src/features/notes/memo/components/memo-editor.tsx, src/features/notes/memo/components/memo-list.tsx
  memo: {
    createButton: 'memo-create-button',
    createInput: 'memo-create-input',
    editorInput: 'memo-editor-input',
    item: (memoId) => 'memo-item-' + memoId,
  },
  // app/(app)/onboarding/notifications.tsx, app/(app)/(tabs)/(me,memos,todos)/notifications/index.tsx,
  // src/features/notification/components/notification-list.tsx(행, 알림 type마다)
  notification: {
    onboardingScreen: 'push-onboarding-screen',
    inbox: 'notification-inbox',
    item: (type) => 'notification-item-' + type,
  },
  // app/(app)/(tabs)/(me,memos,todos)/friends/add.tsx
  friend: {
    tagInput: 'friend-tag-input',
    tagSubmit: 'friend-tag-submit',
  },
  // app/invite/index.tsx, src/features/social/invite/components/invite-card-actions.tsx,
  // src/features/social/invite/components/invite-welcome-bottom-sheet.tsx
  invite: {
    codeInput: 'invite-code-input',
    codeSubmit: 'invite-code-submit',
    redeemButton: 'invite-card-redeem',
    welcomeSheet: 'invite-welcome-sheet',
    welcomeOpenFriendFeed: 'invite-welcome-open-friend-feed',
  },
  // src/bootstrap/navigation/subscription-checkout.tsx
  subscription: {
    paywall: 'subscription-paywall',
  },
  // src/features/insights/report/components/report-list.tsx, activity-report.tsx, sample-activity-report.tsx,
  // app/(app)/(tabs)/(me,memos,todos)/reports/sample.tsx
  report: {
    thisWeekRecord: 'report-this-week-record',
    summary: 'report-summary',
    freeSubscribe: 'report-free-subscribe',
    sampleLatest: 'report-sample-latest',
    sampleNotice: 'report-sample-notice',
    sampleSubscribe: 'report-sample-subscribe',
  },
};

output.labels = {
  // 네이티브 헤더 툴바 버튼(testID를 받지 않는다). src/shared/i18n/locales/*/common.json actions
  header: {
    close: '닫기|Close',
    save: '저장|Save',
  },
  // iOS 시스템 창. 개발 빌드 오류 창(LogBox)은 화면을 덮어도 뒤 요소가 보여 id 확인만으로는 오류를 놓친다
  system: {
    savePasswordNotNow: '지금 안 함|Not Now',
    devErrorOverlay: 'Uncaught Error|Render Error',
  },
  // mutation 실패 토스트. src/shared/errors/infra-error.ts NetworkError → src/shared/i18n/locales/*/common.json infraErrors.network
  app: {
    networkError: '인터넷 연결을 확인해주세요|Please check your internet connection',
  },
  // src/shared/i18n/locales/*/errors.json FOLLOW_0901(같은 친구 요청을 두 번 보냈을 때의 토스트)
  friend: {
    alreadyRequested: '이미 친구 요청을 보냈어요|Friend request already sent',
  },
  // iOS 캘린더 앱(com.apple.mobilecal). 가져오기 흐름이 기기에 일정을 심을 때만 쓴다
  iosCalendar: {
    appId: 'com.apple.mobilecal',
    welcomeContinue: 'Continue|계속',
    addButton: 'Add|추가',
    titleField: 'Title|제목',
  },
  // app/(app)/(tabs)/(me,memos,todos)/todo-import/index.tsx·[importId].tsx, src/shared/i18n/locales/*/todo-import.json.
  // 가져오기 화면에는 testID가 없어 단계 제목·버튼 글자로 찾는다(README "앱에 더할 testID")
  todoImport: {
    calendarsTitle: '가져올 캘린더를 골라주세요|Choose calendars to import',
    categoriesTitle: '어디에 넣을까요\\?|Where should they go\\?',
    optionsTitle: '마지막으로 확인해주세요|One last check',
    // common.json actions.continue. 캘린더·넣을 곳 단계의 아래 버튼
    nextButton: '다음|Continue',
    importButton: '가져오기|Import',
    completedTitle: '할 일 \\d+개를 가져왔어요|Imported \\d+ to-dos?',
    undoButton: '되돌리기|Undo',
    undoConfirmTitle: '가져온 할 일을 되돌릴까요\\?|Undo this import\\?',
    cancelButton: '취소|Cancel',
    undoneTitle: '할 일 \\d+개를 되돌렸어요|Removed \\d+ imported to-dos?',
    permissionDeniedTitle: '캘린더 접근이 꺼져 있어요|Calendar access is off',
    permissionContinue: '계속|Continue',
    openSettings: '설정 열기|Open Settings',
  },
  // src/features/weather/components/weather-hero.tsx(hero.summary 접근성 라벨 "곳, 지금 기온, 날씨"),
  // src/features/weather/components/weather-location-prompt.tsx, src/shared/i18n/locales/*/weather.json
  weather: {
    heroSummary: '.+, 지금 .+, .+|.+, .+ now, .+',
    locationAskTitle: '지금 있는 곳 날씨를 보여드릴게요|See your local weather',
    locationDeniedTitle: '설정에서 위치를 켜주세요|Turn on location in Settings',
    continueButton: '계속|Continue',
    openSettings: '설정 열기|Open Settings',
  },
  // src/features/insights/report/components/report-list.tsx(report.card.viewDetail, src/shared/i18n/locales/*/ai.json)
  report: {
    viewDetail: '자세히 보기|View details',
  },
};
