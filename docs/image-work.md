# Work 마스코트 이미지

담당: 실제 실행한 Codex D. 내장 image_gen을 원본 참조 편집 모드로 1회 호출하여 제작했다. Draft Markdown·PDF는 당시 작업 폴더에서 찾지 못해 확인하지 않았으며, 사용자 프롬프트에 명시된 연구·문서 정리 장면과 총괄의 공통 기준을 따랐다.

참조: `assets-extracted/robot-web-assets-v9/frames/512/down-idle.png`.

생성 원본: `assets-generated/work/work-original.png` (1254×1254). 웹 적용: `public/mascot/work.png` (768×768 RGBA, 453,662 bytes). 총괄이 원본에서 투명도를 보존해 크기 최적화했다. WebP는 제작하지 않았다. 원본 마스코트는 변경하지 않았다. 생성 도구가 자동 관리하는 기본 출력에서 프로젝트로 복사했다.

시각 검토: 정면, 흰 후드, 검은 얼굴, 두 청록색 눈, 오른쪽 회색 지느러미·파란 패치·꼬리, 파란 끈 유지. 작은 파란 책상·노트북·빈 종이 묶음과 두 신발이 보인다. UI 문구 없음. PNG 헤더 검사에서 실제 크기 1254×1254, 8비트 RGBA(color type 6)를 확인했다. 투명 배경으로 요청했으며 웹용 파일에서도 알파를 보존해야 한다. Resume와 나란히 놓은 최종 일관성 검토는 총괄이 수행한다.

## 실제 제작 프롬프트

```text
Use case: identity-preserve.
Asset type: main website Work selection illustration, square transparent PNG.
Input image is the canonical mascot identity reference and edit target. Create a new work pose of EXACTLY this same character, preserving the face, head proportions, clothing, colors, rendering style and asymmetrical identifying details.
Scene: the mascot is seated at a compact pale blue research desk, working with a slim blue laptop and a tidy small stack of blank papers. One white mitten hand rests on the laptop and the other arranges a paper. The face and both eyes are fully visible above the desk. Short rounded white shoes are visible below the desk. Desk is simple and small, no background scene.
Identity locked: oversized round white hood/head, glossy dark navy-black rounded face screen, exactly two vertical pale cyan glowing capsule eyes at the original spacing, no mouth, gray crown fin leaning toward screen right, single blue patch on upper screen right of head, white hoodie with bright blue drawstrings, blue tail behind screen right hip, white mitten hands, short white legs and rounded white shoes. Do not mirror these asymmetrical details. Keep the same toy-like body/head ratio. Preserve the original clean soft 3D toy material, gentle highlights, smooth rounded surfaces. The mascot is not a different generic robot.
Composition: front-facing camera at the reference's eye-height, whole character and compact desk centered together, subject plus props fill about 80% of square height, approximately 12% safe transparent margin; no clipped feet, fin, desk or props. Soft neutral studio lighting matching reference. No floor, no ground shadow, no room, no backdrop. Actual transparent alpha surrounding the illustration.
Color: original white, glossy navy-black, cyan eyes, cobalt blue details; pale blue desk and blue laptop. No recoloring the mascot.
No text, letters, numbers, logo, watermark, caption, UI, button labels or checkerboard. One mascot only. This must pair with a standing presentation pose made from the same reference and same lighting.
```
