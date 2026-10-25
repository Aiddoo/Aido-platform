// A가 초대 링크를 새로 만든다(POST /v1/invites/me/rotate). 이전 코드는 폐기된다.
output.oldCode = output.code;
var rotated = output.lib.call(output.api, 'POST', '/v1/invites/me/rotate', output.a.token);
output.code = rotated.code;
if (output.code === output.oldCode) {
  throw new Error('새 링크가 이전 코드와 같습니다.');
}
