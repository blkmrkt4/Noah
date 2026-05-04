/**
 * Shared UI components — EY branded.
 */

import { ReactNode } from "react";

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-ey-yellow text-3xl font-bold mb-6 w-full">{children}</h1>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-ey-yellow text-xl font-semibold mb-4">{children}</h2>
  );
}

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`bg-ey-dark-gray rounded-lg p-6 border border-ey-sonic-silver/30 ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  color = "default",
}: {
  children: ReactNode;
  color?: "default" | "yellow" | "green" | "red" | "orange" | "blue" | "purple";
}) {
  const colors = {
    default: "bg-ey-sonic-silver/30 text-ey-light-gray",
    yellow: "bg-ey-yellow/20 text-ey-yellow",
    green: "bg-frame-green/20 text-frame-green",
    red: "bg-frame-red/20 text-frame-red",
    orange: "bg-frame-orange/20 text-frame-orange",
    blue: "bg-frame-blue/20 text-frame-blue",
    purple: "bg-frame-purple/20 text-frame-purple",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[color]}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  onClick,
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const variants = {
    primary: "bg-ey-yellow text-black hover:bg-ey-yellow/90",
    secondary: "bg-ey-dark-gray text-white border border-ey-sonic-silver hover:border-ey-yellow/50",
    danger: "bg-frame-red/20 text-frame-red border border-frame-red/30 hover:bg-frame-red/30",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  helpText,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-ey-light-gray">
        {label}
        {required && <span className="text-frame-red ml-1">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50 transition-colors"
      />
      {helpText && <p className="text-xs text-ey-sonic-silver">{helpText}</p>}
    </div>
  );
}

export function Select({
  label,
  name,
  options,
  value,
  onChange,
  required,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-ey-light-gray">
        {label}
        {required && <span className="text-frame-red ml-1">*</span>}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-3 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white focus:outline-none focus:border-ey-yellow/50 transition-colors"
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs text-ey-light-gray">
          <span>{label}</span>
          <span>{value}/{max}</span>
        </div>
      )}
      <div className="h-2 bg-ey-dark-gray rounded-full overflow-hidden border border-ey-sonic-silver/20">
        <div
          className="h-full bg-ey-yellow rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function StatusIndicator({
  status,
}: {
  status: string;
}) {
  const statusConfig: Record<string, { color: string; label: string }> = {
    drafting: { color: "bg-ey-sonic-silver", label: "Drafting" },
    released: { color: "bg-frame-blue", label: "Released" },
    under_review: { color: "bg-frame-orange", label: "Under Review" },
    cleared: { color: "bg-frame-green", label: "Cleared" },
    submitted: { color: "bg-frame-purple", label: "Submitted" },
    in_review: { color: "bg-frame-orange", label: "In Review" },
    disposed: { color: "bg-frame-green", label: "Disposed" },
    open: { color: "bg-frame-blue", label: "Open" },
    responded: { color: "bg-frame-orange", label: "Responded" },
    resolved: { color: "bg-frame-green", label: "Resolved" },
    pending: { color: "bg-ey-sonic-silver", label: "Pending" },
    accepted: { color: "bg-frame-green", label: "Accepted" },
  };

  const config = statusConfig[status] || { color: "bg-ey-sonic-silver", label: status };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-xs text-ey-light-gray">{config.label}</span>
    </div>
  );
}
