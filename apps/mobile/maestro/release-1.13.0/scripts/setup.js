// onFlowStart: 두 계정(A=초대자, B=초대받는 사람)을 API로 로그인하고 현재 초대 코드를 가져온다.
// UI로 코드를 읽지 않는다. 결과는 output.a / output.b / output.code / output.api 에 둔다.
var config = output.lib.readConfig();
var a = output.lib.login(config.base, config.a);
var b = output.lib.login(config.base, config.b);

output.api = config.base;
output.a = {
  email: config.a.email,
  password: config.a.password,
  name: config.a.name,
  token: a.token,
  userId: a.userId,
};
output.b = {
  email: config.b.email,
  password: config.b.password,
  name: config.b.name,
  token: b.token,
  userId: b.userId,
};

try {
  output.code = output.lib.call(config.base, 'GET', '/v1/invites/me', a.token).code;
} catch {
  // INVITE_ENABLED=false 이면 코드를 읽을 수 없다. flag-off flow는 형식만 맞는 자리 코드로 링크를 연다
  output.code = 'ZZZZZZ';
}
