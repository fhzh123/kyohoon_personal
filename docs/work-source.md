# Work 원본 반영 기록

## 현재 범위

최초 확인 시 홈페이지 구상 Draft가 없었지만 작업 중 `Assets/Draft/초기구상_1/` Markdown과 참조 이미지, `초기구상_1.pdf`가 추가되었다. 해당 Markdown을 읽고 Work가 일반 연구 대시보드가 아니라 **로그인 후 6~7개 진입 버튼을 제공하는 업무 허브**임을 확인했다. 첫 세 항목은 연구일지, Ontology 연구 데모, Document Parsing 연구 데모이며 나머지는 공사 중 상태다. 총괄이 `/work` 허브를 구현하고, 이 하위 작업은 첫 번째 연구일지에 원본 Research Atlas를 이관했다. PDF 페이지의 시각 검토 결과는 총괄의 기록을 따른다. 이 작업은 실제 Claude가 아니라 내장 Codex가 Claude A의 담당 범위를 대체 수행했다.

실제로 읽은 원본은 홈페이지 Draft Markdown, `2027_연구기획/research-planner`의 HTML·JS·CSS·README, `data/workspace-state.json`, `sources/taxonomy-source.json`과 서버의 동기화 규칙이다. `Asset/Roadmap.png`, `Asset/Draft_Goal.png`는 시각적으로 확인했다. 업무의 `Draft_Goal.png`는 연구 목표 구조도이며 홈페이지 Draft와 다른 자료다. 기술 자산 맵 XLSX는 첨부 원본을 보관했으며 이 이관 작업에서 모든 셀을 재분석하지 않았다. Draft의 임시 로그인 정보는 코드·문서에 복사하지 않았으며, 상위의 명시적 보안 요구에 따라 Supabase 이메일 인증과 허용 사용자 권한을 적용한다.

## 실제 자료와 화면

- 현재 저장본은 version 4이고 목표 10개, 단계 5개, 연구 항목 36개, 노트 3개, 참조 이미지 5개다. 사용자 연구축과 기존의 중첩 연구도 보존했다.
- 기술 분류 JSON에는 L3 9개와 L4 30개, 각 출처 셀과 원문이 있다. 현재 저장본에 마이그레이션을 적용했을 때 데이터가 변하지 않음을 확인했다.
- 기존 앱의 연구 로드맵(주·월·연), 연간 조망, 연구 후보, L3 연구축, 연구 노트, 자료실, 설정 화면을 유지한다. 실제 저장본에서 계산하는 수치이며 통계나 연구 일정은 새로 만들지 않았다.
- 기존 연구 구간/세부 연구 편집, 기간 이동, 순서 변경, 연구 노트, 연구축, 색상 설정과 JSON 백업/가져오기의 구현을 이관했다. 브라우저 실제 동작 검증 결과는 총괄의 검증 기록에서 구분한다.
- 로컬 편집은 프로젝트 `private/work/workspace-state.json` 사본과 브라우저 저장소만 변경한다. 원본 경로는 쓰지 않는다.

## 보호된 파일 배치

`work-app/`에는 일반 화면 코드만 둔다. 실제 연구 내용이 들어 있던 `seed.js`는 복사하지 않았고, `taxonomy.js`의 실제 분류·이전 시드 상수도 제거했다. 승인된 `/api/work-bootstrap` 데이터 응답을 받은 다음에만 화면을 시작한다.

`private/work/`에는 현재 저장본, 이전 시드(`legacy-seed.json`), 기술 분류 원문(`taxonomy-source.json`), 가져온 원본 SHA-256 목록이 있다. 이미지와 XLSX는 모두 `private/work/assets/`에 두며 public 경로에 복사하지 않았다. 서버가 `/work/app/assets/<name>` 요청마다 인증·권한을 검증한 후 제공해야 한다. 공개 배포에서는 동일 자료를 Supabase의 비공개 Storage에 업로드하고 승인된 요청으로만 전달한다.

원본 이미지명의 한글 조합 방식(NFC/NFD) 차이로 파일이 깨지지 않도록 참조 경로만 영문 파일명으로 정규화했다. 문서 제목과 연구 내용은 바꾸지 않았다.

## 서버 연결 계약

