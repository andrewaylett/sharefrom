export {};

declare global {
  interface Window {
    receivedFiles?: Map<string, File>;
    downloadFile?: (name: string) => void;
  }
  // In module scope, globalThis will have these as well
  // This helps avoid any-casts in main.ts

  var receivedFiles: Map<string, File> | undefined;
  var downloadFile: ((name: string) => void) | undefined;
}
