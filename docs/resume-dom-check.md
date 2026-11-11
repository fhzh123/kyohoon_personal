# Resume DOM 실행 검사

검사 환경: Node.js 22.17.0, jsdom 16.7.0, React 19.1.0 production 번들.

```text
node scripts/build-resume.mjs
node --test tests/resume-ui.test.mjs
```

실제 실행 결과: **8개 검사 통과, 실패 0개**. jsdom에서 출력 HTML을 읽고 실제 `public/resume/resume.js`를 실행한 뒤 DOM의 컨트롤을 클릭하여 상태 변화를 확인했다. 원격 이미지·스타일·스크립트를 자동으로 가져오는 옵션은 사용하지 않았다.

## 확인한 범위

1. 원본에서 복사한 36개 파일의 SHA-256이 기록값과 일치한다.
2. 독립 HTML에는 `/resume/resume.css` 하나와 `/resume/resume.js`만 포함된다. 메인·Work CSS나 iframe이 없고, HTML의 로컬 아이콘·manifest·스크립트·폰트 참조 대상이 존재한다.
3. 원래 이름과 한국어 소개, 여섯 탐색 탭, 앞·뒷면 프로필 이미지 주소로 초기 화면 DOM이 생성된다.
4. Experience, Education, Projects, Publications, Lecture & Honors, Patent 탭을 선택하면 실제 콘텐츠와 선택 상태가 바뀐다. 국제·국내 논문, 강의·수상 하위 탭도 전환된다.
5. 데스크톱 라디오와 모바일 언어 버튼으로 한영 소개와 선택 상태가 바뀐다.
6. `innerWidth`와 resize 이벤트에 따라 원래 데스크톱·모바일 배경 이미지 URL이 선택된다.
7. 프로젝트 상세창이 열리고, 원본 외부 링크가 있으며, 이미지 오류 이벤트 후 로딩 상태가 해제되고, 닫기 버튼과 배경 클릭으로 닫힌다.
8. 프로필 앞·뒷면 회전 상태와 KakaoTalk QR 창 열기·닫기가 동작한다.

각 실행에서 동기 예외·React 오류·jsdom 오류가 발생하지 않는지도 확인했다.

## 발견하여 수정한 실제 오류

첫 DOM 실행에서 `React is not defined`가 발생했다. 원본 데이터 모듈은 React import 없이 JSX를 사용하는데, 이관 빌드의 Babel 설정이 classic JSX runtime이었던 것이 원인이다. 원본 CRA와 같은 **automatic JSX runtime**으로 빌드 설정만 수정하고 production 번들을 다시 생성했다. 원본 App·데이터·스타일 파일은 수정하지 않았다. 수정 후 위 8개 검사가 모두 통과했다.

## 확인하지 못한 범위

이 결과는 **실제 브라우저의 시각 검증이 아니다**. jsdom은 화면을 그리지 않으므로 데스크톱·모바일 레이아웃, 글꼴의 실제 모양, 줄바꿈, CSS 애니메이션, hover/focus의 가시성, 이미지 로딩 성공 여부, 외부 링크 대상의 정상 응답을 검증하지 못한다. 브라우저 접근이 복구되면 실제 화면 비교와 키보드 탐색 검사를 진행해야 한다.

`artifacts/resume-baseline/build`의 기존 CRA 빌드는 현재 원본 소스보다 오래되었으며 Publications 여백 클래스가 다르다. 해당 빌드와 픽셀 일치를 확인했다고 주장하지 않는다.
