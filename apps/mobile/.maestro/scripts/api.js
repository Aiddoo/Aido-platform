// 흐름이 개발 서버에 데이터를 준비·확인·정리할 때 쓰는 HTTP 도우미(Maestro runScript, GraalJS). config.js 다음에 실행한다.
// 흐름은 `output.main = output.api.signIn('main')`으로 세션을 얻고 세션의 메서드를 evalScript 한 줄로 부른다.
// 이름 규칙: 준비는 create*·send*·accept*·complete*, 정리는 remove*(없으면 넘긴다), 조회는 find*,
// 참·거짓 확인은 has*·is*, 개수는 count*, 서버 반영을 기다리면 waitFor*(못 찾으면 무엇을 기다렸는지 말하며 실패한다).
// Node 도구(accounts.ts)와 store-screenshots/scripts/lib.js도 로그인·로컬 주소 확인을 따로 갖는다. 런타임(Node·GraalJS)과
// 계정·앱(개발 빌드·Release 캡처)이 달라 한 파일로 모을 수 없다.
// docs: https://docs.maestro.dev/maestro-flows/javascript/make-http-requests
//       https://docs.maestro.dev/maestro-flows/javascript/manage-data-and-states

const E2E_PREFIX = 'E2E ';
const POLL_INTERVAL_MS = 300;
const POLL_TIMEOUT_MS = 15000;
const BODYLESS_METHODS = new Set(['GET', 'DELETE']);

