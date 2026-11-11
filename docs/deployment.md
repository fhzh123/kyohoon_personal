# Vercel · Supabase 연결 준비

이번 작업에서 서비스 생성, 결제, 외부 자료 업로드, 공개 배포, 도메인 연결은 수행하지 않았다. 실제 Supabase 인증·DB·Storage 연결과 원격 RLS 검증도 아직 수행하지 않았다. 아래는 사용자가 자신의 프로젝트에서 진행할 설정이다.

## 1. Supabase 프로젝트와 권한

1. 사용할 Supabase 프로젝트를 만든다. 요금제나 리전을 직접 선택한다.
2. SQL Editor에서 `supabase/schema.sql`을 실행한다. 이 파일은 실제 연구 내용과 비밀값을 포함하지 않는다.
3. Authentication의 이메일/비밀번호 로그인을 활성화하고 **Allow new users to sign up(공개 회원가입)을 끈다.** 익명 로그인도 사용하지 않는다. 이 웹사이트에는 회원가입 기능이 없다.
4. Authentication Users에서 허용할 사용자만 직접 생성하거나 초대한다. 앱이 관리자를 자동 생성하거나 로그인 이메일만 보고 권한을 부여하지 않는다.
5. 생성한 계정의 실제 UUID로 아래 SQL을 직접 실행한다. 자리표시자를 반드시 바꾸며, 비밀번호를 SQL에 넣지 않는다.

```sql
insert into public.workspace_members (user_id, role, active)
values ('00000000-0000-0000-0000-000000000000'::uuid, 'editor', true);
-- 읽기 전용 사용자는 role을 'reader'로 지정한다.
```

권한을 중지할 때는 해당 사용자의 `active=false`로 변경한다. 허용 사용자는 현재 하나의 연구 공간을 공유한다. 개인별 별도 연구 공간이 필요한 경우 현재 스키마를 그대로 확장 배포하지 말고 workspace별 membership으로 바꿔야 한다.

`workspace_members`는 본인 행 조회만 허용하며 회원 추가·역할 변경을 클라이언트에 허용하지 않는다. `workspaces`는 활성 허용 사용자만 읽고 editor만 상태를 변경한다. 웹 서버는 사용자 토큰 검증과 회원 확인을 매 요청 수행하며 DB에서도 RLS를 적용한다. 상태·분류·이전 시드는 실제 원본의 관계를 보존하기 위해 JSONB로 저장한다.

