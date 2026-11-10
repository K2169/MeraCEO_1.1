// Builds the small place lists the app ships with, from the country-state-city package.
// Run it with: pnpm --filter @meraceo/mobile build:places   (only needed when the data should be refreshed)
//
// Output (all in src/data/):
//   countries.json    [{ code, name }]                every country
//   states.json       { countryCode: [{ code, name }] }  states or regions, for countries that have them
//   india-cities.json { stateCode: [name, ...] }      cities for India only (keeps the app small)
import { City, Country, State } from 'country-state-city';
import { writeFileSync } from 'node:fs';

const out = (name, data) => writeFileSync(new URL(`../src/data/${name}`, import.meta.url), JSON.stringify(data));
const byName = (a, b) => a.name.localeCompare(b.name);

const countries = Country.getAllCountries().map((c) => ({ code: c.isoCode, name: c.name })).sort(byName);
out('countries.json', countries);

const states = {};
for (const c of countries) {
  const list = State.getStatesOfCountry(c.code).map((s) => ({ code: s.isoCode, name: s.name })).sort(byName);
  if (list.length > 0) states[c.code] = list;
}
out('states.json', states);

const india = {};
for (const s of states.IN ?? []) {
  const names = [...new Set(City.getCitiesOfState('IN', s.code).map((c) => c.name))].sort((a, b) => a.localeCompare(b));
  if (names.length > 0) india[s.code] = names;
}
out('india-cities.json', india);

console.log(`countries: ${countries.length}, countries with states: ${Object.keys(states).length}, Indian states with cities: ${Object.keys(india).length}`);
