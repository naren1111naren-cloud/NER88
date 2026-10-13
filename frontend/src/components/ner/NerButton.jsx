import React from 'react';

/**
 * NerButton — Institutional Button Component
 * Variants: primary | secondary | outline | danger | ghost
 * Sizes: sm | md | lg
 */
export const NerButton = ({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  className = '',
  onClick,
  type = 'button',
  title,
  ...props
}) => {
  const baseClasses = "inline-flex items-center justify-center font-semibold transition-colors duration-150 rounded-md focus:outline-hidden focus:ring-2 focus:ring-ner-secondary/40 select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

  const sizeClasses = {
    sm: "px-2.5 py-1 text-xs gap-1.5",
    md: "px-3.5 py-1.5 text-xs gap-2",
    lg: "px-4 py-2 text-sm gap-2",
  }[size] || "px-3.5 py-1.5 text-xs gap-2";

  const variantClasses = {
    primary: "bg-ner-primary hover:bg-ner-primary-dark text-white border border-ner-primary shadow-xs active:translate-y-px",
    secondary: "bg-ner-secondary hover:bg-ner-secondary-dark text-white border border-ner-secondary shadow-xs active:translate-y-px",
    outline: "bg-white hover:bg-ner-background text-ner-text border border-ner-border hover:border-ner-border-strong active:bg-ner-subtle",
    danger: "bg-ner-blocked hover:bg-red-700 text-white border border-ner-blocked shadow-xs active:translate-y-px",
    ghost: "bg-transparent hover:bg-ner-subtle text-ner-text-secondary hover:text-ner-text",
  }[variant] || "bg-ner-primary text-white";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : (
        Icon && iconPosition === 'left' && <Icon className="w-3.5 h-3.5 shrink-0" />
      )}
      <span>{children}</span>
      {!loading && Icon && iconPosition === 'right' && <Icon className="w-3.5 h-3.5 shrink-0" />}
    </button>
  );
};

export default NerButton;
