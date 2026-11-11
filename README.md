# Kyohoon Jin · 개인 홈페이지

공개 메인과 원형 보존 Resume, 허용 사용자 Work를 한 주소에서 운영하기 위한 첫 버전입니다. 작업 폴더는 이 프로젝트뿐이며 원본 두 경로는 수정하지 않았습니다.

## 실행

Node.js 22 이상이 필요합니다. 다른 컴퓨터에서는 `node_modules`를 복사하지 말고 lockfile로 설치하세요.

```sh
npm ci
npm run dev
```

현재 컴퓨터에는 원본에 이미 설치된 빌드 의존성을 프로젝트로 복사했습니다. 외부 npm 연결이 EACCES로 차단되어 신규 설치하지 않았으며, 재현 가능한 package-lock.json을 생성했습니다.

- 메인: http://127.0.0.1:3000/
- Resume 직접 접근: http://127.0.0.1:3000/resume
- Work 로그인·로컬 검토: http://127.0.0.1:3000/work

Work의 **로컬 미리보기 열기**를 누르면 실제 업무 자료의 프로젝트 사본을 읽습니다. 변경은 `private/work/` 사본에만 저장되며 원본과 자동 동기화하지 않습니다. 미리보기는 별도 개발 진입점·loopback 연결·localhost Host·비 Vercel 조건을 모두 만족해야 열립니다. `npm start`와 배포 함수에는 해당 권한이 없고 개발 진입점도 배포에서 제외됩니다. `LOCAL_WORK_PREVIEW=0`으로 개발 중에도 끌 수 있습니다.

```sh
npm run build
npm run typecheck
npm test
npm start
```

`npm start`는 127.0.0.1의 프로덕션 모드 검토용입니다. Work 로그인에는 Supabase 설정이 필요하고 로컬 미리보기는 항상 차단됩니다. 포트는 환경변수 `PORT`로 변경합니다. 선택적으로 `.env.example`을 `.env.local`로 복사하세요. Node가 직접 읽으며 값은 커밋하지 않습니다.

## 구현 구조

- `server/`, `api/index.mjs`: 공통 HTTP 처리, Supabase Auth REST와 매 요청 멤버 확인, Vercel 함수.
- `views/`, `public/site.css`: 메인·로그인. Resume 문서와 CSS가 완전히 분리됩니다.
- `legacy/resume/`: 원본 코드·글꼴·설정의 변경 없는 사본.
- `public/resume/`: 기존 소스를 Webpack·Babel·Tailwind로 다시 빌드한 공개 결과. iframe 미사용.
- `work-app/`: 기존 연구 기획 앱의 일반 기능 코드. 모든 요청에 인증 적용.
- `private/work/`: 실제 업무 사본·분류·첨부. public 밖에 있으며 배포 제외.
- `assets-generated/`: 실제 이미지 생성 원본. `public/mascot/`은 웹 적용용.
- `supabase/schema.sql`: 멤버 권한·업무 JSONB·비공개 첨부 정책.
- `tests/`, `artifacts/`: 자동 검사와 프로젝트 내부 검증 기록.

Next.js·TypeScript·Tailwind를 검토했습니다. 외부 패키지 다운로드가 차단되어 Next.js를 설치할 수 없었고, 원형 Resume를 다시 쓰지 않기 위해 Node 표준 런타임+Vercel 함수를 선택했습니다. 새 메인 CSS는 독립 CSS이며 Resume는 기존 Tailwind3를 사용합니다. TypeScript 검사는 접근 정책과 업무 데이터 계약을 대상으로 하며 서버 전체의 정적 타입 검사는 아닙니다. 빌드에는 원본과 같은 React19.1을 사용합니다.

## 자료 가져오기

원본 경로는 실행 코드에 고정하지 않습니다. 각 컴퓨터에서 경로나 환경변수를 지정하세요.

```sh
node scripts/import-work.mjs --source "YOUR_LOCAL_RESEARCH_SOURCE"
node scripts/upload-work.mjs --dry-run
```

가져오기는 기존 프로젝트 업무 저장본을 자동 덮어쓰지 않습니다. 원격 업로드는 별도 명시 명령이며 아직 실행하지 않았습니다. [배포 준비](docs/deployment.md)를 먼저 읽으세요.

## 현재 한계

작업 중 전달된 Draft Markdown과 화면 이미지를 확인해 **로그인 후 7개 진입 영역이 있는 Work 허브**를 구현했습니다. 연구일지와 두 연구 데모를 열 수 있고 나머지 네 곳은 준비 중입니다. [Draft 대조표](docs/draft-requirements.md)에 요구사항별 결과를 기록했습니다. Supabase 서비스 생성·SQL 적용·실제 계정 로그인·공개 배포는 수행하지 않았습니다. 실제 브라우저 시각 검증과 PDF 페이지 검토의 확인 범위는 [작업 현황](docs/status.md), [원본 보존](docs/resume-migration.md), [업무 출처](docs/work-source.md)를 참고하세요.
