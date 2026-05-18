// Nigerian Languages organized by geopolitical zones

export interface Language {
  id: string;
  name: string;
  nativeName: string;
  speakers: string;
  states: string[];
  description: string;
}

export interface Region {
  id: string;
  name: string;
  languages: Language[];
}

export const NIGERIAN_LANGUAGES: Region[] = [
  {
    id: 'lingua-franca',
    name: 'Lingua Franca',
    languages: [
      {
        id: 'pidgin',
        name: 'Nigerian Pidgin English',
        nativeName: 'Naija',
        speakers: '75 million+',
        states: ['All States'],
        description: 'Nigerian Pidgin, also called Naija or Broken English, is an English-based creole language spoken as a lingua franca across Nigeria. It is one of the most widely spoken languages in the country, used in informal settings, markets, and popular culture.'
      }
    ]
  },
  {
    id: 'south-south',
    name: 'South-South',
    languages: [
      {
        id: 'edo',
        name: 'Edo (Bini)',
        nativeName: 'Ẹ̀dó',
        speakers: '4 million+',
        states: ['Edo'],
        description: 'Edo, also known as Bini, is spoken by the Edo people of Edo State in southern Nigeria. It is the language of the ancient Benin Kingdom.'
      },
      {
        id: 'efik',
        name: 'Efik',
        nativeName: 'Efịk',
        speakers: '2 million+',
        states: ['Cross River', 'Akwa Ibom'],
        description: 'Efik is spoken by the Efik people in Cross River and Akwa Ibom states. It is closely related to Ibibio.'
      },
      {
        id: 'ibibio',
        name: 'Ibibio',
        nativeName: 'Ibibio',
        speakers: '4 million+',
        states: ['Akwa Ibom'],
        description: 'Ibibio is spoken by the Ibibio people of Akwa Ibom State. It is one of the major languages in the Niger Delta region.'
      },
      {
        id: 'ijaw',
        name: 'Ijaw (Izon)',
        nativeName: 'Ịjọ',
        speakers: '2 million+',
        states: ['Bayelsa', 'Delta', 'Rivers'],
        description: 'Ijaw is spoken by the Ijaw people across the Niger Delta. It has several dialects including Izon, Kalabari, and Nembe.'
      },
      {
        id: 'urhobo',
        name: 'Urhobo',
        nativeName: 'Urhobo',
        speakers: '2 million+',
        states: ['Delta'],
        description: 'Urhobo is spoken by the Urhobo people of Delta State. It is one of the major languages in the Niger Delta.'
      },
      {
        id: 'isoko',
        name: 'Isoko',
        nativeName: 'Isoko',
        speakers: '1 million+',
        states: ['Delta'],
        description: 'Isoko is spoken by the Isoko people of Delta State. It is closely related to Urhobo.'
      }
    ]
  },
  {
    id: 'south-west',
    name: 'South-West',
    languages: [
      {
        id: 'yoruba',
        name: 'Yoruba',
        nativeName: 'Yorùbá',
        speakers: '40 million+',
        states: ['Lagos', 'Ogun', 'Oyo', 'Osun', 'Ondo', 'Ekiti'],
        description: 'Yoruba is one of the three major languages of Nigeria. It is spoken by the Yoruba people across southwestern Nigeria and in neighboring countries.'
      }
    ]
  },
  {
    id: 'south-east',
    name: 'South-East',
    languages: [
      {
        id: 'igbo',
        name: 'Igbo',
        nativeName: 'Ásụ̀sụ́ Ìgbò',
        speakers: '30 million+',
        states: ['Abia', 'Anambra', 'Ebonyi', 'Enugu', 'Imo'],
        description: 'Igbo is one of the three major languages of Nigeria. It is spoken by the Igbo people of southeastern Nigeria.'
      }
    ]
  },
  {
    id: 'north-central',
    name: 'North-Central',
    languages: [
      {
        id: 'nupe',
        name: 'Nupe',
        nativeName: 'Nupe',
        speakers: '1 million+',
        states: ['Niger', 'Kwara', 'Kogi'],
        description: 'Nupe is spoken by the Nupe people in Niger, Kwara, and Kogi states.'
      },
      {
        id: 'tiv',
        name: 'Tiv',
        nativeName: 'Tiv',
        speakers: '4 million+',
        states: ['Benue', 'Taraba'],
        description: 'Tiv is spoken by the Tiv people of Benue and Taraba states. It is one of the major languages in the Middle Belt.'
      },
      {
        id: 'idoma',
        name: 'Idoma',
        nativeName: 'Idoma',
        speakers: '1 million+',
        states: ['Benue'],
        description: 'Idoma is spoken by the Idoma people of Benue State.'
      },
      {
        id: 'igala',
        name: 'Igala',
        nativeName: 'Igala',
        speakers: '2 million+',
        states: ['Kogi'],
        description: 'Igala is spoken by the Igala people of Kogi State. It is related to Yoruba and Edo.'
      },
      {
        id: 'ebira',
        name: 'Ebira',
        nativeName: 'Ebira',
        speakers: '2 million+',
        states: ['Kogi', 'Kwara', 'Nasarawa'],
        description: 'Ebira is spoken by the Ebira people across Kogi, Kwara, and Nasarawa states.'
      }
    ]
  },
  {
    id: 'north-west',
    name: 'North-West',
    languages: [
      {
        id: 'hausa',
        name: 'Hausa',
        nativeName: 'Harshen Hausa',
        speakers: '70 million+',
        states: ['Kano', 'Kaduna', 'Katsina', 'Sokoto', 'Zamfara', 'Kebbi', 'Jigawa'],
        description: 'Hausa is one of the three major languages of Nigeria and the most widely spoken language in West Africa. It serves as a lingua franca across northern Nigeria.'
      },
      {
        id: 'fulfulde',
        name: 'Fulfulde (Fulani)',
        nativeName: 'Fulfulde',
        speakers: '15 million+',
        states: ['Sokoto', 'Kano', 'Kaduna', 'Bauchi', 'Adamawa'],
        description: 'Fulfulde is spoken by the Fulani people across northern Nigeria and West Africa.'
      }
    ]
  },
  {
    id: 'north-east',
    name: 'North-East',
    languages: [
      {
        id: 'kanuri',
        name: 'Kanuri',
        nativeName: 'Kanuri',
        speakers: '5 million+',
        states: ['Borno', 'Yobe'],
        description: 'Kanuri is spoken by the Kanuri people of Borno and Yobe states. It is the language of the ancient Kanem-Bornu Empire.'
      },
      {
        id: 'shuwa-arabic',
        name: 'Shuwa Arabic',
        nativeName: 'Shuwa Arabic',
        speakers: '1 million+',
        states: ['Borno', 'Yobe'],
        description: 'Shuwa Arabic is spoken by the Shuwa Arabs in northeastern Nigeria.'
      },
      {
        id: 'bachama',
        name: 'Bachama',
        nativeName: 'Bachama',
        speakers: '500,000+',
        states: ['Adamawa'],
        description: 'Bachama is spoken by the Bachama people of Adamawa State.'
      },
      {
        id: 'bura',
        name: 'Bura',
        nativeName: 'Bura',
        speakers: '300,000+',
        states: ['Borno', 'Adamawa'],
        description: 'Bura is spoken by the Bura people in Borno and Adamawa states.'
      }
    ]
  }
];
