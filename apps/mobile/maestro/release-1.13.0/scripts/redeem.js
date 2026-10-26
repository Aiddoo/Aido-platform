// B가 A의 현재 코드로 초대를 수락한다(POST /v1/invites/{code}/redeem). "이미 수락한 B" 상태를 API로 준비한다.
// B는 reset 직후(수락 기록 없음)여야 한다. 실패하면 flow가 멈춘다.
output.redeem = output.lib.call(
  output.api,
  'POST',
  '/v1/invites/' + output.code + '/redeem',
  output.b.token,
);
