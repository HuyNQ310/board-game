import vi from './vi.js';
import en from './en.js';

export const LOCALES = ['vi', 'en'];
export const DEFAULT_LOCALE = 'vi';

const DICTIONARIES = {
  vi,
  en,
};

export function getStrings(locale) {
  if (locale && Object.prototype.hasOwnProperty.call(DICTIONARIES, locale)) {
    return DICTIONARIES[locale];
  }
  return DICTIONARIES[DEFAULT_LOCALE];
}

function getPaths(obj, prefix = '') {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return prefix ? [prefix] : [];
  }
  const paths = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...getPaths(value, fullPath));
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

export function missingKeys(localeA, localeB) {
  const dictA = typeof localeA === 'string' ? getStrings(localeA) : localeA;
  const dictB = typeof localeB === 'string' ? getStrings(localeB) : localeB;
  const pathsA = getPaths(dictA);
  const pathsB = new Set(getPaths(dictB));
  return pathsA.filter((path) => !pathsB.has(path)).sort();
}

export default getStrings;
