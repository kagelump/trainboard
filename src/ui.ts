// Compatibility shim: re-export the UI implementation now located under src/ui
// Use an explicit path to avoid resolving this file itself when importing './ui'
export * from './ui/index';
