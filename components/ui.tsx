"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, Clapperboard, Crown } from "lucide-react";
import { initials, colorFor } from "../core/format";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg className="neo-symbol" width="29" height="30" viewBox="0 0 32 34" fill="none" aria-hidden="true"><path d="M4 29V5L27 29V5" stroke="currentColor" strokeWidth="5" strokeLinejoin="round"/><path d="M5 5H12M20 29H27" stroke="currentColor" strokeWidth="2"/></svg>
      {!compact && (
        <span>
          Neostance<span className="brand-period">.</span>
        </span>
      )}
    </span>
  );
}
export function Modal({
  children,
  title,
  subtitle,
  close,
  wide = false,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  close: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const nodes = () =>
      [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          'button, input, textarea, a[href], select, [tabindex="0"]',
        ) || []),
      ].filter((e) => !e.hasAttribute("disabled"));
    nodes()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const list = nodes(),
          first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = before;
      previous?.focus();
    };
  }, [close]);
  return (
    <div
      className="modal-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          className="icon-button modal-close"
          onClick={close}
          aria-label="Close dialog"
        >
          <X size={19} />
        </button>
        <div className="eyebrow amber">
          <Clapperboard size={14} /> MAKE YOURSELF AT HOME
        </div>
        <h2>{title}</h2>
        {subtitle && <p className="modal-subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
export function Avatar({
  member,
  size = "normal",
  host = false,
}: {
  member: { name: string; id: string };
  size?: string;
  host?: boolean;
}) {
  return (
    <span
      className={`avatar ${size}`}
      style={{ background: colorFor(member.id) }}
      title={member.name}
    >
      {initials(member.name)}
      {host && <Crown className="avatar-crown" size={12} />}
    </span>
  );
}
