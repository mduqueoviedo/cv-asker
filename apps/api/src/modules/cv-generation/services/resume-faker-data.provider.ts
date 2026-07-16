import { Faker, en, en_GB, es } from '@faker-js/faker';
import type {
  ResumeDocumentLanguage,
  ResumeGrammaticalGender,
  ResumePhotoPalette,
} from '../types/resume.js';

interface ResumeLocationSeed {
  city: string;
  country: string;
  phonePrefix: string;
}

export interface ResumePersonSeed {
  seed: number;
  fullName: string;
  grammaticalGender: ResumeGrammaticalGender;
  age: number;
  location: string;
  email: string;
  phone: string;
  photoPalette: ResumePhotoPalette;
}

export interface ResumeSeedDataProvider {
  createPersonSeed(
    index: number,
    language: ResumeDocumentLanguage,
    variationSeed: number
  ): ResumePersonSeed;
}

const LOCATION_CATALOG: Record<ResumeDocumentLanguage, readonly ResumeLocationSeed[]> = {
  'es-ES': [
    { city: 'Madrid', country: 'Spain', phonePrefix: '+34' },
    { city: 'Barcelona', country: 'Spain', phonePrefix: '+34' },
    { city: 'Valencia', country: 'Spain', phonePrefix: '+34' },
    { city: 'Sevilla', country: 'Spain', phonePrefix: '+34' },
    { city: 'Bilbao', country: 'Spain', phonePrefix: '+34' },
    { city: 'Malaga', country: 'Spain', phonePrefix: '+34' },
    { city: 'Granada', country: 'Spain', phonePrefix: '+34' },
    { city: 'A Coruna', country: 'Spain', phonePrefix: '+34' },
    { city: 'Zaragoza', country: 'Spain', phonePrefix: '+34' },
    { city: 'Las Palmas de Gran Canaria', country: 'Spain', phonePrefix: '+34' },
  ],
  en: [
    { city: 'London', country: 'United Kingdom', phonePrefix: '+44' },
    { city: 'Manchester', country: 'United Kingdom', phonePrefix: '+44' },
    { city: 'Leeds', country: 'United Kingdom', phonePrefix: '+44' },
    { city: 'Bristol', country: 'United Kingdom', phonePrefix: '+44' },
    { city: 'Dublin', country: 'Ireland', phonePrefix: '+353' },
    { city: 'Amsterdam', country: 'Netherlands', phonePrefix: '+31' },
    { city: 'Berlin', country: 'Germany', phonePrefix: '+49' },
    { city: 'Lisbon', country: 'Portugal', phonePrefix: '+351' },
    { city: 'Copenhagen', country: 'Denmark', phonePrefix: '+45' },
    { city: 'Stockholm', country: 'Sweden', phonePrefix: '+46' },
  ],
};

function createScopedFaker(language: ResumeDocumentLanguage, seed: number): Faker {
  const fakerInstance = new Faker({
    locale: language === 'es-ES' ? [es, en] : [en_GB, en],
  });
  fakerInstance.seed(seed);
  return fakerInstance;
}

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function createSpanishLastName(fakerInstance: Faker): string {
  const rawLastName = fakerInstance.person.lastName();
  return rawLastName.split(/[\s-]+/)[0] ?? rawLastName;
}

function createVariationSeed(
  index: number,
  language: ResumeDocumentLanguage,
  variationSeed: number
): number {
  const languageOffset = language === 'es-ES' ? 13_579 : 24_691;
  return variationSeed + index * 7_919 + languageOffset;
}

function createEmail(
  fakerInstance: Faker,
  firstName: string,
  lastNames: string[]
): string {
  const normalizedFirstName = normalizeToken(firstName);
  const normalizedLastNames = lastNames.map((lastName) => normalizeToken(lastName)).filter(Boolean);
  const emailFormats = [
    `${normalizedFirstName}.${normalizedLastNames[0] ?? 'candidate'}`,
    `${normalizedFirstName}${normalizedLastNames[0] ?? 'candidate'}`,
    `${normalizedFirstName[0] ?? 'x'}${normalizedLastNames[0] ?? 'candidate'}`,
    `${normalizedFirstName}.${normalizedLastNames.join('')}`,
  ].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);

  return `${fakerInstance.helpers.arrayElement(emailFormats)}@example.com`;
}

