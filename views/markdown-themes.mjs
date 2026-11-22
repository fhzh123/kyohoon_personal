export const DEFAULT_MARKDOWN_THEME = 'ivory';

export const MARKDOWN_THEMES = Object.freeze([
  Object.freeze({
    key: 'ivory',
    name: '아이보리',
    description: '따뜻한 미색 바탕에 세리프 본문',
  }),
  Object.freeze({
    key: 'github-dark',
    name: '깃허브 다크',
    description: '어두운 무채색 바탕에 정돈된 표와 코드 블록',
  }),
  Object.freeze({
    key: 'chrome',
    name: '크롬',
    description: '흑연 바탕에 은빛 제목과 하늘색 포인트',
  }),
  Object.freeze({
    key: 'sprinkles',
    name: '스프링클스',
    description: '밝은 고정폭 글꼴에 제목 이모지와 컬러 링크',
  }),
]);

export const MARKDOWN_THEME_KEYS = Object.freeze(MARKDOWN_THEMES.map(theme => theme.key));
