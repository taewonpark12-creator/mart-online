# 한사랑마트 온라인 주문 시스템

한사랑마트를 위한 온라인 주문 웹 애플리케이션입니다.

## 기능

### 고객 페이지 (`/`)

- 카테고리별 상품 목록 조회
- 장바구니 담기 및 수량 조절
- 주문번호 확인

### 관리자 페이지 (`/admin`)

- 비밀번호 로그인
- **대시보드**: 오늘 주문, 대기 주문, 재고 부족 상품 현황
- **주문 관리**: 주문 상태 변경 (접수대기 → 주문승인 → 배달완료), **A11 영수증 인쇄**
- **상품 관리**: 상품 추가/수정/품절, 재고 관리

## A11 영수증 프린터 인쇄

1. POSBANK A11 드라이버를 PC에 설치하고 USB(또는 네트워크)로 연결합니다.
2. Windows **설정 → 프린터**에서 용지 크기를 **80mm** 영수증으로 맞춥니다.
3. 관리자 **주문 관리**에서 **영수증 인쇄**를 누릅니다.
4. 인쇄 대화상자에서 프린터 **A11**, 용지 **80mm**를 선택합니다.

Chrome/Edge 사용을 권장합니다.

## 시작하기

```bash
# 의존성 설치
npm install

# 데이터베이스 생성
npx prisma db push

# 개발 서버 실행
npm run dev
```

브라우저에서 접속:

- 고객: [http://localhost:3000](http://localhost:3000)
- 관리자: [http://localhost:3000/admin](http://localhost:3000/admin)

## 관리자 비밀번호

관리자 비밀번호는 `.env.local` 또는 Vercel 환경변수의 `ADMIN_PASSWORD`에 설정합니다.
기본 비밀번호는 없으며, `ADMIN_PASSWORD`가 없으면 관리자 로그인은 차단됩니다.

## Flyer uploads

Admin flyer file uploads commit JPG/PNG files to `public/flyers/` through the GitHub Contents API.
Set these environment variables in Vercel:

- `GITHUB_TOKEN` with repo contents write access
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH` (usually `main`)

Uploaded flyer records store `/flyers/<filename>` in the database.

## 기술 스택

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS 4
- Prisma + SQLite
