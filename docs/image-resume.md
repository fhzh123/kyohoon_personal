# Resume 마스코트 제작

- 담당: Codex C (내장 Codex 에이전트)
- 도구: 실제 내장 image_gen 호출, 원본 마스코트 참조 편집
- 원본 참조: `assets-extracted/robot-web-assets-v9/frames/512/down-idle.png`
- 생성 원본: `assets-generated/resume/resume-generated.png`
- 웹 적용: `public/mascot/resume.png` (768×768, 투명 RGBA PNG). 생성 원본 1280×1280과 별도 보관하고 웹 사본만 축소함.
- 장면: 정면에서 열린 손으로 소개하며 파란 발표 폴더를 든 마스코트.
- 확인: 기존 흰 후드, 검은 얼굴과 세로 하늘색 눈, 회색 핀, 화면 오른쪽 파란 패치와 꼬리, 3D 그림체를 유지. UI 글자는 없음.
- Draft Markdown·PDF는 제작 당시 찾지 못했으므로 확인했다고 간주하지 않음. 총괄이 사용자에게 위치를 요청함.

## 사용한 최종 프롬프트

```text
Use case: identity-preserve.
Asset type: one square transparent mascot illustration for a personal research homepage's Resume selection.
Input image: canonical identity reference, not a generic robot. Preserve the exact existing character.
Primary request: edit this same mascot into a friendly researcher introducing their work. Full body standing in a relaxed front-facing pose, its right mitten on SCREEN LEFT raised open in a welcoming presenting gesture; its other mitten holds a slim unmarked blue presentation folder at the side. No additional board needed.
Identity locked: oversized rounded white hood/head and glossy rounded black face screen; exactly two vertical cyan-blue capsule eyes with same spacing; gray crown fin leans toward SCREEN RIGHT; single blue patch on UPPER SCREEN RIGHT of head; white hoodie with blue drawstrings, white mitten hands, short legs, rounded white shoes; blue tail behind SCREEN RIGHT hip. Same head/body proportions and exact soft polished 3D toy rendering, white and gray material with original cobalt accents, do not mirror identity details or recolor the character.
Composition: one character only, centered, front camera at eye height, full body visible; square canvas, character including fin occupies about 80% canvas height, 12% safe margin, even negative space, folder small and secondary. Soft neutral studio lighting. Genuine transparent background with smooth clean alpha edges, fully opaque character. No floor or background, no shadow outside silhouette, no text, no letters, no UI labels, no logo, no watermark. Keep this a series-ready minimal scene.
```

