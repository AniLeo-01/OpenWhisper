"use client";

import { ExternalLink, Globe, Sparkles } from "lucide-react";
import type { SearchResults as SearchResultsType } from "@/lib/extensions/types";

interface SearchResultsProps {
  results: SearchResultsType;
}

export function SearchResults({ results }: SearchResultsProps) {
  return (
    <div className="w-full space-y-4">
      {/* Query header */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Globe className="w-4 h-4" />
        <span>Search results for &ldquo;{results.query}&rdquo;</span>
        <span className="text-gray-700">
          ({results.responseTime.toFixed(1)}s)
        </span>
      </div>

      {/* AI Answer */}
      {results.answer && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-purple-400 mb-2">
            <Sparkles className="w-3 h-3" />
            <span>AI Answer</span>
          </div>
          <p className="text-gray-200 text-sm leading-relaxed">
            {results.answer}
          </p>
        </div>
      )}

      {/* Result list */}
      <div className="space-y-3">
        {results.results.map((result, i) => (
          <div
            key={i}
            className="border border-gray-800/50 rounded-lg px-4 py-3 hover:border-gray-700 transition-colors"
          >
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
            >
              {result.title}
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
            <p className="text-xs text-gray-600 mt-0.5 truncate">
              {result.url}
            </p>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed line-clamp-3">
              {result.content}
            </p>
            <div className="mt-2">
              <span className="text-xs text-gray-600">
                Relevance: {(result.score * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {results.results.length === 0 && (
        <p className="text-gray-500 text-sm">No results found.</p>
      )}
    </div>
  );
}