`GET /api/work-bootstrap` 응답:

```json
{
  "workspace": {"revision": "opaque-revision", "state": {}},
  "taxonomySource": {},
  "legacySeed": {},
  "context": {"mode": "local", "storageKey": "user-and-mode-scoped-key"}
}
```

`context.mode`는 `local` 또는 `supabase`다. 저장소 키는 연결 상태와 사용자별로 구분한다. 원본 앱과 같은 로컬 저장소 키를 사용하지 않는다.

`GET /api/research-state`는 `{revision,state,updatedAt?}`를 반환한다. `PUT`은 `{revision,state}` JSON을 받고, 현재 revision과 같을 때 새 revision으로 저장한 응답을 반환한다. revision이 다르면 HTTP 409와 `{error,revision,state,updatedAt?}`를 반환한다. 클라이언트의 원본 충돌 비교·선택 기능을 유지한다.

서버는 version 1~4, 배열 `goals/phases/tasks/notes/references`와 본문 크기를 검증하고, GET·PUT·첨부 요청을 모두 권한으로 보호해야 한다. 상태 저장·조회는 실제 Supabase 설정 전에는 연결 완료로 표시하지 않는다. 원본 코드에 있던 localhost 전용 동기화 조건은 인증된 동일 출처 서버 연결에도 사용할 수 있도록 변경했다.

## 다시 가져오기

```text
node scripts/import-work.mjs "<업무 원본 루트>"
node scripts/import-work.mjs --source "<업무 원본 루트>"
```

원본 폴더에는 `research-planner/`와 `Asset/`이 있어야 한다. 실제 원본 경로는 실행 인수 또는 `WORK_SOURCE_DIR` 환경변수로 전달한다(`WORK_IMPORT_SOURCE`도 이전 호환용으로 지원). 실행 코드에 특정 컴퓨터의 경로를 넣지 않았다. 기존 프로젝트 저장본·분류·이전 시드와 이미 이관·수정된 앱 코드는 덮어쓰지 않는다. 다시 가져오면 첨부 사본을 갱신하고 처음 가져온 원본 manifest는 보존하며 별도 import-log에 출처 해시 기록을 추가한다. 실제 자료가 담긴 private 파일과 원본 자료를 버전 관리나 공개 배포에 포함하지 않는 규칙은 총괄의 ignore·배포 설정을 따른다.

## 확인한 검사와 남은 일

- `work-app/*.js` Node 구문 검사 통과.
- 현재 상태에 일반화한 분류 마이그레이션을 적용한 결과 version·항목·내용 동일.
- 참조 이미지 5개가 모두 보호된 영문 첨부 경로로 연결됨을 확인.
- 원본 연구 로드맵과 목표 구조도 시각 확인 완료.
- Draft에서 연구일지를 기존 연구 기획 앱으로 연결하도록 요구한 부분을 이관했다. 로그인과 허브의 나머지 항목은 총괄이 통합한다.
- reader 계정은 검색·탐색·상세 읽기만 가능하도록 편집·추가·삭제·기간 이동·순서 변경·가져오기·저장 컨트롤을 차단했다. 서버·DB의 권한 확인도 별도로 유지한다.
- `node --test tests/work-dom.test.mjs tests/work-import.test.mjs`의 검사 3개가 통과했다. jsdom으로 7개 내부 화면의 탐색, 실제 저장본 항목 수, 검색, 연구 상세창과 모의 API 저장, reader의 편집 차단·PUT 미발생을 확인했다. 실제 업무 파일의 저장 전후 해시는 같았다. 별도 가짜 폴더에서 가져오기 인수 3가지와 재실행 시 코드·저장본 보존을 검사했다. 실제 브라우저 화면을 본 검사는 아니다.
- 모바일 topbar에 홈·업무 홈·로그아웃을 추가하면서 발생할 수 있는 고정 높이·줄바꿈 문제를 CSS에서 조정했다. 이는 정적 코드 검토이며 모바일 시각 확인 완료로 보고하지 않는다.
- Supabase 연결·실제 RLS 실행 검증과 실제 브라우저 시각 검증은 이 하위 작업에서 수행하지 않았다. DOM 시뮬레이션 검사는 실제 렌더링·모바일 검증으로 간주하지 않는다.
