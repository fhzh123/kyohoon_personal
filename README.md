# Kyohoon Jin

AI Research Engineer 진교훈의 개인 홈페이지입니다. 공개 Resume와 로그인 후 사용하는 연구 및 개인 공간을 운영합니다.

[홈페이지](https://www.kyohoon.app) | [Resume](https://www.kyohoon.app/resume) | [로그인](https://www.kyohoon.app/login)

## 현재 구성

| 공간 | 기능 | 접근 |
| --- | --- | --- |
| Home | Resume, Selectstar, Personal 이동, 테마 전환, 로그인 | 공개 |
| Resume | 경력, 연구 논문, 프로젝트, 학력, 수상과 연락처 | 공개 |
| Login | 이메일과 비밀번호 로그인, 관리자 문의 안내 | 공개 |
| Selectstar | 연구일지, 데모, 품의 사용내역 허브 | 허용된 계정 |
| 연구일지 / 로드맵 | 연구 계층 관리, 노트, 관련 논문, 담당자 및 상태 필터, 월별 캘린더, 일정 편집과 자동 저장 | 역할별 읽기/편집 |
| 연구 데모 | Ontology와 Document Parsing 데모 이동 | 허용된 계정 |
| 품의 사용내역 | 월별 엑셀 업로드, 품의별 예산과 카드 내역 분석, 원본 파일 관리 | 역할별 읽기/편집 |
| Personal | 개인 공간 진입 화면 | 허용된 계정 |

다크 모드와 라이트 모드를 공통으로 제공하고 선택을 유지합니다. Resume의 홈 이동 버튼은 서버에서 세션과 멤버 권한을 확인한 경우 표시합니다.

## 로그인과 데이터

- 보호된 페이지는 공통 `/login` 화면으로 이동하며, 인증 후 원래 열려던 페이지로 돌아갑니다.
- 비밀번호 문의 버튼은 Resume와 같은 카카오톡 QR코드와 관리자 이메일을 보여줍니다. 자동 비밀번호 재설정 메일을 보내지 않습니다.
- 공개 회원가입은 제공하지 않습니다. Supabase Auth의 유효한 세션과 활성 `workspace_members` 등록을 함께 확인합니다.
- 세션은 HttpOnly 쿠키로 관리하며 운영에서는 Secure와 SameSite 정책을 적용합니다. 토큰을 브라우저 저장소나 HTML에 넣지 않습니다.
- 연구 데이터, 첨부파일, 품의 내역은 기존 Supabase Database와 비공개 Storage를 사용합니다. 읽기 계정의 서버 쓰기 요청은 거부합니다.
- 연구 상태와 품의 교체는 revision 검사를 적용해 오래된 화면의 덮어쓰기를 방지합니다.

## 기술과 배포

| 영역 | 구성 |
| --- | --- |
| 서버 | Node.js 22+, 공통 HTTP 핸들러, Vercel Node 함수 |
| 화면 | 서버 렌더링 HTML, CSS, JavaScript |
| Resume | React 19, Webpack, Babel, Tailwind CSS 3 |
| 데이터 및 인증 | Supabase Auth REST, Postgres, Storage |
| 배포 | GitHub `main`과 연결된 기존 Vercel 프로젝트 |
| 글꼴 및 이미지 | Pretendard, 페이지별 마스코트, 프로젝트 이미지 |

`/resume`은 Vercel 파일시스템 라우팅보다 먼저 서버를 거쳐 로그인 상태를 주입합니다. 연구일지와 품의 앱은 인증 후에만 코드와 데이터를 제공합니다.

## 로컬 실행

Node.js 22 이상을 사용합니다.

```sh
npm ci
npm run dev
```

환경변수는 `.env.example`을 참고하여 `.env.local`에 설정합니다. Supabase 로그인에는 `SUPABASE_URL`과 `SUPABASE_ANON_KEY`가 필요합니다. 실제 키와 계정 정보는 커밋하지 않습니다.

| 명령 | 용도 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | Resume 빌드, 문법 및 타입 검사, 연구일지 번들 생성 |
| `npm run typecheck` | 접근 정책과 워크스페이스 데이터 계약 검사 |
| `npm test` | 로그인, 권한, 연구일지, 품의와 화면 동작 테스트 |
| `npm start` | 로컬 운영 모드 서버 |

개발용 `/work/preview`는 별도 개발 진입점, loopback 접속, localhost Host, 비 Vercel 환경을 모두 만족해야 사용할 수 있습니다. 사전에 가져온 `private/work/` 사본만 사용하며 Supabase와 자동 동기화하지 않습니다. 운영 모드에서는 차단됩니다.

## 저장소 구조

| 경로 | 역할 |
| --- | --- |
| `server/`, `api/index.mjs` | 라우팅, 로그인, 권한 확인, 데이터 처리 |
| `views/pages.mjs` | Home, 공통 로그인, Selectstar 및 Personal 화면 |
| `public/` | 공통 스타일, 테마, 로그인 동작, 공개 이미지와 마스코트 |
| `legacy/resume/` | Resume React 소스와 빌드 입력 |
| `public/resume/` | 빌드된 Resume 문서와 정적 자산 |
| `work-app/` | 인증이 필요한 연구일지와 로드맵 앱 |
| `work-expenses/` | 인증이 필요한 품의 분석 앱 |
| `supabase/schema.sql` | 데이터 구조와 접근 정책 정의 |
| `scripts/` | 빌드, 자료 가져오기와 명시적 업로드 도구 |
| `tests/` | 자동 검사 |
| `docs/` | 구축 및 검증 시점별 참고 기록 |

`docs/`에는 과거 작업 시점의 기록도 포함되어 있습니다. 현재 기능과 운영 구성은 이 README와 실행 코드를 기준으로 확인합니다.

## 변경 이력

이번 변경에서는 공통 로그인 페이지, 원래 목적지 복귀, 관리자 연락 모달, 로그인과 문의용 마스코트, 오른쪽 정렬 저작권 표시를 추가했습니다.

### 주요 진행 단계

| 단계 | 결과 |
| --- | --- |
| 2026-11-11 | 개인 홈페이지 초기 저장소 구성 |
| 2026-11-12 | 테마와 마스코트, 연구 로드맵과 관련 논문, 로딩 개선 |
| 2026-11-12 | 월별 캘린더, 일정 중첩과 자동 저장, 품의 분석과 파일 관리 구현 |
| 2026-11-12 | 홈 공간 개편, Pretendard 통일, 디자인 정리 |
| 2026-11-13 | Resume 완성, 배경과 연구 도구 모음 개선, L3 편집 및 다중 선택, 체크박스 필터, 로그인별 Resume 이동 처리 |

### 전체 커밋 기록

현재 반영된 전체 커밋 45개를 최신순으로 정리했습니다. 날짜는 한국 표준시(KST) 기준이며, 회차는 각 날짜의 첫 커밋부터 1회차로 시작합니다. 병합 커밋도 포함하며, 회차를 누르면 원본 커밋을 확인할 수 있습니다.

| 날짜 | 회차 | 변경 내용 |
| --- | --- | --- |
| 2026-11-13 | [10회차](https://github.com/fhzh123/kyohoon_personal/commit/d95bee177216a5a1c35d3c9ac7c59ec6b614d7ee) | 홈 로그인 버튼이 두 테마에서 잘 보이도록 색상 우선순위 수정 |
| 2026-11-13 | [9회차](https://github.com/fhzh123/kyohoon_personal/commit/dcc4edd33b0cd0e6b70a0396a1ee3a8ec2377868) | 공통 로그인 화면, 관리자 문의 팝업과 마스코트 추가, README 갱신 |
| 2026-11-13 | [8회차](https://github.com/fhzh123/kyohoon_personal/commit/0d43558316040572b0d7cb58f90da7ab61a8cb06) | Resume를 서버 세션 검증 후 제공하도록 Vercel 라우팅 수정 |
| 2026-11-13 | [7회차](https://github.com/fhzh123/kyohoon_personal/commit/521fcdb5b1c56cc0bb93bb205d21f0f067900708) | 인증된 Resume의 홈 이동 버튼 문구 정리 |
| 2026-11-13 | [6회차](https://github.com/fhzh123/kyohoon_personal/commit/b4c6f6fa38028d06ad2a2290b7e7c7df7ad9ee40) | Resume 내용과 프로젝트 이미지 갱신, 인증별 홈 버튼 적용 |
| 2026-11-13 | [5회차](https://github.com/fhzh123/kyohoon_personal/commit/2a3b2f35af23d7dd486259baa155608f8fbabfc8) | 연구 유형, 상태, 담당자에 체크박스 필터 추가 |
| 2026-11-13 | [4회차](https://github.com/fhzh123/kyohoon_personal/commit/17840343cceb9016a4e7e70d9e31cb24fa4bbf74) | L3 다중 선택과 로드맵 그룹 직접 드래그 지원 |
| 2026-11-13 | [3회차](https://github.com/fhzh123/kyohoon_personal/commit/301f45b0b49ae325c4a558761a6be7887b204516) | L3 삭제와 연구 노트의 관련 논문 다중 등록 지원 |
| 2026-11-13 | [2회차](https://github.com/fhzh123/kyohoon_personal/commit/f8de18facda8e36d5258c9745870d6c15047c081) | 홈 배경 정리와 연구 도구 모음 개선 |
| 2026-11-13 | [1회차](https://github.com/fhzh123/kyohoon_personal/commit/e1171e8e49adb50f3c4e9a876485cd889edc60b2) | Resume 내용 및 테마 보완, Work 카드 겹침 수정 |
| 2026-11-12 | [34회차](https://github.com/fhzh123/kyohoon_personal/commit/ef8626411f27f46bb647bb746675d1d9dc66efff) | Taste 기반으로 홈 레이아웃과 시각 스타일 개선 |
| 2026-11-12 | [33회차](https://github.com/fhzh123/kyohoon_personal/commit/cd35787ef6e6886ad439edd91d5968eab57a3752) | 전 화면에 Pretendard 글꼴 적용 |
| 2026-11-12 | [32회차](https://github.com/fhzh123/kyohoon_personal/commit/ea85526e0865bbbfddbe50bb1929b80a836d1d74) | 홈 공간 개편 브랜치 병합 |
| 2026-11-12 | [31회차](https://github.com/fhzh123/kyohoon_personal/commit/ee6971cfc91ee0f267904450a9423624ba00011c) | 홈 공간 디자인 개편, 연구일지 동일 페이지 로딩 수정 |
| 2026-11-12 | [30회차](https://github.com/fhzh123/kyohoon_personal/commit/a6847c42632987c5ca3efd57a354a95d25a6cdfe) | 품의 사용내역 기능 브랜치 병합 |
| 2026-11-12 | [29회차](https://github.com/fhzh123/kyohoon_personal/commit/a4791fa4d16348e87593e04a1ffacd975debe0ad) | 품의 매칭에서 비고의 부수적인 월 표기 처리 보완 |
| 2026-11-12 | [28회차](https://github.com/fhzh123/kyohoon_personal/commit/d04b1ae60d450e710d5a00a501e7691595e20b25) | 비고 날짜보다 명시적 품의 필드를 우선하도록 수정 |
| 2026-11-12 | [27회차](https://github.com/fhzh123/kyohoon_personal/commit/b0f40f452c0a798d7ac6c1904f4ab080fb8bb0d0) | 품의 데이터 테이블과 멤버 접근 정책 기록 |
| 2026-11-12 | [26회차](https://github.com/fhzh123/kyohoon_personal/commit/c8448fae860949e00064341a5f7b4aff9b43a055) | 품의 보고서, 파일 교체, 접근 권한 테스트 추가 |
| 2026-11-12 | [25회차](https://github.com/fhzh123/kyohoon_personal/commit/5c9eb9295432ac9cc3572e1bc8b992038e575ed0) | 운영 빌드에 품의 모듈 검증 추가 |
| 2026-11-12 | [24회차](https://github.com/fhzh123/kyohoon_personal/commit/003a6a7729682c635687731bd5c53535742c1c1f) | Work 허브에 품의 사용내역 진입점 추가 |
| 2026-11-12 | [23회차](https://github.com/fhzh123/kyohoon_personal/commit/4282be4d628dd8e2398e029ea1a6d5f5b8430fa4) | 인증된 원본 파일 보관과 월별 내역 원자적 교체 구현 |
| 2026-11-12 | [22회차](https://github.com/fhzh123/kyohoon_personal/commit/34aa12c2ef818123de21e641b32d605a8802ee2f) | 품의 보고서와 월별 업로드 화면 추가 |
| 2026-11-12 | [21회차](https://github.com/fhzh123/kyohoon_personal/commit/92c38d5575138327663151ed91df8f399f1f4e2a) | 엑셀 파서와 보호된 품의 배포 파일 추가 |
| 2026-11-12 | [20회차](https://github.com/fhzh123/kyohoon_personal/commit/ebfe647cd5f044af6d4b49933716453495de74e5) | 캘린더, 일정 중첩, 자동 저장 브랜치 병합 |
| 2026-11-12 | [19회차](https://github.com/fhzh123/kyohoon_personal/commit/fdc7bd71c5b8da869fa6f47a698a82a770be1aa4) | 자동 저장, 컨텍스트 메뉴, 담당자 중첩 테스트 추가 |
| 2026-11-12 | [18회차](https://github.com/fhzh123/kyohoon_personal/commit/66561a993f35ef9ac785a326af23dd2afc11a910) | 연구일지 번들에 월별 캘린더 포함 |
| 2026-11-12 | [17회차](https://github.com/fhzh123/kyohoon_personal/commit/6b4885917976070138a95203ef0b1ce89bc40d40) | 캘린더 중첩 표시와 로드맵 편집 안정성 개선 |
| 2026-11-12 | [16회차](https://github.com/fhzh123/kyohoon_personal/commit/54f1b7087341cdc32fea5de53f133d51530380af) | 로드맵 논문 및 로딩 기능 브랜치 병합 |
| 2026-11-12 | [15회차](https://github.com/fhzh123/kyohoon_personal/commit/47f8c5d5a036266a95cf91ed3ccfccbfe00c3b11) | 업무 표시 설정과 관련 논문 데이터 구조 문서화 |
| 2026-11-12 | [14회차](https://github.com/fhzh123/kyohoon_personal/commit/ed94218aa3f20f53294766a39aff06fb9d66da29) | 관련 논문 저장과 앱 초기화 테스트 추가 |
| 2026-11-12 | [13회차](https://github.com/fhzh123/kyohoon_personal/commit/e73fa91d3596be9a304c23290066b22166f6c711) | 로드맵 진입 시 로딩 상태 표시 |
| 2026-11-12 | [12회차](https://github.com/fhzh123/kyohoon_personal/commit/b840bbf28f6ce3a4035f4851386aa682e4354650) | 기존 4프레임 걷기 스프라이트 활용 |
| 2026-11-12 | [11회차](https://github.com/fhzh123/kyohoon_personal/commit/d0fe29e8b5bacdc39bcf6dc1e18921613b28c2d9) | 연구일지 로딩용 걷는 마스코트 추가 |
| 2026-11-12 | [10회차](https://github.com/fhzh123/kyohoon_personal/commit/a0e3a717cee02baba4797decfa0d0773ce849d17) | 보호된 연구일지 스크립트와 스타일 번들링 |
| 2026-11-12 | [9회차](https://github.com/fhzh123/kyohoon_personal/commit/4df66cfb4b88fe253e5a6b85bdd68a633e601351) | 중복된 워크스페이스 초기화 요청 제거 |
| 2026-11-12 | [8회차](https://github.com/fhzh123/kyohoon_personal/commit/55070caa2f4c92ff0df06a79b113bb8543cca7f9) | 로드맵 표시 설정과 관련 논문 컬렉션 추가 |
| 2026-11-12 | [7회차](https://github.com/fhzh123/kyohoon_personal/commit/7354a9dee05855b2f5ed03ea3ca73ef0634bcb80) | 워크스페이스 서버를 데이터베이스 인접 리전에 배치 |
| 2026-11-12 | [6회차](https://github.com/fhzh123/kyohoon_personal/commit/3e5ef2ffb15e8bab3b4ba873826dec353b80fc5c) | 마스코트 및 다크 테마 수정 브랜치 병합 |
| 2026-11-12 | [5회차](https://github.com/fhzh123/kyohoon_personal/commit/871a3e39c0dd461b25fc0fae90525e35e0dd329e) | 공유된 화면 스타일에 맞춰 홈페이지 검사 갱신 |
| 2026-11-12 | [4회차](https://github.com/fhzh123/kyohoon_personal/commit/a5d905b3613decc94df3ded77062a54991460300) | 홈과 Work에 공통 스타일 적용 |
| 2026-11-12 | [3회차](https://github.com/fhzh123/kyohoon_personal/commit/5cb370c11634bf3e3539f00d445eefbc654f7aec) | 워크스페이스 마스코트와 화면 테마 제어 복원 |
| 2026-11-12 | [2회차](https://github.com/fhzh123/kyohoon_personal/commit/c5df042317be413acda768f74374a5cac3b1daf9) | 워크스페이스 브랜딩용 최적화 마스코트 추가 |
| 2026-11-12 | [1회차](https://github.com/fhzh123/kyohoon_personal/commit/3f9eebdbf04f2a67103f7663637dd82570fbd7df) | 유지되는 다크 모드와 라이트 모드 지원 |
| 2026-11-11 | [1회차](https://github.com/fhzh123/kyohoon_personal/commit/5e88c300c8e706362d105fa550a92ccf7b11e3ed) | 개인 홈페이지 초기 코드 등록 |

이 표 이후의 변경은 [전체 커밋 목록](https://github.com/fhzh123/kyohoon_personal/commits/main)에서 확인할 수 있습니다.
