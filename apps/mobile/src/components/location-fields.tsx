import { useState } from 'react';
import { Text, View } from 'react-native';

import { cityNames, countryNames, stateNames } from '@/features/location/places';
import { currentPlace, LocationError } from '@/features/location/current-location';
import { t } from '@/i18n';

import { Input } from './input';
import { SelectField } from './select-field';
import { useTheme } from './use-theme';

// The place fields every profile needs: country, then state (when the country has them), then city.
export interface PlaceValue {
  country?: string;
  state?: string;
  city?: string;
}

// Turns a list of names into picker options.
const toOptions = (names: string[]) => names.map((n) => ({ value: n, label: n }));

// Country, state and city pickers with a "Use my location" link.
// - State only appears once a country with states is chosen.
// - City is a picker when we have a list for that state (India), otherwise a text box.
// - "My city is not listed" switches the picker to a text box, so anyone can type their city.
export function LocationFields({ value, onChange, errors }: { value: PlaceValue; onChange: (patch: PlaceValue) => void; errors: Record<string, string> }) {
  const { colors, space, type } = useTheme();
  const country = value.country ?? '';
  const state = value.state ?? '';
  const city = value.city ?? '';
  const states = stateNames(country);
  const cities = cityNames(country, state);
  const [typeCity, setTypeCity] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  // A city that is not in our list must be shown in the text box, not the picker.
  const citiesExist = cities.length > 0;
  const showCityPicker = citiesExist && !typeCity && (city === '' || cities.includes(city));
  // The city can only be chosen once the earlier steps are done.
  const cityReady = country !== '' && (states.length === 0 || state !== '');

  // A new country clears the state and city, because they belong to the old country.
  function pickCountry(next: string) {
    setTypeCity(false);
    onChange({ country: next, state: '', city: '' });
  }

  // A new state clears the city.
  function pickState(next: string) {
    setTypeCity(false);
    onChange({ state: next, city: '' });
  }

  // Look up the place and fill all three fields, or explain what went wrong.
  async function locate() {
    if (busy) return;
    setBusy(true);
    setNote('');
    try {
      const place = await currentPlace();
      setTypeCity(false);
      onChange(place);
      setNote(t('location.filled'));
    } catch (e) {
      // While developing, show the real reason in the console. Users only see the friendly message.
      if (__DEV__ && !(e instanceof LocationError)) console.warn('Location lookup failed:', e);
      setNote(t(e instanceof LocationError ? `location.${e.reason}` : 'location.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <SelectField
        label={t('location.country')}
        placeholder={t('common.select')}
        options={toOptions(countryNames())}
        value={country || undefined}
        onChange={pickCountry}
        searchable
        error={errors.country}
      />

      {states.length > 0 ? (
        <SelectField
          label={t('location.state')}
          placeholder={t('common.select')}
          options={toOptions(states)}
          value={state || undefined}
          onChange={pickState}
          searchable
          error={errors.state}
        />
      ) : null}

      {cityReady ? (
        showCityPicker ? (
          <SelectField
            label={t('location.city')}
            placeholder={t('common.select')}
            options={toOptions(cities)}
            value={city || undefined}
            onChange={(next) => onChange({ city: next })}
            searchable
            error={errors.city}
          />
        ) : (
          <Input label={t('location.city')} value={city} onChangeText={(next) => onChange({ city: next })} error={errors.city} />
        )
      ) : null}

      {/* Two small links share one row to save height: switch between picking and typing the city, and use the phone's location. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: space.lg }}>
        {cityReady && citiesExist ? (
          <Text accessibilityRole="button" onPress={() => setTypeCity(showCityPicker)} style={[type.caption, { color: colors.primary }]}>
            {showCityPicker ? t('location.notListed') : t('location.chooseFromList')}
          </Text>
        ) : <View />}
        <Text accessibilityRole="button" onPress={locate} style={[type.caption, { color: colors.primary }]}>
          {busy ? t('location.finding') : t('location.use')}
        </Text>
      </View>
      {note ? <Text style={[type.caption, { color: colors.muted, fontFamily: 'DMSans_500Medium' }]}>{note}</Text> : null}
    </View>
  );
}
