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
  // src/features/planning/todo/components/todo-list/todo-actions-bottom-sheet.tsx(더보기)
  todo: {
    addButton: (categoryId) => 'todo-add-' + categoryId,
    addSheet: 'todo-add-sheet',
    titleInput: 'todo-add-title-input',
    submitButton: 'todo-add-submit',
    checkbox: (todoId) => 'todo-checkbox-' + todoId,
    moreButton: (todoId) => 'todo-more-' + todoId,
    deleteAction: 'todo-action-delete',
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
  // src/features/insights/report/components/report-list.tsx(report.card.viewDetail, src/shared/i18n/locales/*/ai.json)
  report: {
    viewDetail: '자세히 보기|View details',
  },
};
