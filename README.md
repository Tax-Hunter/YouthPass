# 💰 청년패스 (YouthPass)

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

경로 규칙: `/api/{기능}/{메서드}/{상세}`

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

**정책 데이터 수집 (ingest)**
```bash
cd backend
python -m ingest.run verify --limit 300   # 수집·정제·검증만 (DB 미적재)
python -m ingest.run dryrun               # 적재 시뮬레이션 (ROLLBACK)
python -m ingest.run load                 # 실제 DB 적재
```

<br>

## 🌿 Git 브랜치 전략

| 브랜치 | 역할 |
|---|---|
| `main` | 커밋 없음. `dev` 브랜치에서 완료된 작업만 Pull Request 용도로 사용 |
| `dev` | 개발 브랜치. 자식 브랜치에서 작업한 내용들을 병합하는 브랜치 |
| `자식 브랜치` | 기능 단위별 작업 브랜치. 네이밍 규칙: `작업내용/#작업번호` (예: `feat/#12`, `fix/#3`) |

<br>

## ✏️ Commit Type

| 타입 | 설명 | 예시 |
|---|---|---|
| **feat** | 새로운 기능을 추가할 때 사용합니다. | `feat: 로그인 폼 유효성 검사 추가` |
| **fix** | 버그를 수정할 때 사용합니다. | `fix: 로그인 버그 수정` |
| **style** | 사용자 인터페이스 관련 변경 사항. | `style: 네비게이션 바 디자인 수정` |
| **refactor** | 버그 수정이나 기능 추가 없이 코드 구조를 개선할 때 사용합니다. | `refactor: 컴포넌트 상태 관리 로직 단순화` |
| **perf** | 성능을 개선하는 코드 변경. | `perf: 이미지 로딩 시간 최적화` |
| **test** | 테스트 코드를 추가하거나 수정할 때 사용합니다. | `test: 버튼 컴포넌트에 대한 단위 테스트 추가` |
| **docs** | 문서만 변경할 때 사용합니다. | `docs: 설치 단계 README에 추가` |
| **chore** | 소스나 테스트 파일을 수정하지 않는 일반적인 작업이나 업데이트. | `chore: 종속성 패키지 업데이트` |
| **revert** | 이전 커밋을 되돌릴 때 사용합니다. | `revert: "로그인 폼 유효성 검사 추가" 커밋 되돌림` |
| **init** | 프로젝트 초기 설정 시 사용합니다. | `init: React 프로젝트 초기 설정` |
| **delete** | 코드/파일 삭제. | `delete: 안 쓰는 로그인 컴포넌트 삭제` |
| **wip** | 작업 중이거나 실험적인 변경 사항. | `wip: 새로운 인증 방법을 실험 중` |

<br>

## 📄 관련 문서

- [PRD/SETTINGS.md](./PRD/SETTINGS.md) — 기획 배경, 요구사항, ERD, 환경 세팅 현황
- [PRD/WIREFRAME.md](./PRD/WIREFRAME.md) — 와이어프레임
- [CLAUDE.md](./CLAUDE.md) — 작업 기록/API 명명 규칙 등 개발 지침
- [workflow/](./workflow/) — 이슈·브랜치별 작업 계획 및 결과 기록
