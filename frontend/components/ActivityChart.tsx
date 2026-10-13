import React, { useMemo, useState } from "react";
import { settlementSeries, money, dateLabel } from "../workspace";
import type { Payment, Audit } from "../model";
export function ActivityChart({
  payments,
  audit,
}: {
  payments: Payment[];
  audit: Audit[];
}) {
  const [days, setDays] = useState(7),
    [hover, setHover] = useState<number | null>(null);
  const series = useMemo(
    () => settlementSeries(payments, audit, days),
    [payments, audit, days],
  );
  const max = Math.max(100, ...series.map((s) => s.value));
  const total = series.reduce((s, v) => s + v.value, 0);
  const selected = series[hover ?? series.length - 1];
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>Settlement activity</h2>
          <p>Confirmed payments recorded in the audit trail</p>
        </div>
        <div className="segmented" aria-label="Chart time range">
          {[7, 14, 30].map((n) => (
            <button
              key={n}
              aria-pressed={days === n}
              className={days === n ? "active" : ""}
              onClick={() => {
                setDays(n);
                setHover(null);
              }}
            >
              {n}D
            </button>
          ))}
        </div>
      </div>
      <div className="chart-summary">
        <strong>
          {money(total)} <small>mUSD</small>
        </strong>
        <span>Settled in the last {days} days</span>
      </div>
      <div className="plot">
        <div className="y-axis">
          <span>{Math.ceil(max / 1000)}k</span>
          <span>{(max / 2000).toFixed(1)}k</span>
          <span>0</span>
        </div>
        <div
          className="bars"
          style={{ gap: days <= 7 ? "6%" : days <= 14 ? "2.5%" : "1%" }}
          role="group"
          aria-label="Daily recorded settlements"
        >
          {series.map((s, i) => (
            <button
              key={s.date}
              className={"bar-column " + (hover === i ? "highlight" : "")}
              onFocus={() => setHover(i)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover(i)}
              aria-label={`${dateLabel(s.date)}: ${money(s.value)} mUSD settled`}
            >
              <span
                className="bar-fill"
                style={{ height: `${Math.max(2, (s.value / max) * 100)}%` }}
              />
              <span className="bar-label">
                {days <= 7 || i === 0 || i === days - 1 || i % 7 === 0
                  ? dateLabel(s.date)
                  : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="chart-tooltip" aria-live="polite">
        <span>
          <i />
          {dateLabel(selected.date)}
        </span>
        <b>{money(selected.value)} mUSD</b>
        <span>confirmed</span>
      </div>
    </section>
  );
}