// Maestro http는 POST·PUT·PATCH에 본문이 없으면 보내지 않는다
function requestBody(method, body) {
  if (body !== undefined) {
    return JSON.stringify(body);
  }
  return BODYLESS_METHODS.has(method) ? undefined : '{}';
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
      throw new Error(
        '서버에서 ' +
          description +
          '을(를) ' +
          POLL_TIMEOUT_MS +
          'ms 동안 기다렸지만 보지 못했습니다.',
      );
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

// 샌드박스에 crypto가 없어 Math.random으로 v4 모양만 맞춘다. 테스트 데이터 멱등 키라 예측 가능해도 된다
function randomUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replaceAll(/[xy]/g, (placeholder) => {
    const nibble = Math.floor(Math.random() * 16);
    return (placeholder === 'x' ? nibble : 8 + (nibble % 4)).toString(16);
  });
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
  // 카테고리를 주지 않으면 모든 카테고리의 할 일이다. 가져오기처럼 넣을 곳을 앱이 정하는 흐름이 쓴다
  const todosTitled = (title) =>
    call('GET', '/v1/todos?size=200', token).items.filter((todo) => todo.title === title);
  const commentsOn = (todoId) =>
    call('GET', '/v2/todos/' + todoId + '/comments', token).items.map((thread) => thread.comment);
  const memosContaining = (text) =>
    call('GET', '/v1/memos?size=50', token).items.filter((memo) => memo.content.includes(text));
  const inbox = () => call('GET', '/v1/notifications/inbox', token).notifications;

  return {
    email: account.email,
    password: account.password,
    userId: me.userId,
    userTag: me.userTag,
    name: me.name || account.name,
    findSubscriptionStatus: () => call('GET', '/v1/auth/me', token).subscriptionStatus,

    // 무료 한도(3개)가 기본 카테고리 2개 + 흐름이 만드는 1개라, 지난 실행이 남긴 E2E 카테고리를 먼저 치운다
    removeE2eCategories: () => {
      const e2eCategories = categories().filter((category) => category.name.startsWith(E2E_PREFIX));
      for (const category of e2eCategories) {
        for (const todo of todosIn(category.id)) {
          call('DELETE', '/v1/todos/' + todo.id, token, undefined, [404]);
        }
        call('DELETE', '/v1/todo-categories/' + category.id, token, undefined, [404]);
      }
    },
    createCategory: (label) =>
      call('POST', '/v1/todo-categories', token, { name: E2E_PREFIX + label, color: '#FFB3B3' })
        .category,
    findDefaultCategory: () =>
      categories().find((category) => !category.name.startsWith(E2E_PREFIX)) || null,
    hasCategory: (categoryId) => categories().some((category) => category.id === categoryId),

    createTodo: (categoryId, title) =>
      call('POST', '/v1/todos', token, {
        title: title,
        categoryId: categoryId,
        startDate: todayKey(),
      }).todo,
    completeTodo: (todoId) =>
      call('PATCH', '/v1/todos/' + todoId + '/complete', token, { completed: true }),
    hasTodo: (todoId) => call('GET', '/v1/todos/' + todoId, token, undefined, [404]) != null,
    hasTodoIn: (categoryId, todoId) => todosIn(categoryId).some((todo) => todo.id === todoId),
    isTodoCompleted: (todoId) => call('GET', '/v1/todos/' + todoId, token).completed,
    // 연타가 같은 할 일을 두 번 만들지 않았는지 본다
    countTodos: (categoryId, title) =>
      todosIn(categoryId).filter((todo) => todo.title === title).length,
    waitForTodo: (categoryId, title, isCompleted) =>
      poll(
        () =>
          todosIn(categoryId).find(
            (todo) => todo.title === title && todo.completed === isCompleted,
          ) || null,
        (isCompleted ? '완료한' : '완료하지 않은') + ' 할 일 "' + title + '"',
      ),
    waitForTodoGone: (categoryId, title) =>
      poll(
        () => !todosIn(categoryId).some((todo) => todo.title === title),
        '할 일 "' + title + '"이 지워진 것',
      ),
    removeTodo: (todoId) => call('DELETE', '/v1/todos/' + todoId, token, undefined, [404]),
    waitForTodoTitled: (title) =>
      poll(() => todosTitled(title)[0] || null, '할 일 "' + title + '"'),
    waitForTodoTitledGone: (title) =>
      poll(() => todosTitled(title).length === 0, '할 일 "' + title + '"이 모두 지워진 것'),
    // 지난 실행이 남긴 같은 접두의 할 일까지 치운다(기기 캘린더 일정은 실행마다 쌓여 다시 가져올 수 있다)
    removeTodosStartingWith: (prefix) => {
      const todos = call('GET', '/v1/todos?size=200', token).items;
      for (const todo of todos.filter((candidate) => candidate.title.startsWith(prefix))) {
        call('DELETE', '/v1/todos/' + todo.id, token, undefined, [404]);
      }
    },

    // 댓글 작성은 글마다 멱등 키(UUID)를 받는다(packages/api/src/contracts/todo-comment/v1/todo-comment.request.ts)
    createComment: (todoId, content) =>
      call('POST', '/v1/todos/' + todoId + '/comments', token, {
        items: [{ clientRequestId: randomUuid(), content: content }],
      }).comments[0],
    waitForComment: (todoId, content) =>
      poll(
        () => commentsOn(todoId).find((comment) => comment.content === content) || null,
        '할 일 ' + todoId + '의 댓글 "' + content + '"',
      ),
    waitForCommentLike: (todoId, commentId, isLiked) =>
      poll(
        () =>
          commentsOn(todoId).some(
            (comment) => comment.id === commentId && comment.viewer.isLiked === isLiked,
          ),
        '댓글 ' + commentId + '의 내 좋아요가 ' + isLiked + '인 것',
      ),

    waitForMemo: (text) => poll(() => memosContaining(text)[0] || null, '메모 "' + text + '"'),
    removeMemosContaining: (text) => {
      for (const memo of memosContaining(text)) {
        call('DELETE', '/v1/memos/' + memo.id, token, undefined, [404]);
      }
    },

    waitForNotification: (type) =>
      poll(
        () =>
          inbox().find((notification) => notification.type === type && !notification.isRead) ||
          null,
        '읽지 않은 ' + type + ' 알림',
      ),
    isNotificationRead: (notificationId) =>
      inbox().some((notification) => notification.id === notificationId && notification.isRead),

    findInviteCode: () => call('GET', '/v1/invites/me', token).code,
    hasInvited: (userId) =>
      call('GET', '/v1/invites/me/invitees', token).items.some((item) => item.userId === userId),
    isFriendOf: (userId) =>
      call('GET', '/v1/follows/friends', token).friends.some((friend) => friend.id === userId),
    sendFriendRequest: (userTag) => call('POST', '/v1/follows/' + userTag, token),
    acceptFriendRequest: (userId) => call('PATCH', '/v1/follows/' + userId + '/accept', token),
    countReceivedRequestsFrom: (userId) =>
      call('GET', '/v1/follows/requests/received?limit=50', token).requests.filter(
        (request) => request.id === userId,
      ).length,
    // 친구 끊기와 보낸 요청 취소가 같은 경로다. 이미 없으면 404라 정리에서 그대로 넘긴다
    removeFriendship: (userId) => call('DELETE', '/v1/follows/' + userId, token, undefined, [404]),
  };
}

// iOS 시뮬레이터에 서버 푸시와 같은 모양의 알림을 넣는다. 알림함의 실제 알림 id·문구를 실어야 앱의 소유 확인(읽음)이 통과한다.
// run-e2e.ts가 연 입구가 push/<template>.json을 채워 `xcrun simctl push`로 넘긴다
function pushToSimulator(template, notification) {
  if (output.config.simulatorPushUrl === '') {
    throw new Error('시뮬레이터 푸시 입구가 없습니다. maestro test 대신 pnpm e2e로 돌리세요.');
  }
  const response = http.post(output.config.simulatorPushUrl, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template: template,
      alert: { title: notification.title, body: notification.body },
      data: { notificationId: notification.id, context: notification.context || {} },
    }),
  });
  if (!response.ok) {
    throw new Error('시뮬레이터에 ' + template + ' 푸시를 넣지 못했습니다: ' + response.status);
  }
}

output.api = { signIn: signIn, pushToSimulator: pushToSimulator };
