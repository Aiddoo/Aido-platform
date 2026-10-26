// onFlowStart: ../release-1.13.0/scripts/lib.js 다음에 실행한다(output.lib.call/login 재사용).
// 로컬 API만 허용하는 확인은 lib.js의 readConfig와 같은 규칙이다. 캡처 계정이 실제로 로그인되는지 API로 먼저 확인해
// 화면이 로그인 실패 상태로 찍히지 않게 한다. 비밀번호는 capture.sh가 shell의 MAESTRO_SHOT_* 변수로만 넘긴다.
var LOCAL_API = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal|api)(:\d+)?\/?$/;
var base =
  typeof QA_API_BASE_URL !== 'undefined' && QA_API_BASE_URL
    ? QA_API_BASE_URL
    : 'http://localhost:8080';
if (!LOCAL_API.test(base)) {
  throw new Error('로컬 API만 허용합니다. 현재 API 주소: ' + base);
}
if (typeof MAESTRO_SHOT_EMAIL === 'undefined' || !MAESTRO_SHOT_EMAIL) {
  throw new Error(
    'MAESTRO_SHOT_EMAIL 이 없습니다. capture.sh로 실행하거나 demo-seed seed 후 변수를 넘기세요.',
  );
}
if (typeof MAESTRO_SHOT_PASSWORD === 'undefined' || !MAESTRO_SHOT_PASSWORD) {
  throw new Error('MAESTRO_SHOT_PASSWORD 가 없습니다.');
}
output.api = base.replace(/\/$/, '');
output.shot = output.lib.login(output.api, {
  email: MAESTRO_SHOT_EMAIL,
  password: MAESTRO_SHOT_PASSWORD,
});
