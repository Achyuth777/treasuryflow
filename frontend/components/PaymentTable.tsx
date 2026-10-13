import React, { useMemo, useState } from "react";
import type { Payment } from "../model";
import { money, dateLabel } from "../workspace";
import { Icon, Badge, Empty, exportJson } from "./ui";
export function PaymentTable({
  payments,
  supplierName,
  filter,
  setFilter,
  onOpen,
  onCreate,
  canCreate,
  compact = false,
}: {
  payments: Payment[];
  supplierName: (id: string) => string;
  filter: string;
  setFilter: (s: string) => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
  canCreate: boolean;
  compact?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("dueDate"),
    [descending, setDescending] = useState(true),
    [page, setPage] = useState(0);
  const data = useMemo(
    () =>
      payments
        .filter(
          (p) =>
            (filter === "ALL" || p.status === filter || (filter === "ATTENTION" && ["EXECUTING", "FAILED"].includes(p.status))) &&
            `${p.invoice} ${supplierName(p.recipient)} ${p.amount}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) => {
          let result =
            sort === "amount"
              ? Number(a.amount) - Number(b.amount)
              : sort === "supplier"
                ? supplierName(a.recipient).localeCompare(
                    supplierName(b.recipient),
                  )
                : String(a[sort as keyof Payment]).localeCompare(
                    String(b[sort as keyof Payment]),
                  );
          return descending ? -result : result;
        }),
    [payments, filter, query, sort, descending, supplierName],
  );
  const size = compact ? 5 : 8;
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(data.length / size) - 1),
  );
  const displayed = data.slice(current * size, (current + 1) * size);
  const sortBy = (v: string) => {
    if (v === sort) setDescending(!descending);
    else {
      setSort(v);
      setDescending(false);
    }
    setPage(0);
  };
  return (
    <section className="panel payment-table">
      <div className="panel-heading">
        <div>
          <h2>
            Payment requests <span className="count">{payments.length}</span>
          </h2>
          <p>Every invoice, in one place.</p>
        </div>
        <button
          className="button small-button"
          onClick={() => exportJson(data, "treasuryflow-payments.json")}
        >
          <Icon name="download" size={16} />
          <span>Export</span>
        </button>
      </div>
      <div className="table-controls">
        <div className="filter-tabs" aria-label="Payment status">
          {[
            "ALL",
            "PENDING",
            "APPROVED",
            "EXECUTING",
            "SETTLED",
            "REJECTED",
            ...(filter === "ATTENTION" ? ["ATTENTION"] : []),
          ].map((s) => (
            <button
              key={s}
              className={filter === s ? "active" : ""}
              aria-pressed={filter === s}
              onClick={() => {
                setFilter(s);
                setPage(0);
              }}
            >
              {
                (
                  {
                    ALL: "All payments",
                    PENDING: "Needs approval",
                    APPROVED: "Ready",
                    EXECUTING: "Processing",
                    SETTLED: "Settled",
                    REJECTED: "Rejected",
                    ATTENTION: "Needs attention",
                  } as Record<string, string>
                )[s]
              }
              {s === "PENDING" && (
                <b>{payments.filter((p) => p.status === s).length}</b>
              )}
            </button>
          ))}
        </div>
        <div className="table-search">
          <Icon name="search" size={17} />
          <input
            aria-label="Search payments"
            placeholder="Search supplier, invoice or amount"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
          {query && (
            <button
              className="icon-btn small"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      </div>
      {(query || filter !== "ALL") && <div className="active-filters"><span>{data.length} matching {data.length === 1 ? "payment" : "payments"}</span><button onClick={() => { setQuery(""); setFilter("ALL"); setPage(0); }}>Clear filters <Icon name="close" size={12} /></button></div>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {[
                ["supplier", "Supplier / invoice"],
                ["amount", "Amount"],
                ["dueDate", "Due date"],
                ["status", "Status"],
              ].map(([k, v]) => (
                <th
                  key={k}
                  aria-sort={
                    sort === k
                      ? descending
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <button onClick={() => sortBy(k)}>
                    {v}
                    <Icon name="sort" size={13} />
                  </button>
                </th>
              ))}
              <th>
                <span className="sr-only">Open details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((p) => (
              <tr key={p.id} onClick={() => onOpen(p.id)}>
                <td>
                  <div className="supplier-cell">
                    <span
                      className={
                        "supplier-avatar " +
                        (supplierName(p.recipient).startsWith("Atlas")
                          ? "peach"
                          : "")
                      }
                    >
                      {supplierName(p.recipient)[0]}
                    </span>
                    <div>
                      <button
                        className="row-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(p.id);
                        }}
                      >
                        {supplierName(p.recipient)}
                      </button>
                      <small>{p.invoice}</small>
                    </div>
                  </div>
                </td>
                <td className="money-cell">
                  {money(p.amount)}
                  <small>mUSD</small>
                </td>
                <td className="due-cell">
                  {dateLabel(p.dueDate)}
                  <small>{p.dueDate.slice(0, 4)}</small>
                </td>
                <td className="status-cell">
                  <Badge status={p.status} />
                </td>
                <td>
                  <Icon name="chevron" size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.length && (
        <Empty
          title={
            payments.length
              ? "No matching payments"
              : "Your payment queue is clear"
          }
          detail={
            payments.length
              ? "Try another status or search term."
              : "Create a supplier request to start the approval workflow."
          }
          action={
            payments.length ? (
              <button
                className="button"
                onClick={() => {
                  setQuery("");
                  setFilter("ALL");
                }}
              >
                Clear filters
              </button>
            ) : (
              <button
                className="button primary"
                disabled={!canCreate}
                onClick={onCreate}
              >
                Create first payment
              </button>
            )
          }
        />
      )}
      <div className="table-footer">
        <span>
          {data.length
            ? `${current * size + 1}–${Math.min((current + 1) * size, data.length)} of ${data.length} payments`
            : "0 payments"}{" "}
          <span className="muted">· All amounts in mUSD</span>
        </span>
        <div>
          <button
            className="icon-btn"
            aria-label="Previous page"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <span className="rotate">
              <Icon name="chevron" size={16} />
            </span>
          </button>
          <span>
            {current + 1} / {Math.max(1, Math.ceil(data.length / size))}
          </span>
          <button
            className="icon-btn"
            aria-label="Next page"
            disabled={(current + 1) * size >= data.length}
            onClick={() => setPage(current + 1)}
          >
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
