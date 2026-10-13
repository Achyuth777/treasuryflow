import React, { useEffect, useRef } from "react";
import { title } from "../workspace";
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    payments: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    reconcile: (
      <>
        <path d="M4 8h15l-4-4M20 16H5l4 4" />
      </>
    ),
    lab: (
      <>
        <path d="M9 3h6M10 3v6L4 19q-1 2 2 2h12q3 0 2-2L14 9V3M7 15h10" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    download: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 7V5a2 2 0 0 1 2-2h12v4M4 7h15a2 2 0 0 1 2 2v10H6a2 2 0 0 1-2-2z" />
        <path d="M21 11h-6v4h6" />
      </>
    ),
    sort: (
      <>
        <path d="M8 4v16m-4-4 4 4 4-4M16 20V4m-4 4 4-4 4 4" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    alert: (
      <>
        <path d="m12 3 10 18H2z" />
        <path d="M12 9v5m0 3v1" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M15 8V3H3v13h5" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-3a8 5 0 0 1 16 0v3" />
      </>
    ),
    logout: (
      <>
        <path d="M9 3H3v18h6M9 12h12m-4-4 4 4-4 4" />
      </>
    ),
    dot: <circle cx="12" cy="12" r="3" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.grid}
    </svg>
  );
}
export function Badge({ status }: { status: string }) {
  return (
    <span className={"badge " + status.toLowerCase()}>
      <i />
      {title(status)}
    </span>
  );
}
export function Empty({
  title: heading,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name="search" size={26} />
      </div>
      <h3>{heading}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
export function Skeleton() {
  return (
    <div
      className="loading-state"
      aria-busy="true"
      aria-label="Loading treasury data"
    >
      <div className="skeleton-heading" />
      <div className="metrics">
        {[1, 2, 3, 4].map((i) => (
          <div className="skeleton-card" key={i} />
        ))}
      </div>
      <div className="skeleton-chart" />
      {[1, 2, 3, 4].map((i) => (
        <div className="skeleton-row" key={i} />
      ))}
    </div>
  );
}
export function Overlay({
  children,
  onClose,
  title: heading,
  wide = false,
  drawer = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  wide?: boolean;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    const app = document.getElementById("workspace");
    app?.setAttribute("inert", "");
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
      if (e.key === "Tab") {
        const els = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,summary,a[href],[tabindex="0"]',
          ) || [],
        ).filter((el) => el.getClientRects().length);
        const first = els[0],
          last = els.at(-1);
        if (!els.length) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = overflow;
      app?.removeAttribute("inert");
      old?.focus();
    };
  }, []);
  return (
    <div
      className={"overlay " + (drawer ? "drawer-overlay" : "")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className={(drawer ? "drawer" : "modal") + (wide ? " wide-modal" : "")}
      >
        <div className="overlay-head">
          <span className="overline">{heading}</span>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close panel"
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function exportJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
