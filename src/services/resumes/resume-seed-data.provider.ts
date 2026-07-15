import type { ResumeLanguage, ResumePhotoPalette } from '../../types/resume.js';

export interface ResumePersonSeed {
  fullName: string;
  age: number;
  location: string;
  email: string;
  phone: string;
  spokenLanguages: ResumeLanguage[];
  photoPalette: ResumePhotoPalette;
}

export interface ResumeSeedDataProvider {
  createPersonSeed(index: number): ResumePersonSeed;
  pickUniversity(index: number, offset?: number): string;
  pickLocation(index: number, offset?: number): string;
}

const FIRST_NAMES = [
  'Adrian',
  'Alicia',
  'Amelia',
  'Andrea',
  'Beatriz',
  'Bruno',
  'Carla',
  'Clara',
  'Daniel',
  'Diego',
  'Elena',
  'Enzo',
  'Eva',
  'Gabriel',
  'Hugo',
  'Irene',
  'Julia',
  'Leo',
  'Lucia',
  'Marina',
  'Martin',
  'Mateo',
  'Marta',
  'Nadia',
  'Nicolas',
  'Noa',
  'Paula',
  'Pilar',
  'Ruben',
  'Sofia',
  'Sergio',
  'Tomas',
  'Valeria',
];

const LAST_NAMES = [
  'Alonso',
  'Cabrera',
  'Campos',
  'Castro',
  'Delgado',
  'Dominguez',
  'Escobar',
  'Fernandez',
  'Garcia',
  'Gil',
  'Herrera',
  'Iglesias',
  'Lopez',
  'Marquez',
  'Martin',
  'Mendez',
  'Molina',
  'Navarro',
  'Ortega',
  'Pardo',
  'Prieto',
  'Reyes',
  'Romero',
  'Ruiz',
  'Santos',
  'Serrano',
  'Suarez',
  'Torres',
  'Vega',
];

const LOCATIONS = [
  'Madrid, Spain',
  'Barcelona, Spain',
  'Valencia, Spain',
  'Seville, Spain',
  'Bilbao, Spain',
  'Malaga, Spain',
  'Lisbon, Portugal',
  'Porto, Portugal',
  'Dublin, Ireland',
  'Amsterdam, Netherlands',
  'Berlin, Germany',
  'Warsaw, Poland',
];

const UNIVERSITIES = [
  'Universidad Politecnica de Madrid',
  'Universitat Politecnica de Catalunya',
  'University of Valencia',
  'University of Lisbon',
  'University of Porto',
  'Trinity College Dublin',
  'Technical University of Munich',
  'Warsaw University of Technology',
  'Universidad de Sevilla',
  'University of Deusto',
];

const LANGUAGE_PROFILES: ResumeLanguage[][] = [
  [
    { name: 'Spanish', level: 'Native' },
    { name: 'English', level: 'C1' },
  ],
  [
    { name: 'Spanish', level: 'Native' },
    { name: 'English', level: 'C1' },
    { name: 'French', level: 'B2' },
  ],
  [
    { name: 'Portuguese', level: 'Native' },
    { name: 'English', level: 'C1' },
    { name: 'Spanish', level: 'B2' },
  ],
  [
    { name: 'English', level: 'C1' },
    { name: 'Spanish', level: 'B2' },
    { name: 'German', level: 'B1' },
  ],
  [
    { name: 'Spanish', level: 'Native' },
    { name: 'English', level: 'C2' },
    { name: 'Italian', level: 'B1' },
  ],
];

const PHOTO_PALETTES: ResumePhotoPalette[] = [
  {
    background: [206, 224, 241],
    accent: [46, 95, 167],
    skin: [233, 197, 164],
    hair: [68, 48, 34],
    jacket: [43, 58, 84],
    shirt: [244, 244, 240],
  },
  {
    background: [232, 215, 205],
    accent: [178, 91, 54],
    skin: [205, 156, 118],
    hair: [52, 36, 27],
    jacket: [72, 74, 99],
    shirt: [248, 246, 241],
  },
  {
    background: [215, 235, 218],
    accent: [47, 124, 90],
    skin: [158, 98, 72],
    hair: [34, 29, 30],
    jacket: [34, 54, 65],
    shirt: [247, 245, 239],
  },
  {
    background: [240, 220, 235],
    accent: [141, 64, 106],
    skin: [121, 78, 55],
    hair: [23, 18, 21],
    jacket: [64, 56, 78],
    shirt: [247, 245, 244],
  },
  {
    background: [241, 229, 210],
    accent: [184, 122, 40],
    skin: [227, 188, 137],
    hair: [96, 69, 33],
    jacket: [51, 74, 100],
    shirt: [250, 249, 245],
  },
];

function pickByIndex<T>(values: T[], index: number, offset = 0): T {
  return values[(index + offset) % values.length];
}

function createFullName(index: number): string {
  const firstName = pickByIndex(FIRST_NAMES, index);
  const lastName = pickByIndex(LAST_NAMES, index * 3);
  const secondLastName = pickByIndex(LAST_NAMES, index * 5 + 4);
  return `${firstName} ${lastName} ${secondLastName}`;
}

function createEmail(fullName: string, index: number): string {
  const slug = fullName
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '');

  return `${slug}${index + 1}@mail.example`;
}

function createPhone(index: number): string {
  const secondBlock = `${10 + ((index * 7) % 90)}`.padStart(2, '0');
  const thirdBlock = `${100 + ((index * 137) % 900)}`.padStart(3, '0');
  const fourthBlock = `${100 + ((index * 173) % 900)}`.padStart(3, '0');
  return `+34 6${secondBlock} ${thirdBlock} ${fourthBlock}`;
}

export function createStaticResumeSeedDataProvider(): ResumeSeedDataProvider {
  return {
    createPersonSeed(index) {
      const fullName = createFullName(index);

      return {
        fullName,
        age: 24 + (index % 18),
        location: pickByIndex(LOCATIONS, index),
        email: createEmail(fullName, index),
        phone: createPhone(index),
        spokenLanguages: pickByIndex(LANGUAGE_PROFILES, index),
        photoPalette: pickByIndex(PHOTO_PALETTES, index),
      };
    },
    pickUniversity(index, offset = 0) {
      return pickByIndex(UNIVERSITIES, index, offset);
    },
    pickLocation(index, offset = 0) {
      return pickByIndex(LOCATIONS, index, offset);
    },
  };
}
