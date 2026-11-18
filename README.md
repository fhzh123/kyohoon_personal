# Kyohoon Jin

AI Research Engineer 진교훈의 개인 홈페이지입니다. 경력과 연구 성과를 소개하고, 연구 작업과 개인 기록을 관리합니다.

[홈페이지](https://www.kyohoon.app) | [Resume](https://www.kyohoon.app/resume) | [Personal](https://www.kyohoon.app/personal) | [갤러리](https://www.kyohoon.app/personal/gallery)

## 공간 안내

| 공간 | 주소 | 주요 기능 | 접근 |
| --- | --- | --- | --- |
| Home | `/` | Resume, Selectstar, Paper, Personal로 이동 | 공개 |
| Resume | `/resume` | 경력, 논문, 프로젝트, 학력과 연락처 | 공개 |
| Selectstar | `/work` | 연구일지, 팀 리소스, 연구 데모, 품의 사용내역 | 허용된 계정 |
| 팀 리소스 | `/work/team-resources` | 과업별 배분, 월별 변화, Notion 주간 기록 | 허용된 계정 |
| Paper | `/paper` | 논문 리뷰 준비와 리뷰탈 준비 | 허용된 계정 |
| Personal | `/personal` | 여행의 흔적과 마스코트 갤러리 | 공개 |
| 여행의 흔적 | `/personal/travel` | 지구본에서 지역별 여행 사진과 기록 열람 | 공개 열람, Editor 편집 |
| 갤러리 | `/personal/gallery` | 마스코트 모아보기, 검색, 좋아요, 방향 전환과 다운로드 | 공개 |
| 설정 | `/settings` | 화면 테마, 배경과 LLM 설정 | 항목별 권한 적용 |

### Selectstar

- **연구일지와 로드맵:** 연구 계층, 일정, 노트, 관련 논문을 관리합니다. 연구 유형, 상태와 담당자를 여러 개 선택해 필터링하고, 캘린더와 담당자별 리소스를 확인합니다.
- **팀 리소스:** 각 팀원의 기록된 업무를 100%로 환산해 과업별 비중을 비교합니다. 팀 전체 배분, 월별 변화, 주간 원본 링크를 제공합니다. 휴가와 개인 업무시간 합계는 비교 지표에서 제외합니다.
- **연구 데모:** Ontology와 Document Parsing 데모를 새 창에서 엽니다.
- **품의 사용내역:** 월별 엑셀을 업로드하고 품의 예산과 카드 내역을 확인합니다. 원본 파일과 월별 데이터를 관리합니다.

### Paper

리뷰어로서 평가를 작성하는 **논문 리뷰 준비**와 저자로서 리뷰어별 쟁점과 답변을 정리하는 **논문 리뷰탈 준비**를 제공합니다. 논문 PDF와 메모를 바탕으로 작업하고, 설정한 LLM을 이용해 리뷰나 답변 작성을 보조합니다.

### Personal

- **여행의 흔적:** 지구본을 회전하고 지역을 선택해 여행 사진과 설명을 봅니다. Editor는 기록과 사진을 편집하고, 관광과 학회 방문의 색상을 설정합니다.
- **갤러리:** 마스코트의 여러 모습을 검색하고 분류별로 둘러봅니다. 8방향 보기, 걷기 재생, 이미지 확대, 원본 PNG와 WebP 다운로드, 좋아요 ZIP 다운로드를 지원합니다. 좋아요는 현재 브라우저에 저장됩니다.

갤러리 대표 이미지는 액자를 든 전용 마스코트입니다. T1 유니폼을 입은 모습은 T1을 응원하는 팬의 모습으로 소개합니다.

## 화면과 탐색

기본 테마는 시스템 설정을 따르며, 직접 선택한 라이트 모드와 다크 모드는 브라우저에 저장됩니다. Resume를 제외한 공간은 상단에서 해당 공간의 홈과 전체 홈으로 이동할 수 있습니다. Resume의 홈 버튼은 로그인 세션을 확인한 경우 표시합니다.

배경과 LLM 설정은 로그인한 계정의 권한에 따라 이용합니다.

## 실행

Node.js 22 이상이 필요합니다.

```sh
npm ci
npm run dev
```

기본 개발 주소는 `http://127.0.0.1:3000`입니다. 환경변수는 [.env.example](.env.example)을 참고해 `.env.local`에 설정합니다. Supabase 로그인에는 `SUPABASE_URL`과 `SUPABASE_ANON_KEY`가 필요합니다.

| 명령 | 용도 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 사전 테스트, Resume 빌드, 문법과 타입 검사, 연구일지 번들 생성 |
| `npm run typecheck` | 타입 검사 |
| `npm test` | 전체 테스트 실행 |
| `npm start` | 운영 모드 서버 실행 |

개발용 `/work/preview`는 localhost의 개발 환경에서만 사용할 수 있습니다. 미리 가져온 `private/work/` 사본을 사용하며 운영 환경에서는 차단됩니다.

로컬에서 팀 리소스를 보려면 승인된 Notion 스냅샷을 `private/work/team-resources.json`에 두고 개발 로그인으로 접속합니다. 운영 서버는 Supabase의 `team_resource_snapshots`에서 로그인한 팀원에게 데이터를 제공합니다.

## 기술 구성

| 영역 | 구성 |
| --- | --- |
| 서버 | Node.js 22, 공통 HTTP 핸들러, Vercel Node 함수 |
| 화면 | 서버 렌더링 HTML, CSS, JavaScript |
| Resume | React 19, Webpack, Babel, Tailwind CSS 3 |
| 인증과 데이터 | Supabase Auth, Postgres, Storage |
| 글꼴 | Pretendard |
| 배포 | GitHub `main`에 연결된 Vercel 프로젝트 |

### 저장소 구조

| 경로 | 역할 |
| --- | --- |
| `server/`, `api/` | 라우팅, 인증, 권한 확인과 데이터 처리 |
| `views/` | Home, Selectstar, Paper, Personal과 설정 화면 |
| `public/` | 공개 스타일, 스크립트, 마스코트와 정적 자산 |
| `public/gallery/` | 갤러리 동작과 방향별 이미지 |
| `legacy/resume/` | Resume React 소스 |
| `public/resume/` | 빌드된 Resume |
| `work-app/` | 연구일지와 로드맵 |
| `work-expenses/` | 품의 분석 |
| `work-demos/` | Ontology와 Document Parsing 데모 |
| `supabase/` | 기능별 데이터 구조와 접근 정책 |
| `scripts/` | 빌드, 자료 가져오기와 검증 도구 |
| `tests/` | 자동 테스트 |
| `docs/` | 구축과 운영 참고 문서 |

## 인증과 데이터 관리

공개 회원가입은 제공하지 않습니다. 보호된 기능은 Supabase의 유효한 로그인 세션과 활성 `workspace_members` 등록을 함께 확인합니다. Reader는 열람하고 Editor는 허용된 데이터를 편집합니다.

세션은 HttpOnly 쿠키로 관리하며 3시간 동안 사이트 활동이 없으면 만료됩니다. 연구 자료와 품의 원본은 비공개 Storage를 사용하고, 여행 사진은 공개 열람용 `travel-photos` 버킷에 저장합니다. 연구 상태와 품의 교체 등은 revision 검사로 오래된 화면의 덮어쓰기를 방지합니다.

실제 키, 계정 정보, 개인 자료와 로컬 환경 파일은 커밋하지 않습니다. 기능별 테이블과 정책은 `supabase/`, 배포 참고 사항은 [docs/deployment.md](docs/deployment.md)에서 확인할 수 있습니다. `docs/`의 과거 기록은 작성 시점의 상태를 설명하므로 현재 동작은 실행 코드를 기준으로 확인합니다.

### 팀 리소스 갱신

초기 데이터 구조는 [supabase/team-resources.sql](supabase/team-resources.sql)에 정의되어 있습니다. Notion에서 확인한 정규화 스냅샷을 운영 권한으로 `id = current` 행에 갱신합니다. 화면에는 스냅샷 기준일과 마지막 주간 기록의 종료일이 표시됩니다. 갱신할 때 휴가 항목과 제외 대상 팀원을 걸러냅니다. 현재 갱신은 수동입니다.

## 주요 변경

| 날짜 | 내용 |
| --- | --- |
| 2026-11-18 | 팀 리소스 대시보드, 연구 일정 달력 입력, 활동 기준 자동 로그아웃 |
| 2026-11-17 | 공간 홈과 전체 홈 탐색 통일, 마스코트 갤러리 공개, 갤러리 전용 마스코트 추가와 T1 이미지 설명 정리 |
| 2026-11-13 | Resume와 프로젝트 이미지 정리, 연구 필터와 L3 편집, 로그인에 따른 Resume 이동 처리 |
| 2026-11-12 | 연구 로드맵, 캘린더와 자동 저장, 품의 분석, 테마와 마스코트 구성 |
| 2026-11-11 | 개인 홈페이지 저장소 구성 |

전체 변경 사항은 [커밋 기록](https://github.com/fhzh123/kyohoon_personal/commits/main)에서 확인할 수 있습니다.
