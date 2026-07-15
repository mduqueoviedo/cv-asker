import { Faker, en, en_GB, es } from '@faker-js/faker';
import type { ResumeDocumentLanguage, ResumePhotoPalette } from '../../types/resume.js';

export interface ResumePersonSeed {
  fullName: string;
  age: number;
  location: string;
  email: string;
  phone: string;
  photoPalette: ResumePhotoPalette;
}

export interface ResumeSeedDataProvider {
  createPersonSeed(index: number, language: ResumeDocumentLanguage): ResumePersonSeed;
}

function createScopedFaker(language: ResumeDocumentLanguage, seed: number): Faker {
  const fakerInstance = new Faker({
    locale: language === 'es-ES' ? [es, en] : [en_GB, en],
  });
  fakerInstance.seed(seed);
  return fakerInstance;
}

function createEmail(fakerInstance: Faker, firstName: string, lastName: string): string {
  return fakerInstance.internet.exampleEmail({
    firstName,
    lastName,
    allowSpecialCharacters: false,
  });
}

function createPhone(fakerInstance: Faker): string {
  return fakerInstance.phone.number({ style: 'international' });
}

function createLocation(fakerInstance: Faker): string {
  return `${fakerInstance.location.city()}, ${fakerInstance.location.country()}`;
}

function createColorChannel(fakerInstance: Faker, min: number, max: number): number {
  return fakerInstance.number.int({ min, max });
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
    createPersonSeed(index, language) {
      const fakerInstance = createScopedFaker(language, index + 1);
      const firstName = fakerInstance.person.firstName();
      const lastName = fakerInstance.person.lastName();
      const fullName = `${firstName} ${lastName}`;

      return {
        fullName,
        age: fakerInstance.number.int({ min: 24, max: 41 }),
        location: createLocation(fakerInstance),
        email: createEmail(fakerInstance, firstName, lastName),
        phone: createPhone(fakerInstance),
        photoPalette: createPhotoPalette(fakerInstance),
      };
    },
  };
}
