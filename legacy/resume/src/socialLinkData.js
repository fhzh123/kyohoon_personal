// Placeholder for icons (user will insert images here)
const IconPlaceholder = ({ src, alt }) => (
<div className="resume-contact-icon">
    {src && <img src={src} alt={alt} width="24" height="24" />}
</div>
);

const socialLinks_ = [
    {
      name: 'Email_naver',
      icon: <IconPlaceholder src="https://i.ibb.co/xSrkVscL/mail.png" alt="Email Icon" />,
      url: 'mailto:fhzh@naver.com'
    },
    {
      name: 'Email_gmail',
      icon: <IconPlaceholder src="https://cdn-icons-png.flaticon.com/512/281/281769.png" alt="Email Icon2" />,
      url: 'mailto:fhzh12345@gmail.com'
    },
    {
      name: 'KakaoTalk',
      icon: <IconPlaceholder src="/icons/kakaotalk.svg" alt="KakaoTalk Icon" />,
      kakaoQrImageUrl: 'https://i.ibb.co/VYhm8hmW/image.png', // Placeholder QR image
    },
    {
      name: 'Telegram',
      icon: <IconPlaceholder src="/icons/telegram.svg" alt="Telegram Icon" />,
      url: 'https://t.me/iipl_kyohoon' // Replace with actual Telegram link
    },
    {
      name: 'GitHub',
      icon: <IconPlaceholder src="https://github.githubassets.com/favicons/favicon.svg" alt="GitHub Icon" />,
      url: 'https://github.com/fhzh123' // Replace with actual GitHub username
    },
    {
      name: 'LinkedIn',
      icon: <IconPlaceholder src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn Icon" />,
      url: 'https://www.linkedin.com/in/kyohoon/' // Replace with actual LinkedIn profile
    },
    {
      name: 'Google Scholar',
      icon: <IconPlaceholder src="/icons/googlescholar.svg" alt="Google Scholar Icon" />,
      url: 'https://scholar.google.com/citations?user=l-y1_AkAAAAJ&hl=ko&oi=ao' // Replace with actual Google Scholar ID
    },
    {
      name: 'OpenReview',
      icon: <IconPlaceholder src="https://pbs.twimg.com/profile_images/1309249465056989189/Wwyw4IhM_400x400.jpg" alt="OpenReview Icon" />,
      url: 'https://openreview.net/profile?id=~Kyohoon_Jin1' // Placeholder URL
    },
    {
      name: 'Notion',
      icon: <IconPlaceholder src="https://eventusstorage.blob.core.windows.net/evs/UploadedFiles/notionkr/TopLogoImage/fddf217de3624a6494fe15767bc3e844.png" alt="Notion Icon" />,
      url: 'https://rhetorical-branch-d93.notion.site/?pvs=73' // Placeholder URL
    },
  ];

export default socialLinks_;
