# Resume 보존 이관

원본: `C:\Users\fhzh\my-portfolio-app` (읽기 전용). 새 프로젝트의 `legacy/resume`에 원본 `src`, `public`, Tailwind/PostCSS 설정, package 및 lockfile을 복사했다. 원본에서 설치·실행·빌드·파일 수정을 하지 않았다.

## 보존 범위

- `App.js` 및 여섯 데이터 모듈, `index.css`, 원본 폰트와 공개 자산을 그대로 보존한다.
- 소개·경력·학력·프로젝트·논문·강의·수상·특허의 문구와 순서, 한영 전환, 프로젝트 상세창, KakaoTalk QR 창, 프로필 뒤집기, 화면 폭에 따른 배경 전환을 재구성하지 않는다.
- 이미지와 외부 링크 주소는 원본 값을 유지한다. 외부 호스트의 응답이나 네트워크 상태에 따른 로딩 실패 가능성도 원본과 같다.
- 원본 `App.css`는 원본 진입점에서 import하지 않으므로 새 번들에도 추가하지 않는다.

## 이관에 필요한 기술적 변경

1. CRA 실행기를 추가로 유지하는 대신 `scripts/build-resume.mjs`가 원본에 설치되어 있던 Webpack 5·Babel·Tailwind 3으로 원본 코드를 독립 번들로 빌드한다. 네트워크 설치가 차단되어 사용 가능한 기존 의존성을 작업 폴더로 복사해 실행했으며, 원본 `node_modules`를 가리키는 링크는 사용하지 않는다. `legacy/resume/mount.jsx`는 원본과 같은 React StrictMode에서 App을 mount하는 진입점이다. 호출 인자가 없어 실행하지 않던 `reportWebVitals` import만 새 진입점에서 생략한다.
2. 원본 HTML의 `%PUBLIC_URL%`를 `/resume`로 치환한다. JS/CSS와 폰트·아이콘·manifest는 `/resume/` 아래에서 제공한다.
3. `/resume`은 홈페이지의 공통 레이아웃이 끼지 않는 독립 HTML 응답이다. iframe이나 외부 사이트가 아니며 같은 프로젝트에서 실행한다. 메인의 이동은 일반 `<a>`로 문서 전체를 탐색한다.
4. 메인·Work 전역 스타일이 해당 문서에 주입되지 않으므로 기존 body·Tailwind preflight·폰트 스타일이 보존된다.

## 원본 확인과 검증 자료

- `legacy/resume/source-manifest.json`은 복사 당시 원본 파일별 SHA-256이다. 아래 명령으로 보존된 사본을 다시 검사할 수 있다.
- `artifacts/resume-baseline/build`는 원본 경로에 이미 있던 빌드 결과의 읽기 전용 복사본이다. 이 복사본만 별도 정적 서버에서 열어 이관본과 비교한다. **기존 빌드가 현재 소스보다 오래되었다.** 원본 JS source map의 App.js와 현재 소스를 대조한 결과 Publications 컨테이너 한 줄의 `md:p-4`가 현재는 `md:p-3`이다. 이관본은 사용자 원본의 현재 소스(`md:p-3`)를 따른다. 따라서 이 영역의 기존 빌드 스크린샷과 픽셀 일치를 주장하지 않는다.
- `node scripts/build-resume.mjs`로 실제 production 번들 생성에 성공했다. Webpack 빌드 오류는 없었고, caniuse-lite DB가 오래되었다는 안내만 있었다. 브라우저 시각 검증 결과는 프로젝트 작업 현황의 최종 기록을 따른다.

```powershell
node -e "const fs=require('fs'),c=require('crypto'),p=require('path');const r='legacy/resume';const m=JSON.parse(fs.readFileSync(p.join(r,'source-manifest.json')));for(const [f,h] of Object.entries(m.files)){if(c.createHash('sha256').update(fs.readFileSync(p.join(r,f))).digest('hex')!==h)throw Error(f)}console.log('Original source copies match recorded hashes')"
```
