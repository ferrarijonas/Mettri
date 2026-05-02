/** Ficheiros `.md` importados como texto (loader esbuild `text` ou plugin). */
declare module '*.md' {
  const content: string;
  export default content;
}
