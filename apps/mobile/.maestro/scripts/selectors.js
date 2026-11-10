// 흐름이 찾는 화면 요소의 단 하나의 원천. 화면이 바뀌면 이 파일(또는 subflow)만 고친다.
// id는 앱 testID(`<feature>-<element>[-<action>]`)이고, testID를 받지 않는 네이티브 헤더 버튼만 접근성 라벨(ko|en)로 찾는다.
// docs: https://docs.maestro.dev/get-started/supported-platform/react-native

output.ids = {
  app: {
    rootError: 'root-error-fallback',
    offlineBanner: 'offline-banner',
    queryErrorRetry: 'query-error-retry',
  },
  auth: {
    emailEntry: 'login-email-entry',
    emailInput: 'email-login-email',
    passwordInput: 'email-login-password',
    submitButton: 'email-login-submit',
  },
  feed: {
    screen: 'feed-screen',
  },
  todo: {
    addButton: (categoryId) => 'todo-add-' + categoryId,
    addSheet: 'todo-add-sheet',
    titleInput: 'todo-add-title-input',
    submitButton: 'todo-add-submit',
    checkbox: (todoId) => 'todo-checkbox-' + todoId,
    moreButton: (todoId) => 'todo-more-' + todoId,
    deleteAction: 'todo-action-delete',
  },
  category: {
    deleteButton: (categoryId) => 'category-delete-' + categoryId,
    moveTarget: (categoryId) => 'category-delete-move-target-' + categoryId,
    deleteWithTodosOption: 'category-delete-with-todos',
    confirmButton: 'category-delete-confirm',
  },
  memo: {
    createButton: 'memo-create-button',
    createInput: 'memo-create-input',
    editorInput: 'memo-editor-input',
    item: (memoId) => 'memo-item-' + memoId,
  },
  notification: {
    inbox: 'notification-inbox',
    item: (type) => 'notification-item-' + type,
  },
  invite: {
    codeInput: 'invite-code-input',
    codeSubmit: 'invite-code-submit',
    redeemButton: 'invite-card-redeem',
    welcomeSheet: 'invite-welcome-sheet',
    welcomeLater: 'invite-welcome-later',
  },
  subscription: {
    paywall: 'subscription-paywall',
  },
};

output.labels = {
  close: '닫기|Close',
  save: '저장|Save',
};
