// 모든 flow의 onFlowStart에서 가장 먼저 실행한다. 공용 함수를 output.lib에 올린다.
// (docs: maestro-flows/javascript/manage-data-and-states.md "Shared Functions")
//
// 안전장치: API 주소가 로컬이 아니면 어떤 요청도 보내기 전에 예외로 멈춘다.
// 계정 정보는 shell의 MAESTRO_ 접두 변수로만 받는다(argv에 비밀번호를 싣지 않는다).
// docs: maestro-flows/flow-control-and-logic/parameters-and-constants.md "Accessing shell variables"

var LOCAL_API = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal|api)(:\d+)?\/?$/;

function readConfig() {
  var base =
    typeof QA_API_BASE_URL !== 'undefined' && QA_API_BASE_URL
      ? QA_API_BASE_URL
      : 'http://localhost:8080';
  if (!LOCAL_API.test(base)) {
    throw new Error('로컬 API만 허용합니다. 현재 API 주소: ' + base);
  }

  function need(value, name) {
    if (typeof value === 'undefined' || !value) {
      throw new Error(name + ' 가 없습니다. maestro:accounts create 로 .env.maestro를 만드세요.');
    }
    return value;
  }

  return {
    base: base.replace(/\/$/, ''),
    a: {
      email: need(
        typeof MAESTRO_QA_INVITER_EMAIL === 'undefined' ? undefined : MAESTRO_QA_INVITER_EMAIL,
        'MAESTRO_QA_INVITER_EMAIL',
      ),
      password: need(
        typeof MAESTRO_QA_INVITER_PASSWORD === 'undefined'
          ? undefined
          : MAESTRO_QA_INVITER_PASSWORD,
        'MAESTRO_QA_INVITER_PASSWORD',
      ),
      name: need(
        typeof MAESTRO_QA_INVITER_NAME === 'undefined' ? undefined : MAESTRO_QA_INVITER_NAME,
        'MAESTRO_QA_INVITER_NAME',
      ),
    },
    b: {
      email: need(
        typeof MAESTRO_QA_INVITEE_EMAIL === 'undefined' ? undefined : MAESTRO_QA_INVITEE_EMAIL,
        'MAESTRO_QA_INVITEE_EMAIL',
      ),
      password: need(
        typeof MAESTRO_QA_INVITEE_PASSWORD === 'undefined'
          ? undefined
          : MAESTRO_QA_INVITEE_PASSWORD,
        'MAESTRO_QA_INVITEE_PASSWORD',
      ),
      name: typeof MAESTRO_QA_INVITEE_NAME === 'undefined' ? 'Maestro B' : MAESTRO_QA_INVITEE_NAME,
    },
  };
}

function call(base, method, path, token, body) {
  var headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }
  var response = http.request(base + path, {
    method: method,
    headers: headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(method + ' ' + path + ' 가 ' + response.status + '로 응답했습니다.');
  }
  return json(response.body).data;
}

function login(base, account) {
  var data = call(base, 'POST', '/v1/auth/login', null, {
    email: account.email,
    password: account.password,
    deviceName: 'maestro',
    deviceType: maestro.platform === 'android' ? 'ANDROID' : 'IOS',
  });
  return { token: data.accessToken, userId: data.userId };
}

output.lib = { readConfig: readConfig, call: call, login: login };
