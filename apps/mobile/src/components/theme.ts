// Design tokens: every colour, size and text style lives here. Screens must not hard-code them.

export interface ThemeColors {
  background: string; // page background
  surface: string; // cards and inputs
  text: string; // main text
  muted: string; // helper text
  border: string; // thin outlines
  primary: string; // main buttons and links (logo blue)
  solidGreen: string; // solid green card (professional role)
  solidText: string; // white-ish text on solid cards
  primaryText: string; // text on a primary button
  accent: string; // success and highlights (logo green)
  accentText: string; // green text that is readable on the background
  secondary: string; // deep teal (logo)
  danger: string; // errors and destructive buttons
  dangerSoft: string; // soft red tile behind a destructive row's icon
  warning: string; // warnings
  chip: string; // unselected chips
  blueSoft: string; // soft blue card background
  greenSoft: string; // soft green card background
  shadow: string; // shadow colour
  disabledFace: string; // face of a button that cannot be pressed yet
  disabledText: string; // label on a disabled button
}

// Light palette, taken from the MeraCEO logo.
const light: ThemeColors = {
  background: '#F3F7FF',
  surface: '#FFFFFF',
  text: '#14213D',
  muted: '#5C6B82',
  border: '#DCE5F2',
  primary: '#0866FF',
  solidGreen: '#00786A',
  solidText: '#FFFFFF',
  primaryText: '#FFFFFF',
  accent: '#00A786',
  accentText: '#00786A',
  secondary: '#006F94',
  danger: '#D62839',
  dangerSoft: '#FDECEE',
  warning: '#B54708',
  chip: '#E6EFFF',
  blueSoft: '#E3EEFF',
  greenSoft: '#DDF6EE',
  shadow: '#0B1F4D',
  disabledFace: '#B9BEC7',
  disabledText: '#6E7480',
};

// Dark palette: soft slate, never pure black.
const dark: ThemeColors = {
  background: '#1B2330',
  surface: '#243044',
  text: '#E6EDF5',
  muted: '#A7B4C4',
  border: '#3A4A5E',
  primary: '#6FA3FF',
  solidGreen: '#1F7A62',
  solidText: '#FFFFFF',
  primaryText: '#0F1A2B',
  accent: '#4FD1A0',
  accentText: '#4FD1A0',
  secondary: '#5FB8D6',
  danger: '#FF8A80',
  dangerSoft: '#3A2630',
  warning: '#FFC46B',
  chip: '#2F3D52',
  blueSoft: '#263A5C',
  greenSoft: '#1F4A40',
  shadow: '#000000',
  disabledFace: '#434B58',
  disabledText: '#8E96A3',
};

export const palette: Record<'light' | 'dark', ThemeColors> = { light, dark };

// Spacing scale for padding and gaps.
// DM Sans faces, loaded once in app/_layout.tsx. Use these names instead of fontWeight.
export const fontFamily = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
  extrabold: 'DMSans_800ExtraBold',
} as const;

export const space = { xs: 4, sm: 8, md: 14, lg: 20, xl: 28, xxl: 40 } as const;

// Corner radius scale: modest corners for a calm, professional look. Pill is for chips and tags.
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

// Text styles: display for hero text, title for screen headings, heading for cards, body for reading, caption for helper text.
export const type = {
  display: { fontSize: 30, fontFamily: fontFamily.extrabold, lineHeight: 36 },
  title: { fontSize: 22, fontFamily: fontFamily.bold, lineHeight: 28 },
  heading: { fontSize: 17, fontFamily: fontFamily.bold, lineHeight: 24 },
  body: { fontSize: 15, fontFamily: fontFamily.regular, lineHeight: 22 },
  caption: { fontSize: 13, fontFamily: fontFamily.semibold, lineHeight: 18 },
} as const;

// Soft drop shadow used on cards and main buttons.
export const shadow = {
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.12,
  shadowRadius: 14,
  elevation: 4,
} as const;
