/**
 * Company Resolver
 *
 * Input:  raw company name string
 * Output: structured metadata — aliases, languages, country, domain hints
 *
 * Phase 1 (now):  rule-based suffix / region detection
 * Phase 2 (later): AI-enriched disambiguation via OpenAI
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ResolvedCompany {
  name: string
  normalizedName: string
  aliases: string[]
  languages: string[]
  country?: string
  domain?: string
  industry?: string
}

// ─── Reference data ──────────────────────────────────────────────────────────

const SUFFIXES = [
  'Inc', 'Inc.', 'Incorporated',
  'LLC', 'L.L.C.',
  'Ltd', 'Ltd.', 'Limited',
  'Corp', 'Corp.', 'Corporation',
  'GmbH', 'AG', 'SE', 'e.V.',
  'SA', 'SAS', 'SARL', 'SRL',
  'doo', 'd.o.o.', 'DOO', 'D.O.O.',
  'AB', 'Oy', 'Oyj', 'AS', 'ApS', 'A/S',
  'BV', 'B.V.', 'NV', 'N.V.',
  'Pty', 'Pty Ltd', 'Pvt', 'Pvt Ltd', 'PLC',
  'Co', 'Co.', 'Company',
  'Group', 'Holdings', 'International', 'Intl',
  'KK', 'YK',  // Japan
  'Sp. z o.o.', // Poland
]

/** Suffix → region/language mapping */
const REGION_MAP: Record<string, { country: string; languages: string[] }> = {
  'doo':      { country: 'Serbia',      languages: ['sr', 'en'] },
  'd.o.o.':   { country: 'Serbia',      languages: ['sr', 'en'] },
  'gmbh':     { country: 'Germany',     languages: ['de', 'en'] },
  'ag':       { country: 'Germany',     languages: ['de', 'en'] },
  'se':       { country: 'Europe',      languages: ['en', 'de'] },
  'e.v.':     { country: 'Germany',     languages: ['de', 'en'] },
  'ab':       { country: 'Sweden',      languages: ['sv', 'en'] },
  'oy':       { country: 'Finland',     languages: ['fi', 'en'] },
  'oyj':      { country: 'Finland',     languages: ['fi', 'en'] },
  'as':       { country: 'Norway',      languages: ['no', 'en'] },
  'aps':      { country: 'Denmark',     languages: ['da', 'en'] },
  'a/s':      { country: 'Denmark',     languages: ['da', 'en'] },
  'bv':       { country: 'Netherlands', languages: ['nl', 'en'] },
  'b.v.':     { country: 'Netherlands', languages: ['nl', 'en'] },
  'nv':       { country: 'Netherlands', languages: ['nl', 'en'] },
  'n.v.':     { country: 'Netherlands', languages: ['nl', 'en'] },
  'sa':       { country: 'France',      languages: ['fr', 'en'] },
  'sas':      { country: 'France',      languages: ['fr', 'en'] },
  'sarl':     { country: 'France',      languages: ['fr', 'en'] },
  'srl':      { country: 'Italy',       languages: ['it', 'en'] },
  'kk':       { country: 'Japan',       languages: ['ja', 'en'] },
  'sp. z o.o.': { country: 'Poland',    languages: ['pl', 'en'] },
}

// ─── Main resolver ───────────────────────────────────────────────────────────

export function resolveCompany(input: string): ResolvedCompany {
  const name = input.trim()
  const lower = name.toLowerCase()

  let normalizedName = name
  let country: string | undefined
  let languages: string[] = ['en']

  // Try to match a known corporate suffix
  for (const suffix of SUFFIXES) {
    const pat = ` ${suffix.toLowerCase()}`
    if (lower.endsWith(pat)) {
      normalizedName = name.slice(0, -(suffix.length + 1)).trim()
      const hint = REGION_MAP[suffix.toLowerCase()]
      if (hint) {
        country = hint.country
        languages = hint.languages
      }
      break
    }
  }

  // Build alias set
  const aliases = new Set<string>([name])
  if (normalizedName !== name) aliases.add(normalizedName)

  // Regional alias variants
  if (country === 'Serbia') {
    aliases.add(`${normalizedName} doo`)
    aliases.add(`${normalizedName} d.o.o.`)
    aliases.add(`${normalizedName} Srbija`)
    aliases.add(`${normalizedName} Serbia`)
  } else if (country === 'Germany') {
    aliases.add(`${normalizedName} GmbH`)
    aliases.add(`${normalizedName} Deutschland`)
  }

  // Always include the bare lowercase form
  aliases.add(normalizedName.toLowerCase())

  return {
    name,
    normalizedName,
    aliases: [...aliases].filter(a => a.length > 0),
    languages: [...new Set(languages)],
    country,
  }
}
