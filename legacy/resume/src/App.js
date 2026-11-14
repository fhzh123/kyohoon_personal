import React, { useState, useEffect } from 'react';
import { internationalPublications_, domesticPublications_ } from './PublicationsData';
import { projects_, projectsEN_ } from './projectsData';
import { experience_, experienceEN_ } from './experienceData';
import { lectures_, honors_ } from './lectureHonorData';
import socialLinks_ from './socialLinkData';
import patentDetails_ from './patentData';

const UiIcon = ({name}) => <img className="ui-icon" src={`/icons/ui-${name}.svg`} width="18" height="18" alt="" aria-hidden="true" />;
const phdThesis = {title:'Counterbias text augmentation : mitigation of multiple spurious correlations and dataset bias', href:'https://library.cau.ac.kr/search/i-discovery/9670635'};
const msThesis = {title:'병렬형 트랜스포머 모델을 활용한 한국 고문서 번역 및 분석', href:'https://library.cau.ac.kr/search/i-discovery/9383361'};
const universityPublications = internationalPublications_.filter(pub => Number(pub.year) >= 2019 && Number(pub.year) <= 2024);
const universityJournals = universityPublications.filter(pub => /Vol\./.test(pub.journal)).length;
const universityConferences = universityPublications.length - universityJournals;
const PaperReference = ({href,title,children}) => <a href={href} target="_blank" rel="noopener noreferrer" title={title} aria-label={title}>{children}<span aria-hidden="true">↗</span></a>;
const AcademicResearchSummary = ({language,onPublications}) => <div className="resume-research-summary experience-description">
  <div className="resume-research-row"><span>{language === 'ko' ? '- [박사]' : '- [Ph.D.]'}</span><span>{language === 'ko' ? '허위 상관관계와 편향 완화를 위한 반사실적 텍스트 증강' : 'Counterfactual text augmentation to mitigate spurious correlations and bias'}</span><PaperReference href="https://aclanthology.org/2025.emnlp-main.520/" title="CoBA: Counterbias Text Augmentation for Mitigating Various Spurious Correlations via Semantic Triples">CoBA (EMNLP 2025)</PaperReference></div>
  <div className="resume-research-row"><span>{language === 'ko' ? '- [석사]' : '- [M.S.]'}</span><span>{language === 'ko' ? '한국 고문서 복원, 번역 및 분석 모델 개발' : 'Restoration, translation and analysis of Korean historical documents'}</span><PaperReference href="https://aclanthology.org/2021.naacl-main.317/" title="Restoring and Mining the Records of the Joseon Dynasty via Neural Language Modeling and Machine Translation">NAACL 2021</PaperReference><PaperReference href="https://www.mdpi.com/2076-3417/10/21/7939" title="Korean Historical Documents Analysis with Improved Dynamic Word Embedding">Applied Sciences 2020</PaperReference></div>
  <div className="resume-research-row"><span>{language === 'ko' ? '학위논문' : 'Theses'}</span><PaperReference href={phdThesis.href} title={phdThesis.title}>{language === 'ko' ? '박사 학위논문' : 'Ph.D. thesis'}</PaperReference><PaperReference href={msThesis.href} title={msThesis.title}>{language === 'ko' ? '석사 학위논문' : 'M.S. thesis'}</PaperReference></div>
  <div className="resume-research-meta">- {language === 'ko' ? `SCIE급 국제저널 ${universityJournals}편, 국제학회 ${universityConferences}편` : `${universityJournals} SCIE-indexed journal papers and ${universityConferences} international conference papers`} <a className="resume-publications-link" href="#publications" onClick={event=>{event.preventDefault();onPublications();}}>Publications <span aria-hidden="true">→</span></a></div>
</div>;
const projectTitle = project => `${!project.description?.trim() && !project.fullDescription?.trim() ? '(수정예정) ' : ''}${project.title}`;
const nameMap = {'진교훈':'Kyohoon Jin','김영빈':'Youngbin Kim','김재원':'Jaewon Kim','장수진':'Soojin Jang','이준호':'Junho Lee','윤정민':'Jungmin Yun','최주환':'Juhwan Choi'};
function englishNames(value, key = '') {
  if (key === 'domesticPublications' || React.isValidElement(value)) return value;
  if (typeof value === 'string') return value.replace(/진교훈|김영빈|김재원|장수진|이준호|윤정민|최주환/g, name => nameMap[name]);
  if (Array.isArray(value)) return value.map(item => englishNames(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,englishNames(v,k)]));
  return value;
}

