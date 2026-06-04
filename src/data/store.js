/** 한사랑마트 — hansarang-mart 매장 정보 */
export const STORE = {
  name: '한사랑마트',
  nameEn: 'HANSARANG MART',
  tagline: '신선함을 담은 한사랑마트',
  description:
    '한사랑마트. 식료품부터 신선한 야채·청과까지 온라인으로 편리하게 주문하고 픽업 또는 배달로 받아보세요.',
  phone: '032-891-0550',
  phoneMobile: '010-2689-0551',
  address: '인천광역시 미추홀구 독배로 443',
  addressDetail: '1층',
  hours: '365일 연중무휴 08:00 – 23:00',
  deliveryRadiusKm: 2,
  minDeliveryAmount: 30000,
};

/** 카테고리 설정 */
export const CATEGORIES = [
  { id: 'all', label: '전체', emoji: '🛍️' },
  { id: '식료품', label: '식료품', emoji: '🛒', desc: '쌀, 면류, 통조림, 조미료 등' },
  { id: '야채', label: '야채', emoji: '🥬', desc: '신선한 제철 채소 모음' },
  { id: '청과', label: '청과', emoji: '🍎', desc: '과일, 견과류, 건과일' },
  { id: '생활용품', label: '생활용품', emoji: '🧴', desc: '세제, 위생용품, 주방용품' },
  { id: '음료', label: '음료', emoji: '🧃', desc: '음료수, 생수, 주스' },
];

/** 홈 화면 특징 영역 */
export const FEATURES = [
  {
    title: '간편한 온라인 주문',
    desc: '원하는 상품을 장바구니에 담고 간편하게 주문하세요.',
    icon: '🛍️',
  },
  {
    title: '픽업 & 배달',
    desc: '직접 방문 픽업 또는 배달 서비스를 선택하실 수 있습니다.',
    icon: '🚚',
  },
  {
    title: '신선한 상품',
    desc: '매일 아침 입고되는 신선한 야채와 청과를 만나보세요.',
    icon: '🌿',
  },
];

/** 
 * 샘플 상품 제거됨 
 * 실제 상품은 관리자 페이지의 엑셀 업로드나 
 * 직접 등록 기능을 통해 DB에 저장된 데이터를 사용합니다.
 */
export const PRODUCTS = []; 