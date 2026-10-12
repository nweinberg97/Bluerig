// Canadian place names the parser and importer recognise. Not exhaustive: owners can
// type any town; this list only helps us spot towns inside free text.

export const PROVINCES: Record<string, string> = {
  BC: 'British Columbia', AB: 'Alberta', SK: 'Saskatchewan', MB: 'Manitoba', ON: 'Ontario', QC: 'Quebec',
  NB: 'New Brunswick', NS: 'Nova Scotia', PE: 'Prince Edward Island', NL: 'Newfoundland and Labrador',
  YT: 'Yukon', NT: 'Northwest Territories', NU: 'Nunavut',
};

/** IANA timezone by province (the most common one; owners can change it). */
export const PROVINCE_TZ: Record<string, string> = {
  BC: 'America/Vancouver', AB: 'America/Edmonton', SK: 'America/Regina', MB: 'America/Winnipeg',
  ON: 'America/Toronto', QC: 'America/Toronto', NB: 'America/Halifax', NS: 'America/Halifax',
  PE: 'America/Halifax', NL: 'America/St_Johns', YT: 'America/Whitehorse', NT: 'America/Yellowknife', NU: 'America/Iqaluit',
};

export const TOWNS: Record<string, string[]> = {
  BC: [
    'Vancouver', 'North Vancouver', 'West Vancouver', 'Burnaby', 'Richmond', 'Surrey', 'Delta', 'Tsawwassen', 'Ladner',
    'White Rock', 'Langley', 'Coquitlam', 'Port Coquitlam', 'Port Moody', 'New Westminster', 'Maple Ridge', 'Pitt Meadows',
    'Anmore', 'Belcarra', 'Abbotsford', 'Mission', 'Chilliwack', 'Squamish', 'Whistler', 'Victoria', 'Saanich', 'Langford',
    'Colwood', 'Sooke', 'Sidney', 'Nanaimo', 'Parksville', 'Qualicum Beach', 'Courtenay', 'Comox', 'Campbell River',
    'Duncan', 'Kelowna', 'West Kelowna', 'Vernon', 'Penticton', 'Kamloops', 'Salmon Arm', 'Prince George', 'Cranbrook',
    'Nelson', 'Trail', 'Fort St. John', 'Terrace', 'Prince Rupert', 'Williams Lake',
  ],
  AB: ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'Medicine Hat', 'Airdrie', 'Cochrane', 'Okotoks', 'St. Albert', 'Sherwood Park', 'Spruce Grove', 'Leduc', 'Fort Saskatchewan', 'Grande Prairie', 'Fort McMurray', 'Canmore', 'Chestermere'],
  SK: ['Saskatoon', 'Regina', 'Prince Albert', 'Moose Jaw', 'Swift Current', 'Yorkton', 'Warman', 'Martensville'],
  MB: ['Winnipeg', 'Brandon', 'Steinbach', 'Selkirk', 'Portage la Prairie', 'Winkler', 'Morden'],
  ON: [
    'Toronto', 'Mississauga', 'Brampton', 'Vaughan', 'Markham', 'Richmond Hill', 'Oakville', 'Burlington', 'Hamilton',
    'Milton', 'Ajax', 'Pickering', 'Whitby', 'Oshawa', 'Newmarket', 'Aurora', 'Barrie', 'Ottawa', 'Kanata', 'Orleans',
    'Kingston', 'London', 'Kitchener', 'Waterloo', 'Cambridge', 'Guelph', 'Windsor', 'St. Catharines', 'Niagara Falls',
    'Sudbury', 'Thunder Bay', 'Peterborough', 'Belleville', 'Sarnia', 'Brantford', 'Etobicoke', 'Scarborough', 'North York',
  ],
  QC: ['Montreal', 'Laval', 'Longueuil', 'Gatineau', 'Quebec City', 'Sherbrooke', 'Trois-Rivières', 'Terrebonne', 'Brossard', 'Saint-Jérôme', 'Lévis'],
  NB: ['Moncton', 'Saint John', 'Fredericton', 'Dieppe', 'Riverview'],
  NS: ['Halifax', 'Dartmouth', 'Bedford', 'Sydney', 'Truro', 'Lunenburg'],
  PE: ['Charlottetown', 'Summerside', 'Stratford'],
  NL: ["St. John's", 'Mount Pearl', 'Paradise', 'Corner Brook', 'Gander'],
  YT: ['Whitehorse'],
  NT: ['Yellowknife'],
  NU: ['Iqaluit'],
};

export const ALL_TOWNS: { name: string; province: string }[] = Object.entries(TOWNS).flatMap(([province, list]) =>
  list.map((name) => ({ name, province })),
);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Towns mentioned in free text, longest names first so "North Vancouver" wins over
 * "Vancouver". Returns names in order of first appearance.
 */
export function findTowns(text: string, province?: string): string[] {
  const pool = province && TOWNS[province] ? [...TOWNS[province], ...ALL_TOWNS.map((t) => t.name)] : ALL_TOWNS.map((t) => t.name);
  const names = [...new Set(pool)].sort((a, b) => b.length - a.length);
  let rest = text;
  const hits: { name: string; at: number }[] = [];
  for (const n of names) {
    const re = new RegExp(`(^|[^\\p{L}])${esc(n)}(?![\\p{L}])`, 'iu');
    const m = rest.match(re);
    if (m && m.index !== undefined) {
      const at = m.index + m[1].length;
      hits.push({ name: n, at });
      // blank it out so shorter names inside it don't match again
      rest = rest.slice(0, at) + ' '.repeat(n.length) + rest.slice(at + n.length);
    }
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.name);
}

export function provinceOf(town: string): string | undefined {
  return ALL_TOWNS.find((t) => t.name.toLowerCase() === town.toLowerCase())?.province;
}
