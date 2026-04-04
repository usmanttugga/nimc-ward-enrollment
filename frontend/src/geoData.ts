// Nigeria geo data loaded dynamically from public dataset
// Source: https://github.com/temikeezy/nigeria-geojson-data (MIT License)

export interface Ward { id: string; name: string; }
export interface Lga { id: string; name: string; wards: Ward[]; }
export interface State { id: string; name: string; lgas: Lga[]; }

const DATA_URL = 'https://raw.githubusercontent.com/temikeezy/nigeria-geojson-data/main/data/lgas-with-wards.json';

let cachedData: State[] | null = null;

export async function loadGeoData(): Promise<State[]> {
  if (cachedData) return cachedData;

  const res = await fetch(DATA_URL);
  const raw: Record<string, Record<string, { name: string }[]>> = await res.json();

  const states: State[] = Object.entries(raw).map(([stateName, lgas]) => {
    const stateId = stateName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return {
      id: stateId,
      name: stateName,
      lgas: Object.entries(lgas).map(([lgaName, wards]) => {
        const lgaId = `${stateId}-${lgaName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        return {
          id: lgaId,
          name: lgaName,
          wards: wards.map((w, i) => ({
            id: `${lgaId}-w${i}`,
            name: w.name,
          })),
        };
      }),
    };
  });

  // Sort states alphabetically
  states.sort((a, b) => a.name.localeCompare(b.name));

  cachedData = states;
  return states;
}
