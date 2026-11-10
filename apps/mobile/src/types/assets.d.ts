// Image imports resolve to a bundler asset reference, typed as a require number.
declare module '*.png' {
  const source: number;
  export default source;
}
