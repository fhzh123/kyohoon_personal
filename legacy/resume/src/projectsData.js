// Placeholder for icons (user will insert images here)
const IconPlaceholder = ({ src, alt }) => (
<div className="w-6 h-6 mr-2 flex-shrink-0 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
    {src && <img src={src} alt={alt} className="w-full h-full object-cover" />}
</div>
);

const projects_ = [
    {
      title: '(수정예정) DATUMO 플랫폼 내 모니터링 대시보드 개발',
      period: 'Feb 2026 - Aug 2026',
      description: '수정 예정입니다.',
      link: '#', // This link is now used to trigger the modal
      icon: <IconPlaceholder src="https://logo-resources.thevc.kr/organizations/200x200/a72b6be358f7e753fd51ef4e011070dfe7298e32f8979cd099e0a5fb5d690e39_1691372959298758.jpg" alt="Project Icon 1" />,
      // Detailed fields for modal
      imageUrl: '', // Image for project detail
      subtitle: '',
      fullDescription: '수정 예정입니다.',
      companyOrInstitution: '',
      role: '',
      externalLinks: [],
    },
    {
      title: '(수정예정) Agentic Flow를 활용한 Dialouge Topic Segmentation',
      period: 'Feb 2026 - ',
      description: '수정 예정입니다.',
      link: '#', // This link is now used to trigger the modal
      icon: <IconPlaceholder src="https://logo-resources.thevc.kr/organizations/200x200/a72b6be358f7e753fd51ef4e011070dfe7298e32f8979cd099e0a5fb5d690e39_1691372959298758.jpg" alt="Project Icon 1" />,
      // Detailed fields for modal
      imageUrl: '', // Image for project detail
      subtitle: '',
      fullDescription: '수정 예정입니다.',
      companyOrInstitution: '',
      role: '',
      externalLinks: [],
    },
    {
      title: '(수정예정) 자동 프롬프트 튜닝을 통한 Generalized Category Discovery',
      period: 'Jan 2026 - ',
      description: '수정 예정입니다.',
      link: '#', // This link is now used to trigger the modal
      icon: <IconPlaceholder src="https://logo-resources.thevc.kr/organizations/200x200/a72b6be358f7e753fd51ef4e011070dfe7298e32f8979cd099e0a5fb5d690e39_1691372959298758.jpg" alt="Project Icon 1" />,
      // Detailed fields for modal
      imageUrl: '', // Image for project detail
      subtitle: '',
      fullDescription: '수정 예정입니다.',
      companyOrInstitution: '',
      role: '',
      externalLinks: [],
    },
    {
      title: '(수정예정) 기업 문서 내 텍스트, 이미지, 표 추출을 위한 OCR & DLA 원천기술 개발',
      period: 'Jan 2026 - ',
      description: '수정 예정입니다.',
      link: '#', // This link is now used to trigger the modal
      icon: <IconPlaceholder src="https://logo-resources.thevc.kr/organizations/200x200/a72b6be358f7e753fd51ef4e011070dfe7298e32f8979cd099e0a5fb5d690e39_1691372959298758.jpg" alt="Project Icon 1" />,
      // Detailed fields for modal
      imageUrl: '', // Image for project detail
      subtitle: '',
      fullDescription: '수정 예정입니다.',
      companyOrInstitution: '',
      role: '',
      externalLinks: [],
    },
    {
      title: '(수정예정) 독자 AI 파운데이션 모델 프로젝트 (SKT 컨소시엄)',
      period: 'Oct 2025 - ',
      description: '수정 예정입니다.',
      link: '#', // This link is now used to trigger the modal
      icon: <IconPlaceholder src="https://logo-resources.thevc.kr/organizations/200x200/a72b6be358f7e753fd51ef4e011070dfe7298e32f8979cd099e0a5fb5d690e39_1691372959298758.jpg" alt="Project Icon 1" />,
      icon2: <IconPlaceholder src="https://static.wikia.nocookie.net/logo-timeline/images/5/50/Network_T.jpeg/revision/latest?cb=20230515203924" alt="Second Project Icon" />, // Added second icon
      // Detailed fields for modal
      imageUrl: '', // Image for project detail
      subtitle: '',
      fullDescription: '수정 예정입니다.',
      companyOrInstitution: '',
      role: '',
      externalLinks: [],
    },
    {
      title: '(수정예정) (경기도 교육청) AI-데이터 중심의 경기교육 디지털 플랫폼 사업',
      period: 'Oct 2025 - Dec 2025',
      description: '수정 예정입니다.',
      link: '#', // This link is now used to trigger the modal
      icon: <IconPlaceholder src="https://logo-resources.thevc.kr/organizations/200x200/a72b6be358f7e753fd51ef4e011070dfe7298e32f8979cd099e0a5fb5d690e39_1691372959298758.jpg" alt="Project Icon 1" />,
      icon2: <IconPlaceholder src="https://www.goe.go.kr/resource/old/BBSMSTR_000000000163/BBS_202203230959030481.png" alt="Second Project Icon" />, // Added second icon
      // Detailed fields for modal
      imageUrl: '', // Image for project detail
      subtitle: '',
      fullDescription: '수정 예정입니다.',
      companyOrInstitution: '',
      role: '',
      externalLinks: [],
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

export { projects_ };