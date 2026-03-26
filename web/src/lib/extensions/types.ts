/**
 * Display types for rendering extension results in the UI.
 *
 * These are purely for the frontend to know how to render
 * responses from the backend command pipeline.
 */

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
