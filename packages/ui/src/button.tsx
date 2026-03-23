import * as React from "react";

// ---------------------------------------------------------------------------
// Variant / size maps
// ---------------------------------------------------------------------------

const VARIANT_CLASSES = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500 disabled:bg-indigo-300",
  secondary:
    "bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-300",
  ghost:
    "text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400 disabled:text-gray-300",
  link: "text-indigo-600 underline-offset-4 hover:underline focus-visible:ring-indigo-500 disabled:text-indigo-300",
} as const;

const SIZE_CLASSES = {
  xs: "h-7 px-2.5 text-xs gap-1",
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-10 px-5 text-base gap-2",
  xl: "h-12 px-6 text-base gap-2.5",
} as const;

const ICON_SIZE_CLASSES = {
  xs: "h-7 w-7",
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ButtonVariant = keyof typeof VARIANT_CLASSES;
export type ButtonSize = keyof typeof SIZE_CLASSES;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style of the button. @default "primary" */
  variant?: ButtonVariant;
  /** Size preset. @default "md" */
  size?: ButtonSize;
  /** When true, the button fills the width of its container. */
  fullWidth?: boolean;
  /** Renders the button as a square icon button. */
  iconOnly?: boolean;
  /** Shows a loading spinner and disables interaction. */
  loading?: boolean;
  /** Icon rendered to the left of the label. */
  leadingIcon?: React.ReactNode;
  /** Icon rendered to the right of the label. */
  trailingIcon?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Core button component for the Sovereign design system.
 *
 * Compose with `asChild` (Radix-style) or simply use the `href` prop via
 * a wrapping `<a>` when link semantics are needed. This component handles
 * only `<button>` semantics to keep the implementation dependency-free.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      iconOnly = false,
      loading = false,
      leadingIcon,
      trailingIcon,
      className,
      disabled,
      children,
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const baseClasses = [
      // Layout
      "inline-flex items-center justify-center",
      // Typography
      "font-medium leading-none",
      // Shape
      "rounded-md",
      // Focus
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      // Transitions
      "transition-colors duration-150 ease-in-out",
      // Cursor
      isDisabled ? "cursor-not-allowed" : "cursor-pointer",
      // Width
      fullWidth ? "w-full" : "",
      // Variant
      VARIANT_CLASSES[variant],
      // Size
      iconOnly ? ICON_SIZE_CLASSES[size] : SIZE_CLASSES[size],
      // Custom
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button ref={ref} className={baseClasses} disabled={isDisabled} {...rest}>
        {loading ? (
          <Spinner
            aria-hidden="true"
            className={iconOnly ? "" : "-ml-0.5"}
            size={size}
          />
        ) : (
          leadingIcon && (
            <span aria-hidden="true" className="shrink-0">
              {leadingIcon}
            </span>
          )
        )}
        {!iconOnly && children && <span>{children}</span>}
        {!loading && trailingIcon && (
          <span aria-hidden="true" className="shrink-0">
            {trailingIcon}
          </span>
        )}
        {loading && <span className="sr-only">Loading…</span>}
      </button>
    );
  }
);

Button.displayName = "Button";

// ---------------------------------------------------------------------------
// Spinner – inline loading indicator
// ---------------------------------------------------------------------------

interface SpinnerProps {
  size?: ButtonSize;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

const SPINNER_SIZE: Record<ButtonSize, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-4 w-4",
  xl: "h-5 w-5",
};

const Spinner: React.FC<SpinnerProps> = ({
  size = "md",
  className = "",
  ...rest
}) => (
  <svg
    className={`animate-spin ${SPINNER_SIZE[size]} ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    {...rest}
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);
