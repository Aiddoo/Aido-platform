/** 기기 시간대가 바뀌었을 때 서버가 알림 시각을 다시 계산하는 앞으로의 기간 */
export const UPCOMING_TODO_WINDOW_DAYS = 31;

/** 날짜·반복 시트 달력의 날짜 칸 높이. 두 시트가 같은 칸으로 그린다 */
export const PICKER_DATE_CELL_HEIGHT = 48;

/** 달마다 4~6주라 6주 높이를 미리 잡아 달을 넘겨도 시트 높이가 변하지 않게 한다 */
export const PICKER_MONTH_HEIGHT = PICKER_DATE_CELL_HEIGHT * 6;
