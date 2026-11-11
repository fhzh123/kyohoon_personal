// Placeholder for icons (user will insert images here)
const IconPlaceholder = ({ src, alt }) => (
<div className="w-6 h-6 mr-2 flex-shrink-0 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
    {src && <img src={src} alt={alt} className="w-full h-full object-cover" />}
</div>
);

const honors_ = [
    {
      title: '우수 논문상',
      awarder: '한국전자공학회; 하계 종합 학술대회',
      year: '2023.06',
      description: ' "한국어 자소 특화 토큰화 및 평가 지표를 통한 복합된 형태의 한국어 문법 오류 수정" 논문으로 우수 논문상 수상.',
      icon: <IconPlaceholder src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSuWOjObRCdkIh_a0uZmOqhRSrDme_QSi66zQ&s" alt="Honor Icon 1" />,
    },
    {
      title: '총장상',
      awarder: '한국전자공학회; 하계 종합 학술대회; 중앙대학교 AI대학원 특별세션',
      year: '2022.06',
      description: '"Core-token Attention: 토큰 프루닝 기반 셀프 어텐션 경량화 메커니즘" 논문으로 총장상 수상.',
      icon: <IconPlaceholder src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSuWOjObRCdkIh_a0uZmOqhRSrDme_QSi66zQ&s" alt="Honor Icon 2" />,
    },
    {
      title: '우수 논문상',
      awarder: '한국정보과학회; 한국 컴퓨터 종합 학술대회',
      year: '2021.06',
      description: '"한국어 악성 댓글 탐지 시스템 성능 향상을 위한 HLI-BERT 모델 제안" 논문으로 우수상 수상.',
      icon: <IconPlaceholder src="https://yt3.googleusercontent.com/YjhBZTnB0bl_don90kKbgAPFhg0HcZrOG1CClIB4ANUY6X3pPwoQYI4CY3-0nRhVeMY4MCBRrQ=s900-c-k-c0x00ffffff-no-rj" alt="Honor Icon 3" />,
    },
    {
      title: '최우수 논문상',
      awarder: '한국정보과학회; 한국 컴퓨터 종합 학술대회; 학부생 논문 경진대회',
      year: '2019.06',
      description: '"텍스트 마이닝을 활용한 조선 왕위 교체 전후 시대 상황 분석" 논문으로 최우수상 수상.',
      icon: <IconPlaceholder src="https://yt3.googleusercontent.com/YjhBZTnB0bl_don90kKbgAPFhg0HcZrOG1CClIB4ANUY6X3pPwoQYI4CY3-0nRhVeMY4MCBRrQ=s900-c-k-c0x00ffffff-no-rj" alt="Honor Icon 3" />,
    },
    {
      title: '장려상',
      awarder: '한국정보화진흥원; 2018 빅콘테스트',
      year: '2018.12',
      description: '"유전 알고리즘을 활용한 이탈유저 예측 및 결제고객 파악" 주제로 장려상 수상.',
      icon: <IconPlaceholder src="https://thumb.mt.co.kr/06/2020/12/2020120911574388737_1.jpg" alt="NIA Icon" />,
    },
    {
      title: '특별상',
      awarder: '국토교통부; 제7회 교통데이터 공모전',
      year: '2018.07',
      description: '"D.P.I (Driving Pattern Identification)" 아이디어로 특별상 수상.',
      icon: <IconPlaceholder src="https://image.edaily.co.kr/images/photo/files/NP/S/2025/05/PS25051800177.jpg" alt="Honor Icon 3" />,
    },
    {
      title: '우수상',
      awarder: '국민체육진흥공단; 제1회 스포츠데이터 활용 경진대회',
      year: '2017.12',
      description: '"응원 농구 팀 추천 시스템 개발 제안 아이디어" 아이디어로 우수상 수상.',
      icon: <IconPlaceholder src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRYUk3mNd7DLWiKp-0oLT3Fmktd0aqfX4j3-Q&s" alt="KSPO Icon" />,
    },
    {
      title: '우수상',
      awarder: '경기콘텐츠진흥원; 제3회 경기 빅데이터 활용분석 경진대회',
      year: '2018.07',
      description: '"SNS와 날씨정보를 활용한 자살예측 알고리즘 개발" 주제로 우수상 수상.',
      icon: <IconPlaceholder src="https://pbs.twimg.com/profile_images/539223073686159360/pM7XH5dS_400x400.jpeg" alt="GCON Icon" />,
    },
    {
      title: '장려상',
      awarder: '경기콘텐츠진흥원; 제3회 경기 빅데이터 아이디어 공모전',
      year: '2017.12',
      description: '"공공기관의 API를 활용한 교통혼잡률 예측 시스템" 아이디어로 장려상 수상.',
      icon: <IconPlaceholder src="https://pbs.twimg.com/profile_images/539223073686159360/pM7XH5dS_400x400.jpeg" alt="GCON Icon" />,
    },
  ];

const lectures_ = [
    {
      title: '에이전트AI 최신 연구 동향',
      date: 'Jul 3, 2025',
      venue: '2025년도 IT21 글로벌 컨퍼런스',
      icon: <IconPlaceholder src="https://kips.or.kr/society/kips/homepage/bbs/downloadBoardImage?uploadedFileId=9342" alt="Lecture Icon 1" />,
    },
    {
      title: '멀티 에이전트 AI의 기술적 진보와 최신 연구 동향 ',
      date: 'Mar 2025 - Jun 2025',
      venue: '이화여대 데이터사이언스 대학원 세미나',
      icon: <IconPlaceholder src="https://i.namu.wiki/i/ayDlxOs9HFBzgePxztJKfSDiUuNd8B-9PcWMbTxBhr4kwAEqbHfVo9Cuahbfi-cLKW2VO3lJ47Wi52SBl-iaQg.svg" alt="Lecture Icon 2" />,
    },
    {
      title: '이미지와 자연어처리 코딩 실습',
      date: 'Sep 2024 - Feb 2025',
      venue: '중앙대학교 공과대학 학부생 수업',
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Lecture Icon 3" />,
    },
    {
      title: '논문으로 알아보는 최신 자연어처리 연구 동향',
      date: 'Sep 2024 - Feb 2025',
      venue: '중앙대학교 첨단영상대학원 세미나',
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Lecture Icon 3" />,
    },
    {
      title: 'AI 핵심동향',
      date: 'Jan 2023 - Feb 2023',
      venue: '군AI 교육지원사업',
      icon: <IconPlaceholder src="https://i.namu.wiki/i/hYff7QBRZlSKHMW53rcnhscbeoUg7Uicm85rkuzZbne_1V-7xtaOLPtE7Cyy7rVbUeLFBkWm4bPUbC4Ndtm_gA.svg" alt="Lecture Icon 4" />,
    },
    {
      title: '논문으로 알아보는 딥러닝 트렌드',
      date: 'Mar 2022 - Aug 2022',
      venue: '중앙대학교 첨단영상대학원 세미나',
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Lecture Icon 3" />,
    },
  ];

export { honors_, lectures_ };