첨부는 **비공개** `work-attachments` 버킷의 `research/<영문파일명>`에 저장한다. DB 권한과 별도로 Storage RLS도 적용한다. 공개 URL이나 public 버킷으로 전환하지 않는다. [Supabase RLS 안내](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage 권한 안내](https://supabase.com/docs/guides/storage/security/access-control)

## 2. 실제 자료 최초 가져오기

먼저 프로젝트 로컬 자료가 필요한 경우 다음 명령으로 가져온다. 인수는 자신의 컴퓨터에 있는 업무 원본 루트다. 원본 폴더에는 파일을 쓰지 않는다.

```text
node scripts/import-work.mjs "<업무 원본 루트>"
node scripts/upload-work.mjs --dry-run
```

프로젝트 `private/work/`의 현재 저장본·분류·이전 시드와 보호된 첨부를 확인한다. 가져오기 스크립트는 기존 프로젝트 저장본을 덮어쓰지 않는다. 로컬에서 새로 편집했다면 그 사본이 업로드 대상이다.

실제 업로드를 선택한 경우에만, 로컬의 별도 `.env.upload.local`에 자신의 `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`를 설정한다. 실제 키를 코드·문서·채팅·명령줄 인수에 적지 않는다. `.env.upload.local`은 커밋하지 않으며 Vercel에 업로드하지 않는다.

```text
node --env-file=.env.upload.local scripts/upload-work.mjs --upload
```

기본 실행과 `--dry-run`은 네트워크 요청을 하지 않는다. `--upload`는 직접 선택한 프로젝트에 실제 업무 자료를 전송한다. 이 스크립트는 `.supabase.co` HTTPS 프로젝트 URL에만 업로드하며 기존 원격 연구 공간과 첨부파일을 덮어쓰지 않는다. 최초 가져오기 도중 실패하면 이미 업로드된 비공개 첨부는 유지된다. 재실행 전 Supabase 대시보드에서 중간 상태를 확인하고 처리한다. 이 스크립트는 자료 삭제·자동 롤백·기존 데이터 교체를 하지 않는다.

`service_role` 키는 최초 가져오기에만 사용한다. 웹 서버는 이 키를 읽지 않고, 일반 사용자 로그인 토큰과 anon/publishable API 키로 RLS를 적용한다. 최초 가져오기 후 업로드 전용 환경값을 정리하고 필요한 경우 프로젝트의 키 관리 화면에서 회전한다.

## 3. Vercel 설정

1. 공개 배포를 결정한 뒤 이 프로젝트를 Vercel에 연결한다. 현재는 Node 22 + 단일 Node 서버리스 함수이며 별도 DB 서버를 만들지 않는다.
2. Framework Preset은 Other, Build Command는 `npm run build`를 사용한다. Node 버전은 `package.json`의 조건과 맞춘다. 경로별 서버리스 진입점과 파일 포함 범위는 `vercel.json`에 있다.
3. Vercel 환경변수에 `SUPABASE_URL`, `SUPABASE_ANON_KEY`만 설정한다. `SUPABASE_SERVICE_ROLE_KEY`, DB 비밀번호, 업로드 전용 환경파일을 넣지 않는다. `LOCAL_WORK_PREVIEW=0`으로 설정한다.
4. `.vercelignore`와 함수 제외 규칙이 `private/`, 원본 Assets, 생성 원본, 검증 스크린샷·업무 데이터 파일을 제외하는지 확인한다. `work-app/` 일반 코드만 함수에 포함하고 실제 내용은 DB와 비공개 Storage에서 가져온다.
5. Supabase Auth의 Site URL을 실제 HTTPS 서비스 주소로 지정한다. 초대·비밀번호 재설정에 필요한 Redirect URLs도 해당 서비스 주소로 제한한다. 현재 앱 로그인은 이메일·비밀번호이며 회원가입·비밀번호 재설정 화면은 별도로 구현하지 않았다.

프로덕션에서는 NODE_ENV·VERCEL·실행 모드·loopback 조건으로 로컬 미리보기를 차단한다. 설정이 없어도 공개 메인과 Resume는 보이며 Work는 인증 설정 안내를 표시한다. 설정 실패를 이유로 로컬 자료를 자동 노출하지 않는다.

## 4. 연결 후 실제 확인할 항목

- 비로그인과 허용되지 않은 로그인 계정으로 Work HTML·bootstrap·상태 API·첨부가 차단되는지.
- reader 계정은 DB와 API에서 상태 수정이 거부되고 editor 계정만 저장되는지.
- 허용 사용자 비활성화 후 다음 요청이 차단되는지.
- anon 키로 DB와 Storage를 직접 요청해 실제 연구 내용이 나오지 않는지.
- 두 창의 동시 수정 시 revision 충돌이 발생하고 한쪽 저장본을 조용히 덮어쓰지 않는지.
- 공개 배포에서 `/work/preview`와 원본 private 경로가 열리지 않는지.
- 로그인·로그아웃·토큰 갱신·첨부 표시와 실제 DB 저장을 각 계정으로 확인할 것.

이 검증은 로컬 검사를 통과했다는 이유로 완료로 간주할 수 없다. 실제 Supabase 연결 후의 결과를 별도로 기록해야 한다. 작업 중 추가된 홈페이지 Draft에 따라 Work는 연구일지·연구 데모 진입 허브로 통합한다. 외부 데모 사이트의 별도 접근 권한은 이 홈페이지의 Supabase 권한과 별개이므로 해당 사이트에서도 필요한 접근 설정을 확인한다.
