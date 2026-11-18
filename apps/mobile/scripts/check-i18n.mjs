import { readFile } from 'node:fs/promises';

// Every UI key must exist in both shipped dictionaries; wording review is separate.
const root = new URL('../src/i18n/', import.meta.url);
const dictionaries = await Promise.all(['en', 'hi'].map(async (locale) => {
  const dictionary = JSON.parse(await readFile(new URL(`${locale}.json`, root), 'utf8'));
  for (const [key, value] of Object.entries(dictionary)) {
    if (typeof value !== 'string') throw new Error(`${locale}: ${key} must be a string`);
  }
  return dictionary;
}));
const [english, hindi] = dictionaries;
const missingHindi = Object.keys(english).filter((key) => !(key in hindi));
const missingEnglish = Object.keys(hindi).filter((key) => !(key in english));
if (missingHindi.length || missingEnglish.length) {
  console.error('Translation key mismatch:', { missingHindi, missingEnglish });
  process.exitCode = 1;
} else {
  console.log(`Translation keys match (${Object.keys(english).length} keys per locale).`);
}
