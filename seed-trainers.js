
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, serverTimestamp } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyDE-zkRDTCI",
    authDomain: "gymnow-mvp.firebaseapp.com",
    projectId: "gymnow-mvp",
    storageBucket: "gymnow-mvp.appspot.com",
    messagingSenderId: "795519849439",
    appId: "1:795519849439:web:32f58eab7978fd6503b41e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const gyms = [
    {
        id: 'gym-daegu-1',
        name: "킹덤 휘트니스 수성점",
        region: "대구 수성구",
        description: "수성구 최대 규모 프리미엄 피트니스 센터. 해머 스트렝스 정식 파트너사.",
        imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=800",
        isPilot: true,
        trainerCount: 2
    },
    {
        id: 'gym-daegu-2',
        name: "무브먼트 짐 반월당",
        region: "대구 중구",
        description: "도심 속 프라이빗한 운동 공간. 정교한 데이터 기반 트레이닝 솔루션.",
        imageUrl: "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&q=80&w=800",
        isPilot: true,
        trainerCount: 1
    }
];

const trainers = [
    {
        id: 'trainer-daegu-1',
        gymId: 'gym-daegu-1',
        name: "김강철",
        specialty: "코어 스트렝스 & 바디빌딩",
        verified: true,
        isEarlyVerified: true,
        trustScore: 9.8,
        description: "전국 보디빌딩 대회 1위 수상 경력. 과학적인 근거를 바탕으로 정교한 근비대 트레이닝을 제공합니다.",
        photoUrl: "https://images.unsplash.com/photo-1571019623452-8d9af2dfb282?auto=format&fit=crop&q=80&w=400",
        createdAt: serverTimestamp()
    },
    {
        id: 'trainer-daegu-2',
        gymId: 'gym-daegu-1',
        name: "이지유",
        specialty: "재활 전문 & 필라테스",
        verified: true,
        isEarlyVerified: true,
        trustScore: 9.6,
        description: "물리치료사 출신 트레이너. 통증 케어와 체형 교정을 전문으로 하며 부상 방지에 최선을 다합니다.",
        photoUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=400",
        createdAt: serverTimestamp()
    },
    {
        id: 'trainer-daegu-3',
        gymId: 'gym-daegu-2',
        name: "박태풍",
        specialty: "기능성 트레이닝 & HIIT",
        verified: true,
        isEarlyVerified: true,
        trustScore: 9.2,
        description: "역동적인 체력 증진을 위한 고강도 인터벌 트레이닝 전문. 빠른 지방 연소와 신체 능력 향상을 보장합니다.",
        photoUrl: "https://images.unsplash.com/photo-149175235542e-00bd74c675c0?auto=format&fit=crop&q=80&w=400",
        createdAt: serverTimestamp()
    }
];

async function seed() {
    console.log('Seeding Daegu Pilot Data with fixed IDs...');

    // Seed Gyms
    for (const gym of gyms) {
        try {
            await setDoc(doc(db, 'gyms', gym.id), gym);
            console.log(`Added Gym: ${gym.name} (ID: ${gym.id})`);
        } catch (e) {
            console.error(`Error adding gym ${gym.name}:`, e);
        }
    }

    // Seed Trainers
    for (const trainer of trainers) {
        try {
            await setDoc(doc(db, 'trainers', trainer.id), trainer);
            console.log(`Added Trainer: ${trainer.name} (ID: ${trainer.id})`);
        } catch (e) {
            console.error(`Error adding trainer ${trainer.name}:`, e);
        }
    }

    console.log('Seeding Complete! 🏛️⚖️💼');
    process.exit(0);
}

seed();
