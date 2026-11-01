/*
  Unit tests for the three functions that tidy what people type
                                                         Owner: Clarence Tay

      lib/profile.js         tidyInterest()   - an interest on the profile page
      lib/skillSwapFormat.js tidyCategory()   - a kind of skill swap session
      lib/onemap.js          expandAddress()  - an address typed into the map

  They are tested together because they answer one question between them: when
  someone types instead of pressing a button, does the app still understand
  them? Getting this wrong does not crash anything, which is exactly why it
  needs tests - two neighbours who like the same thing quietly stop matching.

  Run with:  pnpm test:unit
*/
import { describe, it, expect } from 'vitest'
import { tidyInterest, avatarSrc, MAX_INTEREST_LENGTH } from './profile.js'
import { tidyCategory, sessionEnd, formatDuration } from './skillSwapFormat.js'
import { expandAddress } from './onemap.js'

describe('tidyInterest', () => {
  it('folds a typed interest into the matching tile', () => {
    expect(tidyInterest('gardening')).toBe('Gardening')
    expect(tidyInterest('GARDENING')).toBe('Gardening')
    expect(tidyInterest('kopi AND chats')).toBe('Kopi and chats')
  })

  it('keeps an interest the list has never heard of, tidied up', () => {
    expect(tidyInterest('mahjong')).toBe('Mahjong')
    expect(tidyInterest('mahjong  club ')).toBe('Mahjong club')
  })

  it('treats nothing, and spaces only, as nothing typed', () => {
    expect(tidyInterest('')).toBe('')
    expect(tidyInterest('    ')).toBe('')
  })

  it('does not fall over on a missing value', () => {
    expect(tidyInterest(null)).toBe('')
    expect(tidyInterest(undefined)).toBe('')
  })

  it('has a length limit the profile form can check against', () => {
    expect(MAX_INTEREST_LENGTH).toBe(30)
  })
})

describe('tidyCategory', () => {
  it('folds a typed kind into one of the seven suggestions', () => {
    expect(tidyCategory('cooking')).toBe('Cooking')
    expect(tidyCategory('health & FITNESS')).toBe('Health & fitness')
    expect(tidyCategory('ARTS & MUSIC')).toBe('Arts & music')
  })

  it('matches the exact spelling the database accepts', () => {
    // The form used to offer 'Health & Fitness' while the database only took
    // 'Health & fitness', so three of the seven tiles failed on save
    expect(tidyCategory('Health & Fitness')).toBe('Health & fitness')
  })

  it('keeps a kind of its own', () => {
    expect(tidyCategory('mahjong')).toBe('Mahjong')
  })

  it('treats nothing as nothing typed', () => {
    expect(tidyCategory('')).toBe('')
    expect(tidyCategory('   ')).toBe('')
  })
})

describe('expandAddress', () => {
  it('writes an HDB address the way OneMap stores it', () => {
    // People type "Blk 412 Eunos Cres"; OneMap indexes "412 EUNOS CRESCENT"
    expect(expandAddress('Blk 412 Eunos Cres')).toBe('412 eunos crescent')
    expect(expandAddress('Block 123 Bishan St 13')).toBe('123 bishan street 13')
  })

  it('spells out the street types Singaporeans shorten', () => {
    expect(expandAddress('Jln Eunos')).toBe('jalan eunos')
    expect(expandAddress('Lor 1 Toa Payoh')).toBe('lorong 1 toa payoh')
    expect(expandAddress('Upp Serangoon Rd')).toBe('upper serangoon road')
    expect(expandAddress('Eunos CC')).toBe('eunos community club')
  })

  it('leaves Saint alone, because St is only Street in the middle', () => {
    // "Bishan St 13" is a street; "St Andrew's Road" is a saint. Expanding
    // both would break a search that works today.
    expect(expandAddress("St Andrew's Road")).toBe("st andrew's road")
    expect(expandAddress('Bishan St 13')).toBe('bishan street 13')
  })

  it('leaves a full address unchanged apart from its capitals', () => {
    expect(expandAddress('Bishan Community Club')).toBe('bishan community club')
  })

  it('returns nothing for nothing', () => {
    expect(expandAddress('')).toBe('')
    expect(expandAddress(null)).toBe('')
  })
})

describe('avatarSrc', () => {
  it('builds the path for a person who has chosen a look', () => {
    expect(avatarSrc('adult', 'male', 'darkest')).toBe('/images/adult-male-darkest.svg')
    expect(avatarSrc('senior', 'female', 'dark-brown')).toBe('/images/senior-female-dark-brown.svg')
  })

  it('gives nothing until BOTH choices have been made', () => {
    // Half a choice must not produce a path, or the page shows a broken image
    expect(avatarSrc('adult', null, null)).toBe('')
    expect(avatarSrc('adult', 'male', null)).toBe('')
    expect(avatarSrc('adult', null, 'light')).toBe('')
  })

  it('gives nothing for a value that is not one of ours', () => {
    expect(avatarSrc('adult', 'male', 'purple')).toBe('')
    expect(avatarSrc('elder', 'male', 'light')).toBe('')
  })
})

describe('sessionEnd', () => {
  it('is the start plus however long it lasts', () => {
    expect(sessionEnd('2026-10-29', '15:00', 90).getHours()).toBe(16)
    expect(sessionEnd('2026-10-29', '15:00', 90).getMinutes()).toBe(30)
  })

  it('always finishes after it starts', () => {
    const start = new Date(2026, 9, 29, 15, 0)
    expect(sessionEnd('2026-10-29', '15:00', 30) > start).toBe(true)
  })

  it('rolls over into the next day when it has to', () => {
    const end = sessionEnd('2026-10-29', '23:30', 120)
    expect(end.getDate()).toBe(30)
    expect(end.getHours()).toBe(1)
  })
})

describe('formatDuration', () => {
  it('says minutes under an hour', () => {
    expect(formatDuration(30)).toBe('30 minutes')
  })

  it('says one hour without an s', () => {
    expect(formatDuration(60)).toBe('1 hour')
  })

  it('says hours and minutes together', () => {
    expect(formatDuration(90)).toBe('1 hour 30 minutes')
    expect(formatDuration(150)).toBe('2 hours 30 minutes')
  })

  it('says whole hours on their own', () => {
    expect(formatDuration(180)).toBe('3 hours')
  })
})
