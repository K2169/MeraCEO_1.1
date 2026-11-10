import { Image } from 'react-native';

import logo from '../../assets/images/icon.png';

// The approved MeraCEO mark (old POC assets/icon.png, confirmed by Salman).
export function Logo({ size = 96 }: { size?: number }) {
  return <Image source={logo} accessibilityLabel="MeraCEO" style={{ width: size, height: size, borderRadius: size * 0.22 }} />;
}