function createPhoneDigits(fakerInstance: Faker, length: number): string {
  return Array.from({ length }, () => fakerInstance.number.int({ min: 0, max: 9 }).toString()).join(
    ''
  );
}

function createPhone(fakerInstance: Faker, location: ResumeLocationSeed): string {
  if (location.phonePrefix === '+34') {
    return `${location.phonePrefix} 6${createPhoneDigits(fakerInstance, 2)} ${createPhoneDigits(fakerInstance, 3)} ${createPhoneDigits(fakerInstance, 3)}`;
  }

  if (location.phonePrefix === '+44') {
    return `${location.phonePrefix} 7${createPhoneDigits(fakerInstance, 3)} ${createPhoneDigits(fakerInstance, 6)}`;
  }

  if (location.phonePrefix === '+353') {
    return `${location.phonePrefix} 8${fakerInstance.number.int({ min: 3, max: 9 })} ${createPhoneDigits(fakerInstance, 3)} ${createPhoneDigits(fakerInstance, 4)}`;
  }

  return `${location.phonePrefix} ${createPhoneDigits(fakerInstance, 3)} ${createPhoneDigits(fakerInstance, 3)} ${createPhoneDigits(fakerInstance, 3)}`;
}

function createLocation(
  fakerInstance: Faker,
  language: ResumeDocumentLanguage
): ResumeLocationSeed {
  return fakerInstance.helpers.arrayElement(LOCATION_CATALOG[language]);
}

function createColorChannel(fakerInstance: Faker, min: number, max: number): number {
  return fakerInstance.number.int({ min, max });
}

function createGrammaticalGender(fakerInstance: Faker, index: number): ResumeGrammaticalGender {
  const sexType = fakerInstance.person.sexType();

  if (sexType === 'female') {
    return 'feminine';
  }

  if (sexType === 'male') {
    return 'masculine';
  }

  return index % 2 === 0 ? 'feminine' : 'masculine';
}

function createPhotoPalette(fakerInstance: Faker): ResumePhotoPalette {
  return {
    background: [
      createColorChannel(fakerInstance, 210, 245),
      createColorChannel(fakerInstance, 214, 242),
      createColorChannel(fakerInstance, 218, 246),
    ],
    accent: [
      createColorChannel(fakerInstance, 35, 185),
      createColorChannel(fakerInstance, 45, 145),
      createColorChannel(fakerInstance, 55, 180),
    ],
    skin: [
      createColorChannel(fakerInstance, 120, 235),
      createColorChannel(fakerInstance, 85, 205),
      createColorChannel(fakerInstance, 60, 175),
    ],
    hair: [
      createColorChannel(fakerInstance, 18, 105),
      createColorChannel(fakerInstance, 14, 78),
      createColorChannel(fakerInstance, 12, 62),
    ],
    jacket: [
      createColorChannel(fakerInstance, 28, 92),
      createColorChannel(fakerInstance, 32, 98),
      createColorChannel(fakerInstance, 38, 118),
    ],
    shirt: [
      createColorChannel(fakerInstance, 236, 250),
      createColorChannel(fakerInstance, 236, 250),
      createColorChannel(fakerInstance, 232, 248),
    ],
  };
}

export function createFakerResumeSeedDataProvider(): ResumeSeedDataProvider {
  return {
    createPersonSeed(index, language, variationSeed) {
      const seed = createVariationSeed(index, language, variationSeed);
      const fakerInstance = createScopedFaker(language, seed);
      const grammaticalGender = createGrammaticalGender(fakerInstance, index);
      const firstName = fakerInstance.person.firstName(
        grammaticalGender === 'feminine' ? 'female' : 'male'
      );
      const lastNames =
        language === 'es-ES'
          ? [createSpanishLastName(fakerInstance), createSpanishLastName(fakerInstance)]
          : [fakerInstance.person.lastName()];
      const fullName = `${firstName} ${lastNames.join(' ')}`;
      const location = createLocation(fakerInstance, language);

      return {
        seed,
        fullName,
        grammaticalGender,
        age: fakerInstance.number.int({ min: 24, max: 44 }),
        location: `${location.city}, ${location.country}`,
        email: createEmail(fakerInstance, firstName, lastNames),
        phone: createPhone(fakerInstance, location),
        photoPalette: createPhotoPalette(fakerInstance),
      };
    },
  };
}
