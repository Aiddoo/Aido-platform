// 흐름이 개발 서버에 데이터를 준비·확인·정리할 때 쓰는 HTTP 도우미. config.js 다음에 실행한다.
// 흐름은 `output.main = output.api.signIn('main')`으로 세션을 얻고 세션의 메서드를 evalScript 한 줄로 부른다.
// docs: https://docs.maestro.dev/maestro-flows/javascript/make-http-requests
//       https://docs.maestro.dev/maestro-flows/javascript/manage-data-and-states

const E2E_PREFIX = 'E2E ';
const POLL_INTERVAL_MS = 300;
const POLL_TIMEOUT_MS = 15000;
const BODYLESS_METHODS = ['GET', 'DELETE'];

// Maestro http는 POST·PUT·PATCH에 본문이 없으면 보내지 않는다
function requestBody(method, body) {
  if (body !== undefined) {
    return JSON.stringify(body);
  }
  return BODYLESS_METHODS.includes(method) ? undefined : '{}';
}

function call(method, path, token, body, allowedStatuses) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }
  const response = http.request(output.config.apiUrl + path, {
    method: method,
    headers: headers,
    body: requestBody(method, body),
  });
  if (!response.ok && !(allowedStatuses || []).includes(response.status)) {
    throw new Error(method + ' ' + path + ' 가 ' + response.status + '로 응답했습니다.');
  }
  return response.ok && response.body ? json(response.body).data : null;
}

// 화면 동작이 서버에 닿거나 알림 큐가 돌 때까지 기다린다. 샌드박스에 타이머가 없어 간격은 바쁜 대기다
function poll(read, description) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    const value = read();
    if (value) {
      return value;
    }
    if (Date.now() > deadline) {
      throw new Error(description + '을(를) ' + POLL_TIMEOUT_MS + 'ms 안에 확인하지 못했습니다.');
    }
    const next = Date.now() + POLL_INTERVAL_MS;
    while (Date.now() < next) {
      // 다음 요청까지 기다린다
    }
  }
}

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return now.getFullYear() + '-' + month + '-' + day;
}

function signIn(role) {
  const account = output.config.accounts[role];
  if (account == null) {
    throw new Error(role + ' 계정이 없습니다. pnpm e2e:accounts create로 .env.maestro를 채우세요.');
  }
  const token = call('POST', '/v1/auth/login', null, {
    email: account.email,
    password: account.password,
    deviceName: 'maestro',
    deviceType: maestro.platform === 'android' ? 'ANDROID' : 'IOS',
  }).accessToken;
  const me = call('GET', '/v1/auth/me', token);

  const categories = () => call('GET', '/v1/todo-categories', token).items;
  const todosIn = (categoryId) =>
    call('GET', '/v1/todos?size=200&categoryId=' + categoryId, token).items;
  const memosContaining = (text) =>
    call('GET', '/v1/memos?size=50', token).items.filter((memo) => memo.content.includes(text));
  const inbox = () => call('GET', '/v1/notifications/inbox', token).notifications;

  return {
    email: account.email,
    password: account.password,
    userId: me.userId,
    userTag: me.userTag,
    name: me.name || account.name,
    subscriptionStatus: () => call('GET', '/v1/auth/me', token).subscriptionStatus,

    // 무료 한도(3개)가 기본 카테고리 2개 + 흐름이 만드는 1개라, 지난 실행이 남긴 E2E 카테고리를 먼저 치운다
    removeE2eCategories: () =>
      categories()
        .filter((category) => category.name.startsWith(E2E_PREFIX))
        .forEach((category) => {
          todosIn(category.id).forEach((todo) =>
            call('DELETE', '/v1/todos/' + todo.id, token, undefined, [404]),
          );
          call('DELETE', '/v1/todo-categories/' + category.id, token, undefined, [404]);
        }),
    createCategory: (label) =>
      call('POST', '/v1/todo-categories', token, { name: E2E_PREFIX + label, color: '#FFB3B3' })
        .category,
    firstDefaultCategory: () =>
      categories().find((category) => !category.name.startsWith(E2E_PREFIX)),
    hasCategory: (categoryId) => categories().some((category) => category.id === categoryId),

    createTodo: (categoryId, title) =>
      call('POST', '/v1/todos', token, {
        title: title,
        categoryId: categoryId,
        startDate: todayKey(),
      }).todo,
    hasTodoIn: (categoryId, todoId) => todosIn(categoryId).some((todo) => todo.id === todoId),
    waitForTodo: (categoryId, title, isCompleted) =>
      poll(
        () =>
          todosIn(categoryId).find(
            (todo) => todo.title === title && todo.completed === isCompleted,
          ) || null,
        '할 일 "' + title + '"',
      ),
    waitForTodoGone: (categoryId, title) =>
      poll(
        () => !todosIn(categoryId).some((todo) => todo.title === title),
        '지운 할 일 "' + title + '"',
      ),
    todoExists: (todoId) => call('GET', '/v1/todos/' + todoId, token, undefined, [404]) != null,
    deleteTodo: (todoId) => call('DELETE', '/v1/todos/' + todoId, token, undefined, [404]),

    waitForMemo: (text) => poll(() => memosContaining(text)[0] || null, '메모 "' + text + '"'),
    deleteMemosContaining: (text) =>
      memosContaining(text).forEach((memo) =>
        call('DELETE', '/v1/memos/' + memo.id, token, undefined, [404]),
      ),

    waitForNotification: (type) =>
      poll(
        () =>
          inbox().find((notification) => notification.type === type && !notification.isRead) ||
          null,
        '읽지 않은 ' + type + ' 알림',
      ),
    isNotificationRead: (notificationId) =>
      inbox().some((notification) => notification.id === notificationId && notification.isRead),

    inviteCode: () => call('GET', '/v1/invites/me', token).code,
    hasInvited: (userId) =>
      call('GET', '/v1/invites/me/invitees', token).items.some((item) => item.userId === userId),
    isFriendOf: (userId) =>
      call('GET', '/v1/follows/friends', token).friends.some((friend) => friend.id === userId),
    requestFriend: (userTag) => call('POST', '/v1/follows/' + userTag, token),
    acceptFriend: (userId) => call('PATCH', '/v1/follows/' + userId + '/accept', token),
    // 친구 끊기와 보낸 요청 취소가 같은 경로다. 이미 없으면 404라 정리에서 그대로 넘긴다
    unfollow: (userId) => call('DELETE', '/v1/follows/' + userId, token, undefined, [404]),
  };
}

output.api = { signIn: signIn };
