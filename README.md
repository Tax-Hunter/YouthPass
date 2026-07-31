# 💰 청패 (YouthPass)

> 작업기간 : 2026. 06. 15 ~

청년들이 흩어진 청년 지원 정책 정보를 조건에 맞춰 쉽고 빠르게 찾을 수 있도록 돕는 정책 큐레이션 웹 서비스입니다. "온통청년" 공공 API에서 정책 데이터를 수집·정제해 DB에 적재하고, 연령·지역·관심 분야 등으로 필터링해 개인화된 정책을 제공합니다.

<br>

## 🧭 주요 기능

| 기능 | 설명 |
|---|---|
| Google 소셜 로그인 | Google OAuth 기반 회원가입/로그인, JWT 액세스·리프레시 토큰 발급 |
| 온보딩 설문 | 나이, 거주지, 취업 상태, 관심 분야, 소득 구간 등 입력 → 맞춤 정책 필터링에 활용 |
| 정책 목록/검색/상세 | 카테고리별 정책 목록 조회, 키워드 검색, 정책 상세 정보 제공 |
| 맞춤 필터링 | 연령, 지역, 취업 상태, 관심 분야 등 조건으로 지원 가능한 정책만 분류 |
| 마이페이지 | 내 정보 조회/수정 |
| 북마크 | 관심 정책 저장 (DB 모델 구현 완료, API 개발 예정) |
| 정책 자동 수집(ingest) | 온통청년 OpenAPI에서 정책 데이터를 수집·정제·검증 후 DB 적재하는 배치 파이프라인 (Railway Cron, 3일 주기) |

<br>

## ⚒️ 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Zustand, TanStack Query |
| Backend | Python, FastAPI, SQLAlchemy 2.0, Alembic |
| Database | PostgreSQL |
| 인증 | Google OAuth 2.0, JWT (python-jose), passlib(bcrypt) |
| 데이터 수집 | 온통청년 공공 API (httpx 기반 배치 파이프라인) |
| Infra | Railway (FE/BE/DB/Cron 통합 배포) |

<br>

## 📁 프로젝트 구조

```
YouthPass/
├── frontend/               # Next.js 프론트엔드
│   ├── app/
│   │   ├── features/       # 화면 단위 컴포넌트 (auth, home, policy, search, filter, bookmarks, mypage, location, gallery, errors)
│   │   ├── components/     # 공통 레이아웃 (MobileLayout 등)
│   │   └── (라우트 디렉터리) # auth, home, list, detail, filter, location, login, mypage, survey, search, bookmarks, 404
│   └── lib/                # 타입, 스토어(Zustand), API 클라이언트, 인증 유틸
│
├── backend/                # FastAPI 백엔드
│   ├── app/
│   │   ├── api/routes/     # 기능별 라우터 (auth, users, policy, health)
│   │   ├── core/           # 설정, 보안, OAuth
│   │   ├── db/models/      # SQLAlchemy ORM 모델 (User, Policy, Bookmark, Code, PolicyStats, RefreshToken)
│   │   └── schemas/        # Pydantic 스키마
│   ├── ingest/             # 온통청년 API 수집·정제·검증·적재 파이프라인 (CLI)
│   └── alembic/            # DB 마이그레이션
│
├── PRD/                    # 기획 문서
└── workflow/                # 작업 기록 (이슈/브랜치별 작업 계획·결과 문서)
```

<br>

## 🔌 API 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health/get/status` | 서버 상태 확인 |
| GET | `/api/auth/get/google-login` | Google 로그인 리다이렉트 |
| GET | `/api/auth/get/google-callback` | Google OAuth 콜백 |
| POST | `/api/auth/post/refresh` | 액세스 토큰 갱신 |
| POST | `/api/auth/post/logout` | 로그아웃 |
| GET | `/api/users/get/me` | 내 정보 조회 |
| PUT | `/api/users/put/me` | 내 정보 수정 |
| POST | `/api/users/post/survey` | 온보딩 설문 제출 |
| GET | `/api/policy/get/policies` | 정책 목록 조회 (필터 포함) |
| GET | `/api/policy/get/search` | 정책 검색 |
| GET | `/api/policy/get/policy/{policy_id}` | 정책 상세 조회 |

<br>

## 🚀 로컬 실행 방법

**Frontend**
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
```

**Backend**
```bash
cd backend
cp .env.example .env   # 실제 DB/OAuth 정보로 수정 필요
./venv/Scripts/activate   # Windows
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload   # http://localhost:8000
```

**HTTPS로 로컬 접속하려면 (`https://localhost:3000`)**
```bash
# frontend/.env: NEXT_PUBLIC_API_URL, GOOGLE_REDIRECT_URI를 https://localhost:... 로 설정
# backend/.env: ALLOWED_ORIGINS, GOOGLE_REDIRECT_URI, FRONTEND_URL을 https://localhost:... 로 설정
# Google Cloud Console 승인된 리디렉션 URI에 https://localhost:8000/api/auth/get/google-callback 추가 필요

cd frontend
npm run dev:https   # mkcert 자체 서명 인증서로 https://localhost:3000 서빙

cd backend
# 최초 1회: backend/certs/ 에 localhost용 자체 서명 인증서 생성
mkdir -p certs && cd certs
openssl req -x509 -nodes -newkey rsa:2048 -keyout localhost-key.pem -out localhost.pem \
  -days 825 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
cd ..
uvicorn app.main:app --reload --ssl-keyfile certs/localhost-key.pem --ssl-certfile certs/localhost.pem
```

**정책 데이터 수집 (ingest)**
```bash
cd backend
python -m ingest.run verify --limit 300   # 수집·정제·검증만 (DB 미적재)
python -m ingest.run dryrun               # 적재 시뮬레이션 (ROLLBACK)
python -m ingest.run load                 # 실제 DB 적재
```

<br>