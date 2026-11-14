// Placeholder for icons (user will insert images here)
const IconPlaceholder = ({ src, alt }) => (
<div className="w-6 h-6 mr-2 flex-shrink-0 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
    {src && <img src={src} alt={alt} className="w-full h-full object-cover" />}
</div>
);

const projects_ = [
    {
      title: 'DATUMO 플랫폼 내 모니터링 대시보드 개발',
      period: 'Feb 2026 - Aug 2026',
      description: '',
      link: '#', // This link is now used to trigger the modal
      icon: <IconPlaceholder src="https://logo-resources.thevc.kr/organizations/200x200/a72b6be358f7e753fd51ef4e011070dfe7298e32f8979cd099e0a5fb5d690e39_1691372959298758.jpg" alt="Project Icon 1" />,
      // Detailed fields for modal
      imageUrl: '', // Image for project detail
      subtitle: '',
      fullDescription: '',
      companyOrInstitution: '',
      role: '',
      externalLinks: [],
    },


    {
      title: '기업 문서 내 텍스트, 이미지, 표 추출을 위한 OCR & DLA 원천기술 개발',
      period: 'Jan 2026 - ',
      description: '',
      link: '#', // This link is now used to trigger the modal
      icon: <IconPlaceholder src="https://logo-resources.thevc.kr/organizations/200x200/a72b6be358f7e753fd51ef4e011070dfe7298e32f8979cd099e0a5fb5d690e39_1691372959298758.jpg" alt="Project Icon 1" />,
      // Detailed fields for modal
      imageUrl: '', // Image for project detail
      subtitle: '',
      fullDescription: '',
      companyOrInstitution: '',
      role: '',
      externalLinks: [],
    },
    {
      title: '독자 AI 파운데이션 모델 프로젝트 (SKT 컨소시엄)',
      period: 'Oct 2025 - ',
      description: "- 과학, 법률, API 및 DB 분야의 고난도 LLM 학습 데이터 생성 <br /> - LLM 기반 난이도 고도화와 자동 검증 파이프라인 개발",
      link: '#', // This link is now used to trigger the modal
      icon: <IconPlaceholder src="https://logo-resources.thevc.kr/organizations/200x200/a72b6be358f7e753fd51ef4e011070dfe7298e32f8979cd099e0a5fb5d690e39_1691372959298758.jpg" alt="Project Icon 1" />,
      icon2: <IconPlaceholder src="https://static.wikia.nocookie.net/logo-timeline/images/5/50/Network_T.jpeg/revision/latest?cb=20230515203924" alt="Second Project Icon" />, // Added second icon
      // Detailed fields for modal
      imageUrl: "/resume/projects/foundation-data-pipeline.png", // Image for project detail
      subtitle: "전문 분야의 고난도 학습 데이터 생성 및 검증",
      fullDescription: "SKT 컨소시엄의 독자 AI 파운데이션 모델 프로젝트에서 셀렉트스타는 대규모 학습 데이터 구축 및 검증을 담당했습니다. 이 가운데 소속 팀은 과학, 법률, API 및 DB 분야의 데이터 생성과 검증을 수행했습니다. 원천자료에서 LLM으로 문항과 풀이를 생성하고, 복합 조건과 추론 단계를 추가해 난이도를 높인 뒤 LLM 검증과 최종 사람 검수를 거치는 파이프라인을 개발했습니다. 과학은 대학원 이상, 법률은 법률 전문가, API 및 DB는 학부 이상 코딩 수준을 목표로 데이터를 구성했습니다.",
      companyOrInstitution: "SKT 컨소시엄",
      role: "과학, 법률, API 및 DB 분야 학습 데이터 생성 및 검증 파이프라인 개발",
      externalLinks: [{ name: '관련 기사 (SK텔레콤)', url: 'https://news.sktelecom.com/219714' }],
    },
    {
      title: '(경기도 교육청) AI-데이터 중심의 경기교육 디지털 플랫폼 사업',
      period: 'Oct 2025 - Dec 2025',
      description: "- 초중고 평가계획서 초안 생성을 위한 LLM 데이터 증강 파이프라인 구축 <br /> - LLM-Judge 기반 자동평가 구성",
      link: '#', // This link is now used to trigger the modal
      icon: <IconPlaceholder src="https://logo-resources.thevc.kr/organizations/200x200/a72b6be358f7e753fd51ef4e011070dfe7298e32f8979cd099e0a5fb5d690e39_1691372959298758.jpg" alt="Project Icon 1" />,
      icon2: <IconPlaceholder src="https://www.goe.go.kr/resource/old/BBSMSTR_000000000163/BBS_202203230959030481.png" alt="Second Project Icon" />, // Added second icon
      // Detailed fields for modal
      imageUrl: "/resume/projects/goe-platform.png", // Image for project detail
      subtitle: "경기교육 AI 플랫폼을 위한 학습 및 평가 데이터 구축",
      fullDescription: "LG CNS와 협력하여 경기도교육청 AI 플랫폼의 모델 학습 및 평가를 위한 데이터를 구축했습니다. 경기도교육청의 초중고 평가계획서 관련 문서와 예시를 정리하고, 소수의 예시를 입력하면 학교별 평가계획서 초안을 생성하는 LLM 기반 데이터 증강 파이프라인을 개발했습니다. 이와 함께 프롬프트 기반 LLM-Judge 자동평가를 구성했습니다.",
      companyOrInstitution: "LG CNS",
      role: "평가계획서 초안 생성 및 데이터 증강 파이프라인 개발, LLM-Judge 자동평가 구성",
      externalLinks: [{ name: '관련 기사 (경기도교육청)', url: 'https://www.goe.go.kr/goe/na/ntt/selectNttInfo.do?nttSn=108910&mi=10102&searchAt1=ADIT1_COLUMN&searchValue1=%EB%8F%84%EA%B5%90%EC%9C%A1%EC%B2%AD' }],
    },
    {
      title: '[삼성생명 C-Lab] LLM내 정형데이터 연결 및 내제지식화 기술 개발',
      period: 'Jun 2025 - Dec 2025',
      description: '- 방대한 양의 정형데이터를 LLM에 효과적으로 내제지식화 하는 기술 개발 <br /> - 이를 통한 사내 정형 데이터 기반 의사결정 목표',
      link: '#', // This link is now used to trigger the modal
      icon: <IconPlaceholder src="https://logo-resources.thevc.kr/organizations/200x200/a72b6be358f7e753fd51ef4e011070dfe7298e32f8979cd099e0a5fb5d690e39_1691372959298758.jpg" alt="Project Icon 1" />,
      icon2: <IconPlaceholder src="https://image.ajunews.com/content/image/2022/04/12/20220412133454615065.jpg" alt="Second Project Icon" />, // Added second icon
      // Detailed fields for modal
      imageUrl: 'https://github.com/fhzh123/image_upload_for_kyohoon/blob/main/Project_ATA.png?raw=true', // Image for project detail
      subtitle: '정형데이터 연결 및 내제지식화 기술 개발',
      fullDescription: '삼성생명은 독자적으로 방대한 양의 고객 정형 데이터를 보유하고 있지만, 이를 LLM에 효과적으로 연결하고 활용하는 기술이 부족했습니다. 이 프로젝트에서는 LLM과 정형 데이터를 연결하여 내제지식을 생성하는 기술을 개발했습니다. 이를 통해 고객 맞춤형 서비스 제공 및 데이터 기반 의사결정 지원을 목표로 하고 있습니다.',
      companyOrInstitution: '삼성생명',
      role: '정형 데이터 분석 파이프라인 개발 및 LLM 내제지식화 기술 구현',
      externalLinks: [
        // { name: 'GitHub Repository', url: 'https://github.com/your_github/project-a' },
        { name: '관련 기사 (News)', url: 'https://wowtale.net/2025/10/30/249506/' },
      ],
    },
    {
      title: '금융 도메인 특화 문서간 연결 및 메타데이터 구축 기술 개발',
      period: 'Mar 2025 - Jun 2025',
      description: '- 금융 도메인에 특화된 문서간 연결 및 메타데이터화 기술 개발 <br /> - 금융 데이터의 효율적인 관리 및 활용 목표',
      link: '#',
      icon: <IconPlaceholder src="https://logo-resources.thevc.kr/organizations/200x200/a72b6be358f7e753fd51ef4e011070dfe7298e32f8979cd099e0a5fb5d690e39_1691372959298758.jpg" alt="Project Icon 2" />,
      // Detailed fields for modal
      imageUrl: 'https://github.com/fhzh123/image_upload_for_kyohoon/blob/main/Project_KHTS.jpg?raw=true',
      subtitle: '금융 도메인 특화 문서간 연결 및 메타데이터 구축',
      fullDescription: '금융 도메인에서의 텍스트 데이터 활용을 극대화하기 위해, 다양한 금융 문서 간의 정보를 연결하고 문서의 메타데이터를 구축하는 기술을 개발했습니다. 이를 통해 금융 데이터의 효율적인 관리 및 활용을 지원하고, 데이터 기반 의사결정 프로세스를 개선하는 것을 목표로 하고 있습니다.',
      companyOrInstitution: '',
      role: '메타데이터화 기술 개발 및 데이터 연결 파이프라인 구축',
      externalLinks: [
        // { name: '데모 영상', url: 'https://youtube.com/your_demo_video' },
      ],
    },
    {
      title: 'RAG 평가용 데이터셋 합성 기술 연구',
      period: 'Mar 2025 - Jul 2025',
      description: '- RAG 시스템의 성능 평가를 위한 원천문서 기반 질의응답 데이터셋 합성 기술 연구 <br /> - EMNLP 2025 논문 두편 투고',
      link: '#',
      icon: <IconPlaceholder src="https://logo-resources.thevc.kr/organizations/200x200/a72b6be358f7e753fd51ef4e011070dfe7298e32f8979cd099e0a5fb5d690e39_1691372959298758.jpg" alt="Project Icon 3" />,
      // Detailed fields for modal
      imageUrl: 'https://github.com/fhzh123/image_upload_for_kyohoon/blob/main/GRADE_Overall_Figure.png?raw=true',
      subtitle: 'RAG 평가용 데이터셋 합성 기술 연구',
      fullDescription: 'RAG 시스템의 성능 평가를 위한 원천문서 기반 질의응답 데이터셋 합성 기술을 연구했습니다. 이를 통해 EMNLP 2025에 두 편의 논문을 투고하였습니다.',
      companyOrInstitution: '한화생명',
      role: 'RAG 시스템 성능 평가 데이터셋 합성 기술 연구 및 논문 작성',
      externalLinks: [],
    },
    {
      title: 'RAG 기반의 AI 대화형 질의응답 시스템 ',
      period: 'Jun 2024 - Jan 2025',
      description: '- 부동산 법률 질의응답 시스템 구축을 위한 RAG 기반의 AI 파이프라인 개발 <br /> - 부동산 도메인에 특화된 질의응답 시스템 구현',
      link: '#',
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang Univ Icon" />,
      // icon2: <IconPlaceholder src="https://d2u3dcdbebyaiu.cloudfront.net/img/companyPage_kr/logo_5319.jpg" alt="URP Icon" />, // Added second icon
      // Detailed fields for modal
      imageUrl: 'https://www.notion.so/signed/https%3A%2F%2Fprod-files-secure.s3.us-west-2.amazonaws.com%2Fe84664d2-ffbe-4fe5-a19a-d9324be7992b%2F8191c8ad-77bc-4440-9b3a-29d0013e4ab4%2Fimage01.png?table=block&id=b52fd5f5-f364-4d81-90d3-ed18cfbe8930&spaceId=e84664d2-ffbe-4fe5-a19a-d9324be7992b&name=image01.png&userId=1cc65db1-ffd6-430b-8e3a-c086fb60fdaa&cache=v2',
      subtitle: 'RAG 기반의 대화형 부동산 법률 질의응답시스템 개발',
      fullDescription: '민원인을 위한 부동산 법률 질의응답 시스템을 개발했습니다. RAG 기반의 AI 파이프라인을 통해 민원인의 질문에 맞는 법령 정보를 제공하며, 부동산 관련 법률 상담을 지원합니다.',
      companyOrInstitution: '대외비',
      role: 'Retriever 모델 개발 및 학습을 위한 데이터셋 구축 및 증강',
      externalLinks: [
        // { name: '프로젝트 보고서', url: 'https://example.com/project-d-report' },
      ],
    },
    {
      title: 'Neural Journalism: 빅데이터와 딥러닝 기반 차세대 저널리즘 연구',
      period: 'Mar 2022 - Feb 2025',
      description: '- 사용자 맞춤형 뉴스 요약 시스템 개발 <br /> - HCI 시스템을 고려한 사용자 경험 개선 목표',
      link: '#',
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang Univ Icon" />,
      // Detailed fields for modal
      imageUrl: 'https://rhetorical-branch-d93.notion.site/image/https%3A%2F%2Fprod-files-secure.s3.us-west-2.amazonaws.com%2Fe84664d2-ffbe-4fe5-a19a-d9324be7992b%2Ff3435d6e-079e-4dc6-9637-a2d618739f9c%2Fimage01.png?table=block&id=729a09a3-3c6d-412e-9cc4-072278c8756a&spaceId=e84664d2-ffbe-4fe5-a19a-d9324be7992b&width=2000&userId=&cache=v2',
      subtitle: '사용자 맞춤형 뉴스 요약 시스템 개발',
      fullDescription: '정보 과잉 시대속에서 필요한 정보를 효율적으로 제공하는 것은 중요한 과제입니다. 이 프로젝트에서는 사용자 맞춤형 뉴스 요약 시스템을 개발하여, 사용자가 원하는 정보만을 빠르게 제공할 수 있는 시스템을 구축했습니다. HCI 시스템을 고려하여 사용자 경험을 개선하는 것을 목표로 하고 있습니다.',
      companyOrInstitution: '한국연구재단 & 보스턴 대학교 (Derry Tanti Wijaya 교수님 연구실)',
      role: 'PLM(T5-base) 및 LLM(GPT-API)을 활용한 Controllable Text Summarization 모델 개발',
      externalLinks: [],
    },
    {
      title: '[디지털치료교육 플랫폼 개발 연구 사업] 소통약자의 소통능력 및 사회성 증진을 위한 음악활동 기반의 기능성 콘텐츠 플랫폼 개발',
      period: 'Mar 2022 - Dec 2023',
      description: '- 소통약자를 위한 음악활동 기반 기능성 콘텐츠 플랫폼 개발 <br /> - Pose Estimation 및 Hand Gesture Recognition 기술 활용',
      link: '#',
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang Univ Icon" />,
      icon2: <IconPlaceholder src="https://hudit.co.kr/images/sns_link.png" alt="Huduit Icon" />, // Added second icon
      // Detailed fields for modal
      imageUrl: 'https://rhetorical-branch-d93.notion.site/image/https%3A%2F%2Fprod-files-secure.s3.us-west-2.amazonaws.com%2Fe84664d2-ffbe-4fe5-a19a-d9324be7992b%2F57e91930-d7f3-423f-9f00-0744a274fe55%2Fimage01.jpg?table=block&id=10f36a8a-0e2a-804a-9964-c95cc4e455c7&spaceId=e84664d2-ffbe-4fe5-a19a-d9324be7992b&width=2000&userId=&cache=v2',
      subtitle: '소통약자를 위한 음악활동 기반 기능성 콘텐츠 플랫폼 개발',
      fullDescription: '소통약자의 소통능력 및 사회성 증진을 위한 음악활동 기반의 기능성 콘텐츠 플랫폼을 개발하는 프로젝트입니다. 이 플랫폼은 음악을 매개로 하여 소통약자들이 보다 쉽게 의사소통하고 사회적 상호작용을 할 수 있도록 지원합니다.',
      companyOrInstitution: '(주) Hudit & 중앙대학교병원 정신건강의학과',
      role: 'Pose Estimation 모델 개발 보조 및 데이터 증강',
      externalLinks: [
        { name: '관련 기사 (TechCrunch)', url: 'https://kr.aving.net/news/articleView.html?idxno=1787610' },
      ],
    },
    {
      title: '광학 위성 영상 Labeling Dataset 구축',
      period: 'Sep 2021 - Dec 2021',
      description: '- 광학 위성 영상 데이터 생성을 위한 편집툴 활용 <br /> - Semantic Segmentation 기술 개발 보조',
      link: '#',
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang Univ Icon" />,
      icon2: <IconPlaceholder src="https://i.ibb.co/LzLzwWqb/dq75-BPW1-UFc-Ok-LVx-Vfwnsiw-ACa-YB14-KQw-NJXk3w-K4rfr-Be7-Gerpz-FR2ec5yhy-WLU3-Fkp3ju-I9o-P-JSAwl7v.jpg" alt="Sahmyook Univ Icon" />,
      // Detailed fields for modal
      imageUrl: 'https://aihub.or.kr/web-nas/aihub21/files/public/2020-09/%EB%8C%80%ED%91%9C%EB%8F%84%EB%A9%B4.PNG',
      subtitle: '광학 위성 영상 Labeling Dataset 구축',
      fullDescription: '광학 위성 영상을 활용한 Semantic Segmentation 기술 개발을 위한 Labeling Dataset을 구축하고 광학 위성 영상에 특화된 Semantic Segmentation 모델을 개발하는 프로젝트입니다. 해당 프로젝트는 위성 정보를 다양한 응용 분야에 활용할 수 있도록 하기 위해 정확한 라벨링 데이터 생성과 관련 모델 개발을 목표로 하고 있습니다.',
      companyOrInstitution: '항공우주연구원',
      role: 'Semantic Segmentation 모델 개발 보조',
      externalLinks: [],
    },
    {
      title: '[인공지능 학습용 데이터 구축 사업] 작업현장 안전 데이터 사업',
      period: 'May 2021 - Feb 2022',
      description: '- 사용자 맞춤형 뉴스 요약 시스템 개발 <br /> - HCI 시스템을 고려한 사용자 경험 개선 목표',
      link: '#',
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang Univ Icon" />,
      // Detailed fields for modal
      imageUrl: 'https://rhetorical-branch-d93.notion.site/image/https%3A%2F%2Fprod-files-secure.s3.us-west-2.amazonaws.com%2Fe84664d2-ffbe-4fe5-a19a-d9324be7992b%2F907acf96-0f45-40da-b529-a98639b0b706%2Fimage02.png?table=block&id=ca493f23-1531-4288-ad7a-d65fdd42f710&spaceId=e84664d2-ffbe-4fe5-a19a-d9324be7992b&width=2000&userId=&cache=v2',
      subtitle: '건설 작업현장 내 위험상황 인지 알고리즘 개발',
      fullDescription: '건설 현장의 위험 판별을 위해서는 개별 객체에 대한 식별 정확도도 중요하지만, 식별 대상의 주변의 작업환경 및 설치물 등에 대한 추가 정보를 통해 위험 상황 판별을 고도화 할 수 있습니다. 이 프로젝트에서는 영상/사진으로 식별된 제한된 객체정보를 기반으로 위험상황 판별 및 대응방안 등 건설안전 도메인 지식을 자동으로 서술하여 제공할 수 있는 기술 개발을 목표로 하고 있습니다.',
      companyOrInstitution: '과학기술정보통신부, 한국지능정보사회진흥원(NIA), 중앙대학교 박찬식 교수님 연구실',
      role: '건설현장 내 Object Detection 알고리즘 고도화를 위한 데이터 정제 및 증강 & 탐지된 객체를 기반으로 하는 Image Captioning 모델 개발',
      externalLinks: [],
    },
    {
      title: '[서울시 산학연 실증지원 사업] 전시 관람객 예측 플랫폼',
      period: 'Dec 2020 - Feb 2022',
      description: '- SNS데이터를 통한 관람객 분석 <br /> - Image Captioning, Topic Modeling등을 통한 관람객 수 예측 모델 개발',
      link: '#',
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang Univ Icon" />,
      icon2: <IconPlaceholder src="https://s3.ap-northeast-2.amazonaws.com/inno.bucket.live/corp/logo/CP00016094_20231023113307.png" alt="Peopulley Icon" />,
      // Detailed fields for modal
      imageUrl: 'https://rhetorical-branch-d93.notion.site/image/https%3A%2F%2Fprod-files-secure.s3.us-west-2.amazonaws.com%2Fe84664d2-ffbe-4fe5-a19a-d9324be7992b%2Fb2cdb338-11c6-4147-87fb-73e3f3c89fd8%2Fimage.png?table=block&id=10736a8a-0e2a-809f-a7c5-f41d4c0b38f8&spaceId=e84664d2-ffbe-4fe5-a19a-d9324be7992b&width=2000&userId=&cache=v2',
      subtitle: '전시 관람객 예측 플랫폼 개발',
      fullDescription: '서울시립미술관의 관람객 데이터를 과학적으로 수집, 분석함으로써 전시기획 및 전략수립을 통해 미술관의 운영 활성화에 기여하고, 진정 한 문화 공공기관으로써의 역할을 다하기 위한 프로젝트입니다. 데이터 기반 관람객 행태를 세부 분석하여 관람객 눈높이에 맞는 맞춤형 전시를 제공함으로써 소외계층을 아우르는 시민 문화복지 증진과 신규 관람객 증대 효과 기대합니다.',
      companyOrInstitution: '(주) Peoplely, 서울시립미술관, 중앙대학교 이보아 교수님 연구실',
      role: 'SNS 데이터 수집, 정제 및 분석 & 이미지 Captioning을 통한 이미지 데이터 메타데이터 구축 & 토픽모델링을 통한 관람객 행태 분석 & 관람객 수 예측 모델 개발',
      externalLinks: [],
    },
    {
      title: '[인공지능 학습용 데이터 구축 사업] 주행 환경 정적 객체 인지 AI 데이터',
      period: 'Sep 2020 - Dec 2022',
      description: '- 자율주행 기술개발을 위한 주행환경 데이터 수집-가공-분석-활용 파이프라인 확립 <br /> - 데이터 증강을 통한 객체 인식 정확도 향상',
      link: '#',
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang Univ Icon" />,
      // Detailed fields for modal
      imageUrl: 'https://rhetorical-branch-d93.notion.site/image/https%3A%2F%2Fprod-files-secure.s3.us-west-2.amazonaws.com%2Fe84664d2-ffbe-4fe5-a19a-d9324be7992b%2F75eeabdb-f258-4606-9bf4-0e1c6242b381%2F%25EA%25B7%25B8%25EB%25A6%25BC1.jpg?table=block&id=10936a8a-0e2a-8001-836a-c93fc2583cc7&spaceId=e84664d2-ffbe-4fe5-a19a-d9324be7992b&width=2000&userId=&cache=v2',
      subtitle: '자율주행 모델 학습을 위한 주행 데이터 증강 기술 개발',
      fullDescription: '자율주행 기술개발 및 상용 서비스를 위해서는 방대한 주행환경 데이터에 대한 수집-가공-분석-활용이 필수적이며, 이러한 데이터 처리 일련의 과정을 고려했을 때, 자율주행 분야에서의 AI 기술의 활용은 무궁무진한 잠재성과 효용 가치를 지니고 있습니다. 본 사업을 통해 자율주행 데이터 처리를 위한 AI 모델 성능 향상을 위한 핵심 경쟁력인 AI 학습용 데이터(원천데이터 포함)를 단기간에 확보함으로써, 민간‧공공 수요를 기반으로 양질의 AI 데이터를 대규모로 구축‧공개하고 활용을 촉진하여 AI‧데이터 선순환 생태계 조성에 기여하고자 합니다.',
      companyOrInstitution: '(주) 쏘카, (주) 라이드 플럭스, Naver Clova, 알디프로젝트, 인피닉, 모빌테크)',
      role: 'SNS 데이터 수집, 정제 및 분석 & 이미지 Captioning을 통한 이미지 데이터 메타데이터 구축 & 토픽모델링을 통한 관람객 행태 분석 & 관람객 수 예측 모델 개발',
      externalLinks: [],
    },
    {
      title: '건설작업장의 안전 방해물 검출을 위한 지능형 CCTV 모니터링 시스템 개발',
      period: 'Apr 2020 - Feb 2021',
      description: '- 건설작업장 안전 방해물 검출을 위한 데이터셋 구축 및 증강 <br /> - 구축된 데이터셋을 활용한 Object Detection 및 Instance Segmentation 모델 개발',
      link: '#',
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang Univ Icon" />,
      icon2: <IconPlaceholder src="https://www.syu.ac.kr/wp-content/uploads/2018/05/pg_thum.png" alt="Sahmyook Univ Icon" />,
      // Detailed fields for modal
      imageUrl: 'https://rhetorical-branch-d93.notion.site/image/https%3A%2F%2Fprod-files-secure.s3.us-west-2.amazonaws.com%2Fe84664d2-ffbe-4fe5-a19a-d9324be7992b%2F75eeabdb-f258-4606-9bf4-0e1c6242b381%2F%25EA%25B7%25B8%25EB%25A6%25BC1.jpg?table=block&id=10936a8a-0e2a-8001-836a-c93fc2583cc7&spaceId=e84664d2-ffbe-4fe5-a19a-d9324be7992b&width=2000&userId=&cache=v2',
      subtitle: '건설작업장 안전 방해물 검출 시스템 개발',
      fullDescription: '다른 산업현장과 마찬가지로 건설현장에서도 Instance Segmentation, Object Detection등의 알고리즘의 활용도는 매우 높음에도 불구하고, 건설현장에 특화된 데이터셋은 부족한 실정입니다. 본 사업을 통해 건설현장에 특화된 AI 학습용 데이터(원천데이터 포함)를 확보함으로써, 민간‧공공 수요를 기반으로 양질의 AI 데이터를 대규모로 구축‧공개하고 활용을 촉진하여 AI‧데이터 선순환 생태계 조성에 기여하며 건설현장에 특화된 Instance Segmentation, Object Detection등의 알고리즘의 활용도를 높이고자 합니다.',
      companyOrInstitution: 'SeeCon, 삼육대학교 류한국 교수님 연구실',
      role: '데이터 전처리 및 기상정보를 포함한 데이터 증강',
      externalLinks: [],
    },
    {
      title: '지능형 도로구조물 시공품질관리기술 개발',
      period: 'Apr 2020 - Feb 2021',
      description: '- 도로구조물 관리 자동화를 위한 관련 데이터셋 구축 및 머신러닝 모델을 활용한 도로 균열 예측 <br /> - 시계열 데이터 분석을 통한 도로 구조물의 시공 품질 관리',
      link: '#',
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang Univ Icon" />,
      // Detailed fields for modal
      imageUrl: 'https://rhetorical-branch-d93.notion.site/image/https%3A%2F%2Fprod-files-secure.s3.us-west-2.amazonaws.com%2Fe84664d2-ffbe-4fe5-a19a-d9324be7992b%2F689f53d0-64a0-41b1-a30f-b14fe4c0ca1a%2Fimage.png?table=block&id=10c36a8a-0e2a-8061-b71c-cf06218b9be2&spaceId=e84664d2-ffbe-4fe5-a19a-d9324be7992b&width=1420&userId=&cache=v2',
      subtitle: '교량 내 센서 데이터를 통한 균열 예측 모델 개발',
      fullDescription: '주기적인 육안점검만으로 교량의 손상을 파악하는 것은 한계가 있습니다. 본 프로젝트에서는 교량에서 주기적으로 얻을 수 있는 센서 데이터들을 활용하여 교량의 손상 정도를 모니터링 할 수 있는 머신러닝 모델을 개발하고, 이를 통해 도로 구조물의 시공 품질을 관리하는 기술을 개발했습니다. 이 기술은 도로 구조물의 유지보수 비용을 절감하고, 안전성을 높이는 데 기여할 것으로 기대됩니다.',
      companyOrInstitution: '국토교통과학기술진흥원, 중앙대학교 박종웅 교수님 연구실',
      role: '1D-CNN 및 Transformer 모델을 활용한 교량 균열 예측 모델 개발',
      externalLinks: [],
    },
    {
      title: '인공지능을 활용한 다문화가정 언어교육',
      period: 'Sep 2019 - Feb 2020',
      description: '- 다문화가정 아동을 위한 맞춤형 언어교육 콘텐츠 개발 <br /> - 자연어 처리 기술을 활용한 학습 진단 및 피드백 시스템 구축',
      link: '#',
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang Univ Icon" />,
      // Detailed fields for modal
      imageUrl: 'https://rhetorical-branch-d93.notion.site/image/https%3A%2F%2Fprod-files-secure.s3.us-west-2.amazonaws.com%2Fe84664d2-ffbe-4fe5-a19a-d9324be7992b%2Fd97c7ac0-7d48-4f26-81c1-fb7818935f17%2Fimage01.jpg?table=block&id=10d36a8a-0e2a-807a-b1b9-fcde87b2017e&spaceId=e84664d2-ffbe-4fe5-a19a-d9324be7992b&width=1420&userId=&cache=v2',
      subtitle: '다문화 가정 아동을 위한 언어교육 콘텐츠 개발',
      fullDescription: '다문화 가정 아동을 위한 맞춤형 언어교육 콘텐츠를 개발하고, 자연어 처리 기술을 활용한 학습 진단 및 피드백 시스템을 구축했습니다. 이를 통해 다문화가정 아동들이 보다 효과적으로 언어를 학습할 수 있도록 지원하고자 하였습니다. 해당 시스템은 한국 전통 문화를 포함한 다양한 언어 교육 콘텐츠를 제공하며, 이후 학습 과정을 분석하여 개인 맞춤형 피드백을 제공합니다.',
      companyOrInstitution: '중앙대학교 김재웅 교수님 연구실',
      role: '개인 맞춤형 피드백을 위한 문법 교정 모델 및 자동 시각화 시스템 구축',
      externalLinks: [],
    },
  ];

