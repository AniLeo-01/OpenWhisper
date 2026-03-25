import type { Settings } from "../store";

export interface SearchResultItem {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface SearchResults {
  query: string;
  answer: string | null;
  results: SearchResultItem[];
  responseTime: number;
}

export interface ExtensionResult {
  type: "text" | "search";
  /** Transformed text (for text extensions) */
  text?: string;
  /** Search results (for search extensions) */
  searchResults?: SearchResults;
}

export interface ExtensionContext {
  selectedText?: string;
  settings: Settings;
}

export interface Extension {
  name: string;
  description: string;
  /** Words that trigger this extension (matched against start of command) */
  keywords: string[];
  /** Execute the extension with the spoken command */
  execute: (
    command: string,
    context: ExtensionContext
  ) => Promise<ExtensionResult>;
}
