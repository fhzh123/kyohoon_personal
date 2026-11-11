# 작업 현황

## 완료

- 지정된 C: 작업 경로 확인. 초기 프로젝트에는 Assets만 있었으며 기존 자산은 보존했습니다. 적용되는 AGENTS.md는 찾지 못했습니다.
- 메인: 원본 캐릭터 참조로 실제 생성한 Resume·Work 이미지, 영역 전체 링크, 푸른 디자인, 모바일 CSS·focus·움직임 줄이기.
- Resume: 현재 원본 소스·콘텐츠·폰트 36개 SHA-256 일치. 원본 CSS/인터랙션을 유지하는 독립 HTML 빌드. iframe 없음.
- Work: Draft를 확인해 7개 진입 영역의 로그인 후 허브 구현. 첫 항목은 실제 v4 저장본을 연결한 기존 Research Atlas 연구일지, 다음 두 항목은 지정된 연구 데모 링크, 네 항목은 비활성 공사 중입니다. 업무 데이터·원본 이미지·XLSX는 private 디렉터리. 서버 인증 뒤에만 로딩합니다.
- 인증: 이메일·비밀번호 Supabase Auth REST, HttpOnly 쿠키, 사용자 확인과 허용 멤버 조회, 역할별 수정 제한. 설정 누락 시 닫힘.
- 로컬 업무 사본의 낙관적 저장 충돌 검사·백업. 원본 수정 없음.
- DB·RLS·비공개 Storage·최초 업로드 준비. 실행·빌드·검증 결과는 아래 문서와 최종 보고에 기록.

## 미완료·필요 정보

- 최초에는 Draft가 없었으나 사용자 안내 후 Assets/Draft에 추가된 Markdown·PDF·이미지를 찾았습니다. Markdown 전체와 **PDF 2페이지 전체를 실제 PNG로 렌더링해 시각 확인**했고 Work 핵심 구조를 맞췄습니다. 설치된 Windows PDF API와 C# 렌더러를 사용했으며 실행 정책을 변경하지 않았습니다. 렌더 결과는 artifacts/draft-review에만 두고 공개하지 않습니다. [요구사항 대조](draft-requirements.md).
- 브라우저 호스트 이용 불가. 네이티브 Firefox 접근은 도구 승인 대기 시간 초과. 따라서 화면·반응형·실제 키보드 조작의 시각 검증 및 화면 스크린샷은 미완료입니다. DOM 모의 실행과 HTTP 검사를 실제 브라우저 검사와 구분합니다.
- Supabase 실계정·DB·RLS·Storage 연결 미검증. Vercel 배포·도메인 설정 없음.
- npm ci를 새 컴퓨터의 실제 네트워크 환경에서 재확인해야 합니다. 현재 build는 복사한 기존 의존성에서 실행했습니다.

## 실제 에이전트와 파일 소유권

요청한 herdr 오케스트레이션 도구는 현재 세션에 노출되지 않았습니다. 내장 협업 도구의 동시 실행 한도는 총괄 포함 4입니다. 실제 Codex 에이전트 총 7개를 순차·병렬로 사용했습니다. Claude CLI 설치·로그인은 확인됐으나 응답 시험이 완료되지 않아 중단했습니다. Antigravity 데스크톱 설치 항목은 보였으나 해당 모델/에이전트는 실행하지 않았습니다.

|실제 실행|역할|파일 소유권|
|---|---|---|
|총괄 Codex A|공통·메인·인증·최종 통합|server,api,views,public/site.css,package/lock,README,공통 문서|
|Codex B|Resume 보존 이관·DOM 검사|legacy/resume,public/resume,scripts/build-resume,tests/resume-ui|
|Codex C|Resume 이미지|assets-generated/resume,public/mascot/resume,이미지 기록|
|Codex D|Work 이미지|assets-generated/work,public/mascot/work,이미지 기록|
|Codex 업무 담당|Claude A 대체|work-app,private/work,import/upload,SQL,Work 검사|
|Codex 디자인·보안 담당|Claude B 대체|design-review,security tests/기록|
|Codex 최종 QA 담당|Antigravity 대체|public HTTP tests,final-qa|

모든 보조 에이전트는 원본 읽기 전용·최신 전체 요청을 전달받았습니다. 공통 파일 수정은 총괄 소유이며, 후속 역할 변경 시 범위를 명시했습니다. Claude·Antigravity가 실제 수행했다고 보고하지 않습니다.

## 다음 작업

1. 실제 브라우저에서 확인하지 못한 시각 검증 범위를 보완.
2. 실제 브라우저에서 390px·1440px 확인, Resume 탭·언어·모달과 Work 저장·일정 조정 점검.
3. Supabase 생성과 SQL 적용 후 허용 사용자 등록, 원격 자료 가져오기, 실제 RLS와 로그아웃 검사.
4. 검토 후 별도 요청에서 Vercel에 배포.

## 최종 수행 검사

- `npm run build`: 성공. 현재 원본 Resume 재빌드, 자산 존재, 서버·함수 구문, 보안 정책·업무 계약 TypeScript 검사.
- `npm test`: **43/43 통과**. 공개 HTTP6, Resume DOM8, 허브5, 보안19, Vercel 본문 어댑터2, Work DOM2, 자료 가져오기1. DOM은 jsdom 모의 실행이며 레이아웃 렌더가 아닙니다.
- `node scripts/check-running.mjs`: 실제 개발 서버에서 /·/resume·/work200, 허브·연구일지·실제 업무 사본 bootstrap·보호 첨부200, 비로그인 API401 확인. 별도 프로덕션 CLI에서 미리보기404·API401 확인. 기존 --dev 플래그를 전달해도 프로덕션 진입점은 권한을 열지 않습니다.
- `node scripts/audit-delivery.mjs`: Draft의 임시 비밀값 미복사, 공개 데이터 경계, 배포 제외, 프로덕션 차단, lockfile 직접 버전 일치 통과. 비밀값 자체는 로그에 출력하지 않았습니다.
- 원본 파일 보존: Resume36개 SHA-256 일치. 실제 업무 사본은 모의 편집 검사 중 변경하지 않았고 원본 소스는 읽기만 했습니다.
- PDF2페이지와 마스코트 원본·생성 결과는 직접 시각 확인. **홈페이지의 실제 브라우저 화면은 미확인**이며 스크린샷을 만들지 않았습니다.
- 외부 npm 신규 다운로드는 EACCES로 실패. 현재 build는 원본의 기존 의존성을 프로젝트로 복사해 실행했고, lockfile은 오프라인으로 정합화했습니다. 새 환경의 online npm ci는 아직 미검증입니다.