// English copy follows the same order and preserves original images, URLs and empty fields.
// Description grounded in the linked Site metadata; illustration shows the method, not a captured UI.
Object.assign(projects_[1], {
 description: '- 텍스트, 이미지, 표 추출을 위한 문서 레이아웃 분석<br />- 작업 목적에 따라 분할 단위를 제어하는 Policy-Adaptive DLA 연구',
 subtitle: '작업 목적에 맞춘 문서 분할과 구조 분석',
 fullDescription: '기업 문서의 텍스트, 이미지, 표를 다루기 위한 OCR 및 문서 레이아웃 분석 연구입니다. 작업 목적에 따라 문서 분할 단위를 제어하는 Policy-Adaptive DLA를 연구하고, 연구 방법과 실험 결과를 Document Parsing Research 데모에서 소개합니다.',
 imageUrl: '/resume/projects/document-parsing.png', companyOrInstitution: 'Selectstar', role: '문서 레이아웃 분석 및 Policy-Adaptive DLA 연구',
 externalLinks: [{name:'Document Parsing 데모 ↗', url:'https://selectstar-ai-vertical-research-feasibility-document-parsing.kyohoon-jin.chatgpt.site/'}]
});
const projectEnglishCopy = [
  {
    "title": "Monitoring Dashboard Development for the DATUMO Platform"
  },
  {
    "title": "Core OCR and Document Layout Analysis Technology for Extracting Text, Images and Tables from Enterprise Documents"
  },
  {
    "title": "Sovereign AI Foundation Model Project (SKT Consortium)",
    "description": "- Generated challenging LLM training data in science, law, APIs and databases <br /> - Developed LLM-based difficulty enhancement and automated verification pipelines",
    "subtitle": "Generating and Verifying Advanced Training Data for Specialized Domains",
    "fullDescription": "Selectstar was responsible for building and verifying large-scale training data for the SKT consortium’s sovereign AI foundation model project. Our team generated and verified data in science, law, APIs and databases. We developed a pipeline that generates questions and solutions from source materials with LLMs, increases difficulty by adding complex constraints and reasoning steps, and applies LLM verification followed by human review. The target difficulty was graduate level or above for science, legal professional level for law, and undergraduate-level programming or above for APIs and databases.",
    "companyOrInstitution": "SKT Consortium",
    "role": "Development of training data generation and verification pipelines for science, law, APIs and databases",
    "externalLinkNames": [
      "Related article (SK Telecom)"
    ]
  },
  {
    "title": "AI and Data-Driven Digital Education Platform for Gyeonggi Province",
    "description": "- Built an LLM data augmentation pipeline for drafting primary and secondary school assessment plans <br /> - Developed automated evaluation with an LLM judge",
    "subtitle": "Training and Evaluation Data for the Gyeonggi Education AI Platform",
    "fullDescription": "In collaboration with LG CNS, we built data for model training and evaluation on the Gyeonggi Provincial Office of Education’s AI platform. We organized documents and examples of primary and secondary school assessment plans and developed an LLM-based data augmentation pipeline that generates draft assessment plans for individual schools from a small set of examples. We also implemented prompt-based automated evaluation using an LLM judge.",
    "companyOrInstitution": "LG CNS",
    "role": "Development of assessment-plan drafting and data augmentation pipelines, and automated LLM-judge evaluation",
    "externalLinkNames": [
      "Related article (Gyeonggi Provincial Office of Education)"
    ]
  },
  {
    "title": "[Samsung Life C-Lab] Integrating Structured Data into LLMs",
    "description": "- Developed technology to incorporate large-scale structured data into LLM knowledge <br /> - Supported decision-making based on internal structured data",
    "subtitle": "Structured Data Integration and Knowledge Incorporation for LLMs",
    "fullDescription": "Samsung Life holds a large volume of structured customer data but lacked technology to connect it effectively to LLMs. We developed technology that connects LLMs with structured data and incorporates it into model knowledge, with the aim of supporting personalized customer services and data-driven decision-making.",
    "companyOrInstitution": "Samsung Life Insurance",
    "role": "Development of structured data analysis pipelines and technology for incorporating data into LLM knowledge",
    "externalLinkNames": [
      "Related article (News)"
    ]
  },
  {
    "title": "Document Linking and Metadata Construction for the Financial Domain",
    "description": "- Developed document linking and metadata construction technology for financial documents <br /> - Supported efficient management and use of financial data",
    "subtitle": "Document Linking and Metadata Construction for Finance",
    "fullDescription": "We developed technology to link information across financial documents and construct document metadata to improve the use of financial text data. The project aims to support efficient financial data management and use, and improve data-driven decision-making processes.",
    "role": "Development of metadata construction technology and data linking pipelines"
  },
  {
    "title": "Synthetic Dataset Generation for RAG Evaluation",
    "description": "- Researched source-document-based question-answer dataset synthesis for evaluating RAG systems <br /> - Submitted two papers to EMNLP 2025",
    "subtitle": "Synthetic Dataset Generation for RAG Evaluation",
    "fullDescription": "We researched source-document-based question-answer dataset synthesis for evaluating RAG systems and submitted two papers to EMNLP 2025.",
    "companyOrInstitution": "Hanwha Life Insurance",
    "role": "Research on synthetic datasets for RAG evaluation and paper writing"
  },
  {
    "title": "RAG-Based Conversational Question Answering",
    "description": "- Developed a RAG-based AI pipeline for real estate legal question answering <br /> - Implemented a question-answering system specialized in real estate",
    "subtitle": "RAG-Based Conversational Question Answering for Real Estate Law",
    "fullDescription": "We developed a real estate legal question-answering system for public inquiries. A RAG-based AI pipeline retrieves legal information relevant to each question and supports real estate legal consultation.",
    "companyOrInstitution": "Confidential",
    "role": "Development of retriever models and construction and augmentation of training datasets"
  },
  {
    "title": "Neural Journalism: Next-Generation Journalism with Big Data and Deep Learning",
    "description": "- Developed a personalized news summarization system <br /> - Improved user experience with an HCI-informed design",
    "subtitle": "Personalized News Summarization",
    "fullDescription": "The project addressed the need to deliver relevant information efficiently in an era of information overload. We developed a personalized news summarization system that helps users access the information they need, with an emphasis on improving the user experience through HCI principles.",
    "companyOrInstitution": "National Research Foundation of Korea and Boston University (Prof. Derry Tanti Wijaya’s Lab)",
    "role": "Development of controllable text summarization models using a pretrained language model (T5-base) and an LLM (GPT API)"
  },
  {
    "title": "Music-Based Functional Content Platform for Communication and Social Skills",
    "description": "- Developed a music-based functional content platform for people with communication difficulties <br /> - Applied pose estimation and hand gesture recognition",
    "subtitle": "Music-Based Content for People with Communication Difficulties",
    "fullDescription": "This project develops a music-based functional content platform to improve communication and social skills in people with communication difficulties. The platform uses music to support communication and social interaction.",
    "companyOrInstitution": "Hudit and the Department of Psychiatry, Chung-Ang University Hospital",
    "role": "Support for pose estimation model development and data augmentation",
    "externalLinkNames": [
      "Related article (TechCrunch)"
    ]
  },
  {
    "title": "Labeled Dataset Construction for Optical Satellite Imagery",
    "description": "- Used editing tools to create optical satellite imagery datasets <br /> - Supported semantic segmentation technology development",
    "subtitle": "Labeled Dataset Construction for Optical Satellite Imagery",
    "fullDescription": "We constructed a labeled optical satellite imagery dataset for semantic segmentation and developed a semantic segmentation model specialized in satellite imagery. The project aimed to create accurate labels and associated models to support the use of satellite information in a range of applications.",
    "companyOrInstitution": "Korea Aerospace Research Institute",
    "role": "Support for semantic segmentation model development"
  },
  {
    "title": "[AI Training Data Construction] Workplace Safety Data",
    "description": "- Developed a personalized news summarization system <br /> - Improved user experience with an HCI-informed design",
    "subtitle": "Hazard Recognition Algorithms for Construction Sites",
    "fullDescription": "Identifying hazards at construction sites requires both accurate object recognition and contextual information about the surrounding work environment and installations. This project aims to develop technology that uses objects identified in images and video to describe construction-safety knowledge about hazards and possible responses.",
    "companyOrInstitution": "Ministry of Science and ICT, National Information Society Agency (NIA), and Prof. Chansik Park’s Lab at Chung-Ang University",
    "role": "Data cleaning and augmentation for construction-site object detection, and development of image captioning models based on detected objects"
  },
  {
    "title": "[Seoul Industry-Academia Collaboration] Exhibition Visitor Prediction Platform",
    "description": "- Analyzed visitors using SNS data <br /> - Developed visitor count prediction models using image captioning and topic modeling",
    "subtitle": "Exhibition Visitor Prediction Platform",
    "fullDescription": "The project scientifically collected and analyzed visitor data from the Seoul Museum of Art to support exhibition planning, strategy and museum operations. It analyzed visitor behavior to provide tailored exhibitions, broaden access to cultural services, and attract new visitors.",
    "companyOrInstitution": "Peoplely, Seoul Museum of Art, and Prof. Bo-Ah Lee’s Lab at Chung-Ang University",
    "role": "SNS data collection, cleaning and analysis; image metadata construction through captioning; visitor behavior analysis through topic modeling; and visitor count prediction model development"
  },
  {
    "title": "[AI Training Data Construction] Static Object Perception Data for Driving Environments",
    "description": "- Established a driving-environment data collection, processing, analysis and application pipeline for autonomous driving <br /> - Improved object recognition accuracy through data augmentation",
    "subtitle": "Driving Data Augmentation for Autonomous Driving Models",
    "fullDescription": "Autonomous driving development and deployment require large-scale data collection, processing, analysis and application. This project aimed to secure and publish high-quality AI training data, including source data, to improve model performance and support demand from the public and private sectors. It also aimed to promote a cycle of data creation, sharing and use.",
    "companyOrInstitution": "SOCAR, RideFlux, NAVER CLOVA, RD Project, INFINIQ and Mobiltech",
    "role": "SNS data collection, cleaning and analysis; image metadata construction through captioning; visitor behavior analysis through topic modeling; and visitor count prediction model development"
  },
  {
    "title": "Intelligent CCTV Monitoring for Safety Hazards at Construction Sites",
    "description": "- Constructed and augmented a dataset for detecting safety hazards at construction sites <br /> - Developed object detection and instance segmentation models using the dataset",
    "subtitle": "Safety Hazard Detection for Construction Sites",
    "fullDescription": "Although instance segmentation and object detection are useful in construction, datasets specific to construction sites are limited. This project aimed to secure high-quality AI training data, including source data, for construction sites, support public and private sector demand, and improve the application of instance segmentation and object detection in construction.",
    "companyOrInstitution": "SeeCon and Prof. Hanguk Ryu’s Lab at Sahmyook University",
    "role": "Data preprocessing and augmentation incorporating weather information"
  },
  {
    "title": "Intelligent Construction Quality Management for Road Structures",
    "description": "- Built datasets and machine learning models for automated road-structure management and crack prediction <br /> - Applied time-series data analysis to construction quality management",
    "subtitle": "Crack Prediction from Bridge Sensor Data",
    "fullDescription": "Periodic visual inspection alone is insufficient to assess bridge damage. We developed machine learning models that monitor bridge damage using periodically collected sensor data and applied them to construction quality management for road structures. The technology is expected to help reduce maintenance costs and improve safety.",
    "companyOrInstitution": "Korea Agency for Infrastructure Technology Advancement and Prof. Jong-Woong Park’s Lab at Chung-Ang University",
    "role": "Development of bridge crack prediction models using 1D CNNs and Transformers"
  },
  {
    "title": "AI-Assisted Language Education for Multicultural Families",
    "description": "- Developed personalized language-learning content for children from multicultural families <br /> - Built NLP-based learning assessment and feedback systems",
    "subtitle": "Language-Learning Content for Children from Multicultural Families",
    "fullDescription": "We developed personalized language-learning content for children from multicultural families and built NLP-based learning assessment and feedback systems. The project aimed to support more effective language learning through content that includes traditional Korean culture and personalized feedback informed by each learner’s progress.",
    "companyOrInstitution": "Prof. Jae-Woong Kim’s Lab at Chung-Ang University",
    "role": "Development of grammar correction models and automated visualization for personalized feedback"
  }
];
Object.assign(projectEnglishCopy[1], {description:'- Document layout analysis for extracting text, figures and tables<br />- Policy-Adaptive DLA with task-dependent segmentation', subtitle:'Task-dependent document segmentation and layout analysis', fullDescription:'Research on OCR and document layout analysis for enterprise documents containing text, figures and tables. Policy-Adaptive DLA controls segmentation granularity according to the target task. The Document Parsing Research demo presents the research approach and experimental results.', companyOrInstitution:'Selectstar', role:'Document layout analysis and Policy-Adaptive DLA research', externalLinkNames:['Document Parsing demo ↗']});
const projectsEN_ = projects_.map((project, index) => {
  const { externalLinkNames, ...copy } = projectEnglishCopy[index] || {};
  return { ...project, ...copy, externalLinks: project.externalLinks.map((link, linkIndex) => ({ ...link, name: externalLinkNames?.[linkIndex] || link.name })) };
});

export { projects_, projectsEN_ };
