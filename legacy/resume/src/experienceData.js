// Placeholder for icons (user will insert images here)
const IconPlaceholder = ({ src, alt }) => (
<div className="w-6 h-6 mr-2 flex-shrink-0 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
    {src && <img src={src} alt={alt} className="w-full h-full object-cover" />}
</div>
);

const experience_ = [
    {
      title: 'AI Research Engineer',
      company: '[Selectstar] AI연구1팀장, AI실, 기술본부',
      period: 'Mar 2025 - Present',
      description: '- Vertical AI 개발을 위한 데이터수집, 정제 및 파이프라인 구성 자동화 에이전트 개발 (2026.08 - )<br />- 사용자의 모델 혹은 원천 문서 등이 주어지면 니즈에 맞는 커스텀된 벤치마크 자동 생성 (2025.03 - 2026.08)<br />- 문서 내 & 문서 간 구조 계층화 연구 (2025.03 - 2025.12)<br />- 실시간으로 고객의 AI모델을 점검하고 평가할 수 있는 운영 모니터링 대시보드 개발 (2026.01 - 2026.08)',
      icon: <IconPlaceholder src="https://logo-resources.thevc.kr/organizations/200x200/a72b6be358f7e753fd51ef4e011070dfe7298e32f8979cd099e0a5fb5d690e39_1691372959298758.jpg" alt="Selectstar Logo" />, // Selectstar logo
    },
    {
      title: 'Student Researcher (Ph.D. & MS)',
      company: '[지능형 정보처리 연구실] 중앙대학교',
      period: 'Mar 2019 - Feb 2025',
      description: '[박사] 모델의 편향 및 과적합 방지를 위한 반-사실적 (Counterfactual) 데이터 생성 연구.  <br /> [석사] 한국 고문서 복원, 번역 및 분석 모델 개발',
      icon: <IconPlaceholder src="https://i.ibb.co/JjHDCSYG/1.png" alt="Chungang University Logo" />, // Placeholder for Chungang University Logo
    },
    {
      title: 'Business Statistics Analyst Intern',
      company: '[Davich Optical] 경영기획실 경영통계직군 인턴',
      period: 'Jul 2017 - Nov 2017',
      description: '- 매출 데이터 분석 및 시각화 & 사내 BI 시스템 구축 보조 <br /> - 국토대장정, 가맹점주 교육 등 사내 행사 기획 및 운영 보조',
      icon: <IconPlaceholder src="https://pimg.mk.co.kr/meet/neds/2021/09/image_readmed_2021_895427_16317671604787288.jpg" alt="Davich Optical Logo" />, // Davich Optical Logo
    },
  ];

const experienceEN_ = [
    {
      title: 'AI Research Engineer',
      company: '[Selectstar] Team Lead, AI Research Team 1 (AI Lab)',
      period: 'Mar 2025 - Present',
      description: '- Led the development of an automated system for generating customized benchmarks tailored to user-provided models and source documents <br /> -Developed multimodal document preprocessing pipelines enabling LLMs to handle images, text, and tabular data uniformly<br /> -Conducted research on intra- and inter-document structural hierarchy modeling to improve document understanding for LLMs<br /> -Designed and built a real-time operational monitoring dashboard for continuous evaluation of customer AI model performance  Development of data connection and metadata technology for performance and reliability verification of AI models',
      icon: <IconPlaceholder src="https://logo-resources.thevc.kr/organizations/200x200/a72b6be358f7e753fd51ef4e011070dfe7298e32f8979cd099e0a5fb5d690e39_1691372959298758.jpg" alt="Selectstar Logo" />, // Selectstar logo
    },
    {
      title: 'Student Researcher (Ph.D. & MS)',
      company: '[Intelligent Information Processing Lab] Chung-Ang University',
      period: 'Mar 2019 - Feb 2025',
      description: '[Ph.D.] Counterfactual Text Generation Research for Mitigating Bias and Overfitting <br /> [MS] Restoration, Translation, and Analysis Models for Korean Historical Documents',
      icon: <IconPlaceholder src="https://i.ibb.co/JjHDCSYG/1.png" alt="Chungang University Logo" />, // Placeholder for Chungang University Logo
    },
    {
      title: 'Business Statistics Analyst Intern',
      company: '[Davich Optical] Business Statistics Analyst Intern, Management Planning Department',
      period: 'Jul 2017 - Nov 2017',
      description: '- Sales data analysis and visualization & support for in-house BI system construction <br /> - Support for planning and operation of in-house events such as the National Territory Grand Trek and franchisee training',
      icon: <IconPlaceholder src="https://pimg.mk.co.kr/meet/neds/2021/09/image_readmed_2021_895427_16317671604787288.jpg" alt="Davich Optical Logo" />, // Davich Optical Logo
    },
  ];

export { experience_, experienceEN_ };