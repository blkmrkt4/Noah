/**
 * Shared UI components — EY branded.
 */

import { ReactNode } from "react";

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-ey-yellow text-3xl font-bold mb-6">{children}</h1>
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
      className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
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

// Small inline SVG icons for metric cells. 14×14, stroke-based, currentColor.
const iconProps = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function IconUsers() {
  return (
    <svg {...iconProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconMessageCircle() {
  return (
    <svg {...iconProps}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export function IconLayers() {
  return (
    <svg {...iconProps}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

export function IconClock() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function IconShield() {
  return (
    <svg {...iconProps}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function IconFileSearch() {
  return (
    <svg {...iconProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <circle cx="11.5" cy="14.5" r="2.5" />
      <line x1="13.3" y1="16.3" x2="15" y2="18" />
    </svg>
  );
}

export function IconAlertTriangle() {
  return (
    <svg {...iconProps}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function IconHourglass() {
  return (
    <svg {...iconProps}>
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  );
}

export function IconSend() {
  return (
    <svg {...iconProps}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export function IconCalendar() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export function SignalDot({
  signal,
  size = "sm",
}: {
  signal: "red" | "yellow" | "green";
  size?: "sm" | "md";
}) {
  const colors = {
    red: "bg-frame-red",
    yellow: "bg-ey-yellow",
    green: "bg-frame-green",
  };
  const sizes = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
  };
  return <span className={`inline-block rounded-full ${colors[signal]} ${sizes[size]}`} />;
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