const App = () => {
  // State to manage the active tab in the menu bar
  const [activeTab, setActiveTab] = useState('Experience'); // Default to Experience based on new order
  // State to manage the visibility and content of the project detail modal
  const [selectedProject, setSelectedProject] = useState(null);
  const canReturnHome = window.RESUME_SESSION?.authenticated === true;
  // State to manage the active paper type in Publications
  const [activePaperType, setActivePaperType] = useState('International'); // Default to International
  // State to manage the active content type in Honors & Lecture
  const [activeLectureHonorsType, setActiveLectureHonorsType] = useState('Honors'); // Default to Lecture
  // State to manage the visibility of the KakaoTalk QR modal
  const [showKakaoQr, setShowKakaoQr] = useState(false);
  // State to manage the flip state of the profile picture
  const [isFlipped, setIsFlipped] = useState(false);
  // State to manage image loading in the project modal
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  // State for language toggle
  const [language, setLanguage] = useState('ko'); // Default to Korean
  
  // Effect for initial flip animation on component mount
  useEffect(() => {
    // Set a timeout to flip the image after a short delay (e.g., 500ms)
    const flipTimeout = setTimeout(() => {
      setIsFlipped(true); // Flip to backside

      // Set another timeout to flip it back after a duration (e.g., 1000ms for the animation + 500ms pause)
      const unflipTimeout = setTimeout(() => {
        setIsFlipped(false); // Flip back to frontside
      }, 1300); // Total duration for one flip cycle (animation duration + pause)

      return () => clearTimeout(unflipTimeout); // Cleanup the unflip timeout
    }, 1200); // Initial delay before the first flip

    return () => clearTimeout(flipTimeout); // Cleanup the initial flip timeout
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect to reset image loading state when a new project is selected
  useEffect(() => {
    if (selectedProject) {
      setIsLoadingImage(true); // Reset to true to show spinner for new image
    }
  }, [selectedProject]); // Re-run this effect whenever selectedProject changes

  // Effect to update data when language changes
  useEffect(() => {
    if (language === 'ko') {
      setCurrentData(koData);
    } else {
      setCurrentData(englishNames(enData));
    }
    document.documentElement.lang = language;
    window.AtlasTheme?.refresh();
  }, [language]);

  // Placeholder for icons (user will insert images here)
  const IconPlaceholder = ({ src, alt }) => (
    <div className="w-6 h-6 mr-2 flex-shrink-0 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
      {src && <img src={src} alt={alt} className="w-full h-full object-cover" />}
    </div>
  );

  // Korean Data
  const koData = {
    header: {
      name: 'Kyohoon Jin | 진교훈',
      title: 'AI Research Engineer',
      at: 'Selectstar',
      about: `저는 셀렉트스타에서 AI Research Engineer로 근무하고 있는 진교훈입니다. 저는 중앙대학교에서 박사학위를 취득하였으며 한국 고문서 분석 및 반사실적 텍스트 데이터 증강을 주로 연구하였습니다. 저는 40여편의 국내외 논문을 발표하여 200여 이상이 넘는 인용을 얻어내는 등 활발한 연구 활동을 이어가고 있습니다.`,
      contactTitle: 'Contact',
      contactMessage: '언제든 편하게 연락주세요!',
    },
    menu: {
      experience: 'Experience',
      education: 'Education',
      projects: 'Projects',
      publications: 'Publications',
      lectureHonors: 'Honors & Lecture',
      patent: 'Patent',
    },
    buttons: {
      viewDetails: '자세히 보기',
      internationalPaper: '🌐 International Paper',
      domesticPaper: '🇰🇷 Domestic Paper',
      lecture: '👨‍🏫 Lecture',
      honors: '🏆 Honors',
      transcript: '[Transcript] 🔗',
    },
    experienceDetails: experience_,
    educationDetails: [
    {
      degree: 'Ph.D',
      university: '중앙대학교',
      period: 'Mar 2021 - Feb 2025',
      grade: '4.20/4.5',
      subjects: 'Deep Learning, Natural Language Processing',
      thesis: 'Counterbias text augmentation : mitigation of multiple spurious correlations and dataset bias',
      thesisLink: 'https://library.cau.ac.kr/search/i-discovery/9670635',
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang University Logo" />, // Chungang University Logo
      transcriptLink: 'https://github.com/fhzh123/fhzh123/blob/main/Transcript/PhD_Transcript_KyohoonJin.pdf', // Placeholder link for transcript
    },
    {
      degree: 'MS',
      university: '중앙대학교',
      period: 'Mar 2019 - Feb 2021',
      grade: '4.38/4.5',
      subjects: 'Machine Learning, Deep Learning, Natural Language Processing',
      thesis: '병렬형 트랜스포머 모델을 활용한 한국 고문서 번역 및 분석',
      thesisLink: 'https://library.cau.ac.kr/search/i-discovery/9383361',
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang University Logo" />, // Chungang University Logo
      transcriptLink: 'https://github.com/fhzh123/fhzh123/blob/main/Transcript/MS_Transcript_KyohoonJin.pdf', // Placeholder link for transcript
    },
    {
      degree: 'BS',
      university: '가천대학교, 응용통계학과',
      period: 'Mar 2013 - Feb 2019',
      grade: '3.65/4.5',
      subjects: 'Mathematical Statistics, Multivariate Data Analysis',
      icon: <IconPlaceholder src="https://i.ibb.co/JL7VBL0/1.png" alt="Gachon University Logo Placeholder" />, // Placeholder for Gachon University Logo
      transcriptLink: 'https://github.com/fhzh123/fhzh123/blob/main/Transcript/BS_Transcript_KyohoonJin.pdf', // Placeholder link for transcript
    },
  ],
    projects: projects_,
    internationalPublications: internationalPublications_,
    domesticPublications: domesticPublications_,
    lectures: lectures_,
    honors: honors_,
    patent: patentDetails_,
  };

  const enData = {
    header: {
      name: 'Kyohoon Jin',
      title: 'AI Research Engineer',
      at: 'Selectstar',
      about: `I am Kyohoon Jin, an AI Research Engineer at Selectstar. I received my Ph.D. from Chung-Ang University, where my primary research focused on the analysis of Korean ancient documents and counterfactual text data augmentation. I maintain an active research profile, having published approximately 40 domestic and international papers and accumulating over 200 citations.`,
      contactTitle: 'Contact',
      contactMessage: 'Feel free to reach out anytime!',
    },
    menu: {
      experience: 'Experience',
      education: 'Education',
      projects: 'Projects',
      publications: 'Publications',
      lectureHonors: 'Honors & Lecture',
      patent: 'Patent',
    },
    buttons: {
      viewDetails: '자세히 보기',
      internationalPaper: '🌐 International Paper',
      domesticPaper: '🇰🇷 Domestic Paper',
      lecture: '👨‍🏫 Lecture',
      honors: '🏆 Honors',
      transcript: '[Transcript] 🔗',
    },
    experienceDetails: experienceEN_,
    educationDetails: [
    {
      degree: 'Ph.D',
      university: 'Chung-Ang University',
      period: 'Mar 2021 - Feb 2025',
      grade: '4.20/4.5',
      subjects: 'Deep Learning, Natural Language Processing',
      thesis: 'Counterbias text augmentation : mitigation of multiple spurious correlations and dataset bias',
      thesisLink: 'https://library.cau.ac.kr/search/i-discovery/9670635',
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang University Logo" />, // Chungang University Logo
      transcriptLink: 'https://github.com/fhzh123/fhzh123/blob/main/Transcript/PhD_Transcript_KyohoonJin.pdf', // Placeholder link for transcript
    },
    {
      degree: 'MS',
      university: 'Chung-Ang University',
      period: 'Mar 2019 - Feb 2021',
      grade: '4.38/4.5',
      subjects: 'Machine Learning, Deep Learning, Natural Language Processing',
      thesis: '병렬형 트랜스포머 모델을 활용한 한국 고문서 번역 및 분석', // Added thesis for MS
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang University Logo" />, // Chungang University Logo
      transcriptLink: 'https://github.com/fhzh123/fhzh123/blob/main/Transcript/MS_Transcript_KyohoonJin.pdf', // Placeholder link for transcript
    },
    {
      degree: 'BS',
      university: 'Gachon University, Applied Statistics',
      period: 'Mar 2013 - Feb 2019',
      grade: '3.65/4.5',
      subjects: 'Mathematical Statistics, Multivariate Data Analysis',
      icon: <IconPlaceholder src="https://i.ibb.co/JL7VBL0/1.png" alt="Gachon University Logo Placeholder" />, // Placeholder for Gachon University Logo
      transcriptLink: 'https://github.com/fhzh123/fhzh123/blob/main/Transcript/BS_Transcript_KyohoonJin.pdf', // Placeholder link for transcript
    },
  ],
    projects: projectsEN_,
    internationalPublications: internationalPublications_,
    domesticPublications: domesticPublications_,
    lectures: lectures_,
    honors: honors_,
    patent: patentDetails_,
  };

 // Sample data for Experience
  const experienceDetails = experience_;

  // Sample data for Education
  const educationDetails = [
    {
      degree: 'Ph.D',
      university: 'Chung-Ang University',
      period: 'Mar 2021 - Feb 2025',
      grade: '4.20/4.5',
      subjects: 'Deep Learning, Natural Language Processing',
      thesis: 'Counterbias text augmentation : mitigation of multiple spurious correlations and dataset bias', // Added thesis for PhD
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang University Logo" />, // Chungang University Logo
      transcriptLink: 'https://github.com/fhzh123/fhzh123/blob/main/Transcript/PhD_Transcript_KyohoonJin.pdf', // Placeholder link for transcript
    },
    {
      degree: 'MS',
      university: 'Chung-Ang University',
      period: 'Mar 2019 - Feb 2021',
      grade: '4.38/4.5',
      subjects: 'Machine Learning, Deep Learning, Natural Language Processing',
      thesis: '병렬형 트랜스포머 모델을 활용한 한국 고문서 번역 및 분석', // Added thesis for MS
      icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang University Logo" />, // Chungang University Logo
      transcriptLink: 'https://github.com/fhzh123/fhzh123/blob/main/Transcript/MS_Transcript_KyohoonJin.pdf', // Placeholder link for transcript
    },
    {
      degree: 'BS',
      university: 'Gachon University, Applied Statistics',
      period: 'Mar 2013 - Feb 2019',
      grade: '3.65/4.5',
      subjects: 'Mathematical Statistics, Multivariate Data Analysis',
      icon: <IconPlaceholder src="https://i.ibb.co/JL7VBL0/1.png" alt="Gachon University Logo Placeholder" />, // Placeholder for Gachon University Logo
      transcriptLink: 'https://github.com/fhzh123/fhzh123/blob/main/Transcript/BS_Transcript_KyohoonJin.pdf', // Placeholder link for transcript
    },
  ];

  // Define a consistent height for the content area
  const contentFixedHeightClass = "h-[615px]"; // Adjusted height to ensure consistency and prevent overflow

  // Social media links and corresponding icons (using IconPlaceholder for images)
  const socialLinks = socialLinks_;

  // State to manage the currently displayed data
  const [currentData, setCurrentData] = useState(koData);

  // Function to render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'Experience':
        return (
          <div key="experience-content" className={`px-6 md:px-8 pt-0 md:pt-0 ${contentFixedHeightClass} overflow-y-auto animate-tabContentFadeIn`}>
            {currentData.experienceDetails.map((exp, index) => (
              <div key={index} className={`bg-gray-800 p-3 rounded-lg shadow-md transition-all duration-300 hover:shadow-xl hover:bg-gray-700 hover:translate-y-[-3px] ${index < currentData.experienceDetails.length - 1 ? 'border-b border-gray-700 pb-4' : ''} mb-2`}>
                <div className="flex items-center text-lg md:text-xl font-bold mb-1 text-sky-400">
                  {exp.icon}
                  {exp.title}
                </div>
                <div className="text-sm md:text-base text-gray-400 mb-1">{exp.company}</div>
                <div className="text-sm md:text-base text-gray-400 mb-2">{exp.period}</div>
                {exp.title.startsWith('Student Researcher') ? <AcademicResearchSummary language={language} onPublications={()=>{setActiveTab('Publications');setActivePaperType('International');}} /> : <p className="text-sm md:text-base text-gray-300" dangerouslySetInnerHTML={{ __html: exp.description }}></p>}
              </div>
            ))}
          </div>
        );
      case 'Education':
        return (
          <div key="education-content" className={`px-6 md:px-8 pt-0 md:pt-0 ${contentFixedHeightClass} overflow-y-auto animate-tabContentFadeIn`}>
            {currentData.educationDetails.map((edu, index) => (
              <div key={index} className={`bg-gray-800 p-3 rounded-lg shadow-md transition-all duration-300 hover:shadow-xl hover:bg-gray-700 hover:translate-y-[-3px] ${index < currentData.educationDetails.length - 1 ? 'border-b border-gray-700 pb-4' : ''} mb-2`}>
                <div className="flex items-center text-lg md:text-xl font-bold mb-1 text-sky-400">
                  {edu.icon}
                  {edu.degree} - {edu.university}
                </div>
                <div className="text-sm md:text-base text-gray-400 mb-2">{edu.period}</div>
                {['Ph.D','MS'].includes(edu.degree) && (
                  <div className="education-lab">
                    <a href="https://iiplcau.github.io/" target="_blank" rel="noopener noreferrer">
                      {language === 'ko' ? '지능형 정보처리 연구실' : 'Intelligent Information Processing Lab.'}
                      <span aria-hidden="true"> ↗</span>
                    </a>
                    <span className="education-advisor">{language === 'ko' ? '지도교수: 김영빈' : 'Advisor: Youngbin Kim'}</span>
                  </div>
                )}
                <div className="text-sm md:text-base text-gray-300 flex items-center mb-1">
                  {language === 'ko' ? '학점: ' : 'Grade: '}{edu.grade}
                  {edu.transcriptLink && (
                    <a
                      href={edu.transcriptLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-400 hover:underline text-sm md:text-base"
                    >
                      {currentData.buttons.transcript}
                    </a>
                  )}
                </div>
                <div className="text-sm md:text-base text-gray-400">{language === 'ko' ? '주요 과목: ' : 'Subjects: '}{edu.subjects}</div>
                {(edu.degree === 'MS' || edu.degree === 'Ph.D') && edu.thesis && (
                  <div className="text-sm md:text-base text-gray-300 mt-1">{language === 'ko' ? '학위논문: ' : 'Thesis: '}<a className="resume-thesis-link" href={edu.degree === 'Ph.D' ? phdThesis.href : msThesis.href} target="_blank" rel="noopener noreferrer">{edu.degree === 'Ph.D' ? phdThesis.title : msThesis.title} <span aria-hidden="true">↗</span></a></div>
                )}
              </div>
            ))}
          </div>
        );
      case 'Projects':
        return (
          <div key="projects-content" className={`px-6 md:px-8 pt-0 md:pt-1 ${contentFixedHeightClass} flex flex-col justify-between overflow-y-auto animate-tabContentFadeIn`}>
            <div>
              {currentData.projects.map((project, index) => (
                <div key={index} className={`bg-gray-800 p-3 rounded-lg shadow-md transition-all duration-300 hover:shadow-xl hover:bg-gray-700 hover:translate-y-[-3px] ${index < currentData.projects.length - 1 ? 'border-b border-gray-700 pb-5' : ''} mb-2`}>
                  <div className="flex items-center text-lg md:text-xl font-bold mb-1 text-sky-400">
                    {project.icon}
                    {project.icon2 && <span className="ml-0">{project.icon2}</span>}
                    {projectTitle(project)}
                  </div>
                  <div className="text-sm md:text-base text-gray-400 mb-2">{project.period}</div>
                  <p className="text-sm md:text-base text-gray-300 mb-2" dangerouslySetInnerHTML={{ __html: project.description }}></p>
                  <button
                    onClick={() => setSelectedProject(project)}
                    className="text-blue-400 hover:underline text-sm md:text-base cursor-pointer"
                  >
                    {currentData.buttons.viewDetails}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      case 'Publications':
        const currentPublications = activePaperType === 'International' ? currentData.internationalPublications : currentData.domesticPublications;
        return (
          <div key="publications-content" className={`p-3 md:p-3 ${contentFixedHeightClass} flex flex-col justify-between overflow-y-auto animate-tabContentFadeIn`}>
            {/* Publication Type Selector */}
            <div className="flex justify-center mt-[-0.5rem] mb-0.5 bg-gray-700 rounded-lg p-2">
              <button
                onClick={() => setActivePaperType('International')}
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-md font-semibold transition-colors duration-200 text-sm md:text-base ${
                  activePaperType === 'International' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'
                }`}
              >
                {currentData.buttons.internationalPaper}
              </button>
              <button
                onClick={() => setActivePaperType('Domestic')}
                className={`ml-2 md:ml-4 px-3 py-1.5 md:px-4 md:py-2 rounded-md font-semibold transition-colors duration-200 text-sm md:text-base ${
                  activePaperType === 'Domestic' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'
                }`}
              >
                {currentData.buttons.domesticPaper}
              </button>
            </div>

            <div key={activePaperType} className="animate-tabContentFadeIn"> {/* Added key and animation for sub-tab content */}
              {currentPublications.map((pub, index) => (
                <div key={index} className={`bg-gray-800 p-4 rounded-lg shadow-md transition-all duration-300 hover:shadow-xl hover:bg-gray-700 hover:translate-y-[-3px] ${index < currentPublications.length - 1 ? 'border-b border-gray-700 pb-3' : ''} mb-2`}>
                  <div className="flex items-center text-lg md:text-xl font-bold mb-1 text-sky-400">
                    {pub.icon}
                    {pub.title}
                  </div>
                  <div className="text-sm md:text-base text-gray-400 mb-1" dangerouslySetInnerHTML={{ __html: `${language === 'ko' ? '저자: ' : 'Author: '}${pub.author}` }}></div>
                  <div className="text-sm md:text-base text-gray-400 mb-2">{language === 'en' ? (pub.journalEN || pub.journal) : pub.journal}</div>
                  <a
                    href={pub.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="resume-paper-link"
                    aria-label={`${language === 'ko' ? '논문' : 'Paper'}: ${pub.title}`}
                  >
                    <span>{language === 'ko' ? '논문' : 'Paper'}</span><span className="external-arrow" aria-hidden="true">↗</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        );
      case 'Honors & Lecture':
        const currentLectureHonors = activeLectureHonorsType === 'Lecture' ? currentData.lectures : currentData.honors;
        return (
          <div key="lecture-honors-content" className={`px-6 md:px-8 pt-0 md:pt-1 ${contentFixedHeightClass} flex flex-col justify-between overflow-y-auto animate-tabContentFadeIn`}>
            <div className="flex justify-center mt-0 mb-0 bg-gray-700 rounded-lg p-2">
              {['Honors','Lecture'].map(type => (
                <button key={type} onClick={() => setActiveLectureHonorsType(type)}
                  className={`px-3 py-1.5 md:px-4 md:py-2 rounded-md font-semibold transition-colors duration-200 text-sm md:text-base ${activeLectureHonorsType === type ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>
                  {type === 'Honors' ? currentData.buttons.honors : currentData.buttons.lecture}
                </button>
              ))}
            </div>

            <div key={activeLectureHonorsType} className="animate-tabContentFadeIn"> {/* Added key and animation for sub-tab content */}
              {currentLectureHonors.map((item, index) => (
                <div key={index} className={`bg-gray-800 p-5 rounded-lg shadow-md transition-all duration-300 hover:shadow-xl hover:bg-gray-700 hover:translate-y-[-3px] ${index < currentLectureHonors.length - 1 ? 'border-b border-gray-700 pb-2' : ''} mb-2`}>
                  <div className="flex items-center text-lg md:text-xl font-bold mb-1 text-sky-400">
                    {item.icon}
                    {item.title}
                  </div>
                  {activeLectureHonorsType === 'Lecture' ? (
                    <>
                      <div className="text-sm md:text-base text-gray-400 mb-2">{item.date}</div>
                      <div className="text-sm md:text-base text-gray-300">{language === 'ko' ? '장소: ' : 'Venue: '}{item.venue}</div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm md:text-base text-gray-400 mb-2">{item.awarder}</div>
                      <div className="text-sm md:text-base text-gray-300">{item.year}</div>
                      <p className="text-sm md:text-base text-gray-300 mt-2">{item.description}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      case 'Patent': // New case for Patent
        return (
          <div key="patent-content" className={`px-3 md:px-4 pt-0 md:pt-1 ${contentFixedHeightClass} overflow-y-auto animate-tabContentFadeIn`}>
            {currentData.patent.map((patent, index) => (
              <div key={index} className={`bg-gray-800 p-5 rounded-lg shadow-md transition-all duration-300 hover:shadow-xl hover:bg-gray-700 hover:translate-y-[-3px] ${index < currentData.patent.length - 1 ? 'border-b border-gray-700 pb-2' : ''} mb-2`}>
                <div className="flex items-center text-lg md:text-xl font-bold mb-1 text-sky-400">
                  {patent.icon}
                  {patent.title}
                </div>
                <div className="text-sm md:text-base text-gray-400 mb-1" dangerouslySetInnerHTML={{ __html: `${language === 'ko' ? '발명자: ' : 'Inventors: '}${patent.inventors}` }}></div>
                <div className="text-sm md:text-base text-gray-400 mb-1">{language === 'ko' ? '출원번호: ' : 'Application No.: '}{patent.applicationNumber}</div>
                <div className="text-sm md:text-base text-gray-400 mb-2">{language === 'ko' ? '등록번호: ' : 'Registration No.: '}{patent.registrationNumber} ({patent.date})</div>
                <p className="text-sm md:text-base text-gray-300 mb-2">{patent.description}</p>
                {patent.link !== '#' && (
                  <a
                    href={patent.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline text-sm md:text-base"
                  >
                    {currentData.buttons.viewDetails}
                  </a>
                )}
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="resume-shell min-h-screen text-gray-200 flex flex-col items-center justify-start"
    >
      {/* Top Bar - About Me */}
      <div className="resume-topbar w-full max-w-7xl bg-gray-800 p-4 md:p-5 rounded-lg shadow-lg mb-4 md:mb-5 flex items-center justify-between animate-fadeIn">
        {/* Name and Icon */}
        <span className="text-2xl md:text-3xl font-bold text-sky-400 mr-2 md:mr-3 flex items-center">
          <img src="/mascot/face.png" alt="마스코트 얼굴" className="resume-face" width="40" height="40" />
          {currentData.header.name}
        </span>

        <div className="resume-header-actions">
          {canReturnHome && <a className="resume-icon-action" href="/" aria-label={language === 'ko' ? '홈으로' : 'Home'} title={language === 'ko' ? '홈으로' : 'Home'}><UiIcon name="house" /></a>}
          <button type="button" className="theme-toggle resume-icon-action" data-theme-toggle aria-label="라이트 모드로 전환" aria-pressed="true"><span className="theme-sun"><UiIcon name="sun" /></span><span className="theme-moon"><UiIcon name="moon" /></span><span data-theme-label hidden>라이트 모드</span></button>
        {/* Language Toggle Button for Desktop - FIXED AND IMPROVED */}
        {/* The toggle is now more robust by using flexbox for equal spacing and simpler positioning for the sliding background. */}
        <div className="resume-language flex items-center relative h-10 w-28 bg-gray-700 rounded-full p-1 transition-all duration-300">
          {/* Sliding background element. The position and size are now more accurately
              calculated relative to the container's padding. */}
          <div
            className={`absolute top-1 left-1 h-[calc(100%-0.5rem)] w-[calc(50%-0.25rem)] rounded-full bg-blue-600 transition-transform duration-300 ease-in-out z-0
            ${language === 'en' ? 'transform translate-x-full' : 'transform translate-x-0'}`}
          ></div>
          <label
            htmlFor="ko-lang-desktop"
            className={`relative z-10 flex-1 text-center font-bold cursor-pointer transition-colors duration-300 py-2 rounded-full ${
              language === 'ko' ? 'text-white' : 'text-gray-400'
            }`}
          >
            KO
          </label>
          <input type="radio" id="ko-lang-desktop" name="lang-desktop" checked={language === 'ko'} onChange={() => setLanguage('ko')} className="hidden" />
          <label
            htmlFor="en-lang-desktop"
            className={`relative z-10 flex-1 text-center font-bold cursor-pointer transition-colors duration-300 py-2 rounded-full ${
              language === 'en' ? 'text-white' : 'text-gray-400'
            }`}
          >
            EN
          </label>
          <input type="radio" id="en-lang-desktop" name="lang-desktop" checked={language === 'en'} onChange={() => setLanguage('en')} className="hidden" />
        </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-4 md:gap-5 animate-fadeIn">
        {/* Left Profile Section */}
        <div className="flex-1 bg-gray-800 p-6 md:p-8 rounded-lg shadow-lg flex flex-col items-center">
          {/* Profile Picture with Flip Animation and added effects */}
          <div
            className="w-32 h-32 md:w-48 md:h-48 mb-4 md:mb-6 perspective-1000 cursor-pointer rounded-full overflow-hidden border-4 border-blue-500 transition-transform duration-300 hover:scale-105 animate-glowPulse"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div
              className={`relative w-full h-full transition-transform duration-700`}
              style={{
                transformStyle: 'preserve-3d',
                transformOrigin: 'center',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
              }}
            >
              {/* Front Face */}
              <div
                className="absolute inset-0 w-full h-full"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(0deg)'
                }}
              >
                <img
                  src="https://raw.githubusercontent.com/fhzh123/fhzh123/refs/heads/main/KyohoonJin_%ED%94%84%EB%A1%9C%ED%95%84%EC%82%AC%EC%A7%84.jpg"
                  alt="Profile Front"
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Back Face */}
              <div
                className="absolute inset-0 w-full h-full transform rotate-y-180"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)'
                }}
              >
                <img
                  src="https://github.com/fhzh123/image_upload_for_kyohoon/blob/main/kyohoon_back_profile.png?raw=true"
                  alt="Profile Back"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Emphasized 'AI Research Engineer' text */}
          <div className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-center">
            <span className="text-sky-400">{currentData.header.title}</span> {language === 'ko' ? 'at' : 'at'} {currentData.header.at}
          </div>
          {/* About Me Text with Dynamic Font Sizing (No Scrollbar) */}
          <p className={`leading-relaxed text-center mb-3 md:mb-4 transition-all duration-300
            ${language === 'en' ? 'text-sm md:text-small' : 'text-base md:text-lg'}
          `}>
            {currentData.header.about}
          </p>

          {/* Contact Box */}
          <div className="mt-auto w-full bg-gray-700 p-4 md:p-5 rounded-lg shadow-md border border-gray-600">
            <h3 className="text-lg md:text-xl font-bold text-sky-400 mb-2 text-center">{currentData.header.contactTitle}</h3>
            <p className="text-xs md:text-sm text-gray-300 mb-3 md:mb-4 text-center">{currentData.header.contactMessage}</p>
            <div className="flex flex-wrap justify-center gap-3 md:gap-4">
              {socialLinks.map((link, index) => (
                <a
                  key={index}
                  onClick={link.kakaoQrImageUrl ? () => setShowKakaoQr(true) : null}
                  href={link.url || '#'}
                  target={link.url ? "_blank" : "_self"}
                  rel={link.url ? "noopener noreferrer" : ""}
                  className="text-blue-400 cursor-pointer transition-transform duration-300 hover:scale-125 active:scale-95"
                  title={link.name}
                >
                  {link.icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Right Content Section */}
        <div className="flex-[2] bg-gray-800 rounded-lg shadow-lg flex flex-col">
          {/* Menu Bar: Updated order and colors */}
          <nav className="resume-tabs" aria-label="Resume 항목">
            {[
              ['Experience', 'experience', 'briefcase-business'], ['Education', 'education', 'graduation-cap'],
              ['Projects', 'projects', 'folder-open'], ['Publications', 'publications', 'book-open'],
              ['Honors & Lecture', 'lectureHonors', 'award'], ['Patent', 'patent', 'scroll-text'],
            ].map(([tab, label, icon]) => <button type="button" key={tab} aria-pressed={activeTab === tab}
              className={activeTab === tab ? 'resume-tab is-active' : 'resume-tab'} onClick={() => setActiveTab(tab)}>
              <UiIcon name={icon} /><span>{currentData.menu[label]}</span>
            </button>)}
          </nav>

          {/* Dynamically rendered content based on activeTab */}
          {renderContent()}
        </div>
      </div>

      {/* Floating Language Toggle for Mobile */}
      <button
        onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
        className="lg:hidden fixed bottom-6 right-6 bg-blue-600 text-white text-xl p-3 rounded-full shadow-lg transition-transform duration-300 hover:scale-110 active:scale-95"
        title="Toggle Language"
      >
        🌐
      </button>

      {/* Footer / Copyright */}
      <footer className="w-full max-w-7xl text-center text-gray-500 text-xs md:text-sm mt-8 md:mt-10 p-3 md:p-4">
        © 2026 Kyohoon Jin. All rights reserved.
      </footer>

      {/* Project Detail Modal */}
      {selectedProject && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={(e) => {
            // Close modal only if clicked on the backdrop (not on the modal content itself)
            if (e.target === e.currentTarget) {
              setSelectedProject(null);
            }
          }}
        >
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 md:p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setSelectedProject(null)}
              className="absolute top-3 right-3 md:top-4 md:right-4 text-gray-400 hover:text-white text-2xl md:text-3xl font-bold transition-colors duration-200"
            >
              &times;
            </button>
            <h2 className="text-2xl md:text-3xl font-bold text-sky-400 mb-3 md:mb-4">{projectTitle(selectedProject)}</h2>
            {selectedProject.imageUrl && (
              <>
                {isLoadingImage && (
                  <div className="flex items-center justify-center h-48 bg-gray-700 rounded-lg mb-4 md:mb-6">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                  </div>
                )}
                <img
                  src={selectedProject.imageUrl}
                  alt={selectedProject.title}
                  className={`w-full h-auto rounded-lg object-cover ${isLoadingImage ? 'hidden' : 'block'}`}
                  onLoad={() => setIsLoadingImage(false)}
                  onError={event => { event.currentTarget.style.display = 'none'; setIsLoadingImage(false); }}
                />
              </>
            )}
            {selectedProject.subtitle && (
              <h3 className="text-lg md:text-xl font-semibold text-gray-300 mb-2 md:mb-3">{selectedProject.subtitle}</h3>
            )}
            <p className="text-sm md:text-base text-gray-200 mb-3 md:mb-4 leading-relaxed">{selectedProject.fullDescription}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm text-gray-300 mb-4 md:mb-6">
              {selectedProject.companyOrInstitution && (
                <div>
                  <span className="font-semibold text-sky-300">{language === 'ko' ? '협력 기관/업체:' : 'Institution:'}</span> {selectedProject.companyOrInstitution}
                </div>
              )}
              {selectedProject.period && (
                <div>
                  <span className="font-semibold text-sky-300">{language === 'ko' ? '프로젝트 기한:' : 'Period:'}</span> {selectedProject.period}
                </div>
              )}
              {selectedProject.role && (
                <div className="md:col-span-2">
                  <span className="font-semibold text-sky-300">{language === 'ko' ? '역할:' : 'Role:'}</span> {selectedProject.role}
                </div>
              )}
            </div>

            {selectedProject.externalLinks && selectedProject.externalLinks.length > 0 && (
              <div className="mt-4 md:mt-6 border-t border-gray-700 pt-4 md:pt-6">
                <h4 className="text-base md:text-lg font-semibold text-sky-400 mb-2 md:mb-3">{language === 'ko' ? '추가 정보' : 'External Links'}</h4>
                <div className="flex flex-wrap gap-2 md:gap-3">
                  {selectedProject.externalLinks.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-700 hover:bg-blue-600 text-white py-1.5 px-3 md:py-2 md:px-4 rounded-md transition-colors duration-200 text-xs md:text-sm"
                    >
                      {link.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KakaoTalk QR Modal */}
      {showKakaoQr && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 md:p-8 w-full max-w-sm relative text-center">
            <button
              onClick={() => setShowKakaoQr(false)}
              className="absolute top-3 right-3 md:top-4 md:right-4 text-gray-400 hover:text-white text-2xl md:text-3xl font-bold transition-colors duration-200"
            >
              &times;
            </button>
            <h2 className="text-2xl md:text-3xl font-bold text-sky-400 mb-4">{language === 'ko' ? '카카오톡 QR 코드' : 'KakaoTalk QR Code'}</h2>
            <img
              src={socialLinks.find(link => link.name === 'KakaoTalk')?.kakaoQrImageUrl}
              alt="카카오톡 QR 코드"
              className="w-48 h-48 mx-auto rounded-lg object-cover border-2 border-blue-500"
            />
            <p className="text-sm text-gray-300 mt-4">{language === 'ko' ? '카카오톡 앱으로 QR 코드를 스캔해주세요.' : 'Please scan the QR code with the KakaoTalk app.'}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
