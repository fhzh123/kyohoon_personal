// Placeholder for icons (user will insert images here)
const IconPlaceholder = ({ src, alt }) => (
<div className="w-6 h-6 mr-2 flex-shrink-0 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
    {src && <img src={src} alt={alt} className="w-full h-full object-cover" />}
</div>
);

const patentDetails_ = [
    {
    title: '의미 기반 텍스트 삼중 구조를 이용한 편향 완화를 위한 데이터 증강 방법 및 이를 수행하기 위한 컴퓨팅 장치',
    inventors: '김영빈, <strong>진교훈</strong>, 최주환, 윤정민, 이준호, 장수진',
    applicationNumber: '10-2024-0125768',
    registrationNumber: '출원 중',
    date: '2024.09.13',
    description: '결정 경계 인식 및 재구성을 통한 데이터 다양성 증강방법 및 장치',
    link: '#', // Placeholder link
    icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang University Logo" />,
    },
    {
    title: '결정 경계 인식 및 재구성을 통한 데이터 다양성 증강방법 및 장치 (Data diversity augmentation device and method for decision boundary attention and the reconstruction)',
    inventors: '김영빈, <strong>진교훈</strong>',
    applicationNumber: '10-2024-0125768',
    registrationNumber: '출원 중',
    date: '2024.09.13',
    description: '결정 경계 인식 및 재구성을 통한 데이터 다양성 증강방법 및 장치',
    link: '#', // Placeholder link
    icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang University Logo" />,
    },
    {
    title: '이미지 스타일 변형 장치 및 방법 (Apparatus and method for image style transformation)',
    inventors: '김영빈, <strong>진교훈</strong>, 김재원',
    applicationNumber: '10-2022-0159378',
    registrationNumber: '1026681160000',
    date: '2024.05.17',
    description: '스타일 레이블을 기초로 원본 이미지의 구조 변경 없이 스타일만 변형하는 이미지 스타일 변형 장치 및 방법',
    link: '#', // Placeholder link for patent document
    icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang University Logo" />,
    },
    {
    title: '교통 흐름 예측 장치 및 방법 (Apparatus and method for traffic flow prediction)',
    inventors: '김영빈, <strong>진교훈</strong>',
    applicationNumber: '10-2022-0159377',
    registrationNumber: '1026141180000',
    date: '2023.12.13',
    description: '도로의 종류 및 위치에 독립적으로 교통 흐름을 예측할 수 있는 교통 흐름 예측 장치 및 방법',
    link: '#', // Placeholder link
    icon: <IconPlaceholder src="https://i.ibb.co/fVzmnTgG/1.png" alt="Chungang University Logo" />,
    },
];

export default patentDetails_;