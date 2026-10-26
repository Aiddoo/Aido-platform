// A의 초대한 친구가 0명인지 API로 확인한다(GET /v1/invites/me/invitees).
var list = output.lib.call(output.api, 'GET', '/v1/invites/me/invitees', output.a.token);
if (list.totalCount !== 0) {
  throw new Error(
    '초대한 친구가 ' + list.totalCount + '명입니다. 보류한 초대가 다른 계정에 적용됐습니다.',
  );
}
