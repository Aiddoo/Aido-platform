// 사람 id 칸 옆에 위치를 붙이는 다른 Context의 한 SQL이 위치 테이블을 직접 읽지 않게 한다
export {
  hasUserLocation,
  userCoordinates,
} from "./infrastructure/persistence/user-location.query-fragment.js";
