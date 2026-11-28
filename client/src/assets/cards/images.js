import viBoom from './vi/boom.png';
import viDefuse from './vi/defuse.png';
import viAttack from './vi/attack.png';
import viSkip from './vi/skip.png';
import viReverse from './vi/reverse.png';
import viShuffle from './vi/shuffle.png';
import viFavor from './vi/favor.png';
import viPeek from './vi/peek.png';
import viNope from './vi/nope.png';
import viCat from './vi/cat.png';
import viTaco from './vi/taco.png';
import viPotato from './vi/potato.png';

import enBoom from './en/boom.png';
import enDefuse from './en/defuse.png';
import enAttack from './en/attack.png';
import enSkip from './en/skip.png';
import enReverse from './en/reverse.png';
import enShuffle from './en/shuffle.png';
import enFavor from './en/favor.png';
import enNope from './en/nope.png';
import enCat from './en/cat.png';
import enTaco from './en/taco.png';
import enPotato from './en/potato.png';

import peekIllustration from './peek-illustration.png';

export const PEEK_ILLUSTRATION = peekIllustration;

export const CARD_IMAGES = Object.freeze({
  vi: Object.freeze({
    boom: viBoom,
    defuse: viDefuse,
    attack: viAttack,
    skip: viSkip,
    reverse: viReverse,
    shuffle: viShuffle,
    favor: viFavor,
    peek: viPeek,
    nope: viNope,
    cat: viCat,
    taco: viTaco,
    potato: viPotato,
  }),
  en: Object.freeze({
    boom: enBoom,
    defuse: enDefuse,
    attack: enAttack,
    skip: enSkip,
    reverse: enReverse,
    shuffle: enShuffle,
    favor: enFavor,
    nope: enNope,
    cat: enCat,
    taco: enTaco,
    potato: enPotato,
  }),
});

/**
 * Look up the static card PNG for a given card type and locale.
 * Unknown locales fall back to 'vi'; missing card entries in a known locale
 * (such as ('peek', 'en')) return null so Card can render its structured fallback.
 *
 * @param {string} type
 * @param {string} [locale='vi']
 * @returns {string|null}
 */
export function getCardImage(type, locale = 'vi') {
  if (!type) return null;
  const localeMap = Object.prototype.hasOwnProperty.call(CARD_IMAGES, locale)
    ? CARD_IMAGES[locale]
    : CARD_IMAGES.vi;
  return Object.prototype.hasOwnProperty.call(localeMap, type)
    ? localeMap[type]
    : null;
}
