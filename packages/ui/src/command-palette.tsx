// ---------------------------------------------------------------------------
// CommandPalette — touch-optimized command palette for mobile terminal (Phase 15)
// ---------------------------------------------------------------------------

import React, { useState, useCallback } from "react";

export interface CommandAction {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly command?: string;
  readonly category: "git" | "test" | "deploy" | "ai" | "general";
}

export interface CommandPaletteProps {
  /** Available command actions */
  readonly actions?: readonly CommandAction[];
  /** Called when a command action is selected */
  readonly onAction: (action: CommandAction) => void;
  /** Called when a free-text AI prompt is submitted */
  readonly onAiPrompt?: (prompt: string) => void;
  /** Additional CSS class names */
  readonly className?: string;
}

const DEFAULT_ACTIONS: readonly CommandAction[] = [
  { id: "git-status", label: "Git Status", command: "git status", category: "git" },
  { id: "git-pull", label: "Git Pull", command: "git pull", category: "git" },
  { id: "git-diff", label: "Git Diff", command: "git diff --stat", category: "git" },
  { id: "test-run", label: "Run Tests", command: "pnpm test", category: "test" },
  { id: "test-watch", label: "Watch Tests", command: "pnpm test -- --watch", category: "test" },
  { id: "lint", label: "Lint", command: "pnpm lint", category: "test" },
  { id: "typecheck", label: "Type Check", command: "pnpm typecheck", category: "test" },
  { id: "build", label: "Build", command: "pnpm build", category: "deploy" },
  { id: "ai-fix", label: "Ask AI to Fix", category: "ai" },
  { id: "ai-explain", label: "Explain Error", category: "ai" },
  { id: "ai-review", label: "Code Review", category: "ai" },
];

const CATEGORY_COLORS: Record<string, string> = {
  git: "bg-orange-600 hover:bg-orange-500",
  test: "bg-green-700 hover:bg-green-600",
  deploy: "bg-blue-700 hover:bg-blue-600",
  ai: "bg-purple-700 hover:bg-purple-600",
  general: "bg-gray-700 hover:bg-gray-600",
};

/**
 * Touch-optimized command palette for mobile terminal use.
 * Provides quick-access buttons for common developer actions
 * and a text input for free-form AI prompts.
 */
export function CommandPalette({
  actions = DEFAULT_ACTIONS,
  onAction,
  onAiPrompt,
  className,
}: CommandPaletteProps) {
  const [aiInput, setAiInput] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = Array.from(new Set(actions.map((a) => a.category)));

  const filteredActions = activeCategory
    ? actions.filter((a) => a.category === activeCategory)
    : actions;

  const handleAiSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (aiInput.trim().length > 0) {
        onAiPrompt?.(aiInput.trim());
        setAiInput("");
      }
    },
    [aiInput, onAiPrompt],
  );

  return (
    <div
      className={[
        "bg-gray-900 border-t border-gray-700 p-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Category filter tabs */}
      <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={[
            "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
            activeCategory === null
              ? "bg-white text-black"
              : "bg-gray-800 text-gray-400 hover:text-white",
          ].join(" ")}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            className={[
              "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap capitalize transition-colors",
              activeCategory === cat
                ? "bg-white text-black"
                : "bg-gray-800 text-gray-400 hover:text-white",
            ].join(" ")}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Command buttons grid */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        {filteredActions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action)}
            className={[
              "px-2 py-2 rounded text-xs font-medium text-white transition-colors",
              "active:scale-95 touch-manipulation",
              CATEGORY_COLORS[action.category] ?? CATEGORY_COLORS.general,
            ].join(" ")}
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* AI prompt input */}
      {onAiPrompt && (
        <form onSubmit={handleAiSubmit} className="flex gap-2">
          <input
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="Ask AI agent..."
            className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="submit"
            disabled={aiInput.trim().length === 0}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors touch-manipulation"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
