"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// =============================================================================
// INPUT VARIANTS
// =============================================================================

const inputVariants = cva(
  `w-full rounded-xl bg-zinc-900/50 text-zinc-100 placeholder:text-zinc-500
   border transition-all duration-200 ease-out
   focus:outline-none
   disabled:cursor-not-allowed disabled:opacity-50`,
  {
    variants: {
      variant: {
        default: `
          border-zinc-800
          hover:border-zinc-700
          focus:border-indigo-500
          focus:ring-2 focus:ring-indigo-500/20
        `,
        filled: `
          bg-zinc-800/80 border-transparent
          hover:bg-zinc-800
          focus:bg-zinc-800
          focus:border-indigo-500
          focus:ring-2 focus:ring-indigo-500/20
        `,
        glass: `
          bg-white/5 border-white/10
          backdrop-blur-xl
          hover:bg-white/8 hover:border-white/15
          focus:border-indigo-500/50
          focus:ring-2 focus:ring-indigo-500/20
        `,
        error: `
          border-red-500/50
          focus:border-red-500
          focus:ring-2 focus:ring-red-500/20
        `,
      },
      inputSize: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-4 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "md",
    },
  }
);

// =============================================================================
// INPUT COMPONENT
// =============================================================================

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  error?: boolean;
  errorMessage?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      inputSize,
      type = "text",
      leftIcon,
      rightIcon,
      error,
      errorMessage,
      disabled,
      ...props
    },
    ref
  ) => {
    const effectiveVariant = error ? "error" : variant;

    return (
      <div className="relative w-full">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
            {leftIcon}
          </div>
        )}

        <input
          type={type}
          className={cn(
            inputVariants({ variant: effectiveVariant, inputSize }),
            leftIcon && "pl-10",
            rightIcon && "pr-10",
            className
          )}
          ref={ref}
          disabled={disabled}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
            {rightIcon}
          </div>
        )}

        {error && errorMessage && (
          <p className="mt-1.5 text-sm text-red-400">{errorMessage}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

// =============================================================================
// TEXTAREA COMPONENT
// =============================================================================

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof inputVariants> {
  error?: boolean;
  errorMessage?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { className, variant, error, errorMessage, disabled, ...props },
    ref
  ) => {
    const effectiveVariant = error ? "error" : variant;

    return (
      <div className="relative w-full">
        <textarea
          className={cn(
            inputVariants({ variant: effectiveVariant }),
            "min-h-[120px] py-3 px-4 resize-none",
            className
          )}
          ref={ref}
          disabled={disabled}
          {...props}
        />

        {error && errorMessage && (
          <p className="mt-1.5 text-sm text-red-400">{errorMessage}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

// =============================================================================
// SEARCH INPUT
// =============================================================================

import { Search, X } from "lucide-react";

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  onClear?: () => void;
  inputSize?: "sm" | "md" | "lg";
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onClear, inputSize = "md", ...props }, ref) => {
    const hasValue = value && String(value).length > 0;

    return (
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />

        <input
          type="text"
          ref={ref}
          value={value}
          className={cn(
            inputVariants({ inputSize }),
            "pl-10",
            hasValue && onClear ? "pr-10" : "pr-4",
            className
          )}
          {...props}
        />

        {hasValue && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";

// =============================================================================
// LABEL COMPONENT
// =============================================================================

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "block text-sm font-medium text-zinc-300 mb-1.5",
          className
        )}
        {...props}
      >
        {children}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
    );
  }
);

Label.displayName = "Label";

// =============================================================================
// FORM FIELD WRAPPER
// =============================================================================

interface FormFieldProps {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  required,
  hint,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label required={required}>{label}</Label>}
      {children}
      {hint && !error && <p className="text-sm text-zinc-500">{hint}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export { Input, Textarea, SearchInput, Label, inputVariants };
