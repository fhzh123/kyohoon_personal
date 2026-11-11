# 콘텐츠 출처와 보존

- 개인 PR 원본: 사용자가 지정한 `my-portfolio-app`. src 전체·데이터 모듈·글꼴·public·설정·lockfile을 `legacy/resume/`로 가져왔습니다. 문구·순서·디자인을 편집하지 않았습니다. 상세 해시는 `legacy/resume/source-manifest.json`과 [이관 기록](resume-migration.md)을 참고하세요. 기존 외부 이미지·논문·프로젝트 링크는 원래 주소를 유지합니다.
- 포트폴리오의 기존 build는 현재 src와 Publications의 반응형 padding 한 곳이 달라 비교용으로만 보관했습니다. 최종 결과는 현재 src를 다시 빌드합니다.
- 마스코트: 기존 `Assets/02_웹개발_전달용_v9.zip`의 정면 대기 PNG. 추출본은 assets-extracted에 있으며 Assets 원본은 보존했습니다. 생성 두 장의 원본 참조와 실제 프롬프트는 [Resume 이미지](image-resume.md), [Work 이미지](image-work.md)에 기록했습니다.
- 업무: 사용자 지정 `2027_연구기획/research-planner/`의 현재 코드·workspace-state·taxonomy-source와 `Asset/`의 연구 자료. [업무 기록](work-source.md)에 원본과 변경 범위를 기록했습니다. 원본 경로는 가져오기 때만 입력하며 런타임에 고정하지 않습니다.
- 업무 데이터는 원래 저장본의 목표10·단계5·연구36·노트3·참조5를 보존했습니다. 별도의 연구 내용·일정·예산·성과를 만들지 않았습니다. 원문 이미지의 과거 계획과 현재 확정 일정은 같은 것으로 간주하지 않습니다.
- 홈페이지 Draft는 작업 중 추가된 `Assets/Draft/초기구상_1/` Markdown과 `초기구상_1.pdf`입니다. Markdown 전체와 두 화면 이미지(메인 선택 영역·로그인 예시)를 읽고 보았습니다. PDF도 2페이지 전체를 실제 렌더링하여 직접 시각 확인했습니다. 업무 `Draft_Goal.png`는 홈페이지 구상 문서와 다른 자료입니다. Draft에 적힌 임시 비밀번호는 구현 코드·작업 문서에 옮기지 않았으며 Supabase 인증 원칙이 우선합니다.

업무 첨부와 상태는 private/work 아래에만 있으며 public JSON·소스맵·공개 정적 번들에 포함하지 않습니다. 배포 함수는 private 폴더를 제외하고 실제 배포에서는 Supabase의 허용 사용자 권한으로 조회합니다.
