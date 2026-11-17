// 사람 id 칸 옆에 표시 이름·권한 칸을 붙이는 다른 Context의 한 SQL이 사용자 테이블을 직접 읽지 않게 한다.
// identity-users.public은 access 권한 조건을 쓰는 어댑터를 거쳐 access가 쓰면 파일 순환이 되어 따로 연다
export {
  type UserAccessColumns,
  userAccessSubjects,
} from "./infrastructure/persistence/user-access-subject.query-fragment.js";
export { userDisplayProfiles } from "./infrastructure/persistence/user-display-profile.query-fragment.js";
