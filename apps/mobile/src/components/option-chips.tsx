import { View } from 'react-native';

import { Chip } from './chip';

export interface Option<T extends string> {
  value: T;
  label: string;
}

// Single or multi select. `selected` holds values; the parent stores them.
export function OptionChips<T extends string>({
  options,
  selected,
  multi = false,
  onChange,
}: {
  options: Option<T>[];
  selected: T[];
  multi?: boolean;
  onChange: (next: T[]) => void;
}) {
  function toggle(value: T) {
    if (!multi) return onChange([value]);
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={selected.includes(o.value)} onPress={() => toggle(o.value)} />
      ))}
    </View>
  );
}
