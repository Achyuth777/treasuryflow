package com.treasuryflow;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class Payments {
  private final JdbcTemplate db;
  private final Chain chain;
  private final boolean failpoints;

  public Payments(JdbcTemplate db, Chain chain, @Value("${demo.failpoints}") boolean failpoints) {
    this.db = db;
    this.chain = chain;
    this.failpoints = failpoints;
  }

  void audit(String id, String actor, String action, String detail) {
    db.update(
        "INSERT INTO audit(payment_id,actor,action,detail) VALUES(?,?,?,?)",
        id,
        actor,
        action,
        detail);
  }

  void require(boolean condition, String message) {
    if (!condition) throw new ResponseStatusException(HttpStatus.CONFLICT, message);
  }

  void role(String actor, String role, String id) {
    boolean ok =
        role.equals("CREATOR")
            ? actor.equals("creator")
            : actor.equals("manager1") || actor.equals("manager2");
    if (!ok) {
      audit(id, actor, "DENIED", role + " role required");
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, role + " role required");
    }
  }

  Map<String, Object> row(String id) {
    return db
        .query(
            "SELECT * FROM payments WHERE id=?",
            (rs, i) -> {
              Map<String, Object> p = new LinkedHashMap<>();
              p.put("id", rs.getString("id"));
              p.put("invoice", rs.getString("invoice"));
              p.put("recipient", rs.getString("recipient"));
              p.put("amount", rs.getBigDecimal("amount").toPlainString());
              p.put("dueDate", rs.getDate("due_date").toLocalDate().toString());
              p.put("creator", rs.getString("creator"));
              p.put("status", rs.getString("status"));
              p.put("txHash", rs.getString("tx_hash"));
              return p;
            },
            id)
        .stream()
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));
  }

  public synchronized Map<String, Object> create(String actor, Map<String, Object> b) {
    role(actor, "CREATOR", "new");
    String id = Objects.toString(b.get("id"), "");
    UUID.fromString(id);
    String invoice = Objects.toString(b.get("invoice"), "").trim().toUpperCase(Locale.ROOT);
    require(
        invoice.matches("[A-Z0-9][A-Z0-9 ._/-]{0,99}"), "Use a 1–100 character invoice reference");
    String recipient = Objects.toString(b.get("recipient"), "").toLowerCase(Locale.ROOT);
    BigDecimal amount = new BigDecimal(Objects.toString(b.get("amount"), "0"));
    require(
        amount.signum() > 0
            && amount.scale() <= 6
            && amount.compareTo(new BigDecimal("25000")) <= 0,
        "Amount must be 0–25,000 with up to six decimals");
    LocalDate due = LocalDate.parse(Objects.toString(b.get("dueDate"), ""));
    require(due.getYear() >= 2000 && due.getYear() <= 2100, "Due date outside supported range");
    var config = chain.config();
    var suppliers = (List<?>) config.get("suppliers");
    require(
        suppliers.stream()
            .anyMatch(s -> ((Map<?, ?>) s).get("id").toString().equalsIgnoreCase(recipient)),
        "Recipient is not approved");
    var old = db.queryForList("SELECT id FROM payments WHERE id=?", id);
    if (!old.isEmpty()) {
      var p = row(id);
      require(
          p.get("invoice").equals(invoice)
              && p.get("recipient").equals(recipient)
              && new BigDecimal(p.get("amount").toString()).compareTo(amount) == 0
              && p.get("dueDate").equals(due.toString()),
          "Idempotency key reused with different payload");
      audit(id, actor, "DUPLICATE_BLOCKED", "Returned original request; no new payment created");
      return p;
    }
    try {
      db.update(
          "INSERT INTO payments(id,invoice,recipient,amount,due_date,creator,status)"
              + " VALUES(?,?,?,?,?,?,?)",
          id,
          invoice,
          recipient,
          amount,
          due,
          actor,
          "PENDING");
    } catch (DuplicateKeyException e) {
      audit(id, actor, "DUPLICATE_BLOCKED", "Supplier and invoice already recorded");
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "This supplier invoice already exists");
    }
    audit(id, actor, "REQUESTED", "Invoice " + invoice + " • " + amount.toPlainString() + " mUSD");
    return row(id);
  }

  Map<String, Object> register(Map<String, Object> p) {
    return chain.action(
        "request",
        p.get("id").toString(),
        p.get("creator").toString(),
        Map.of(
            "recipient",
            p.get("recipient"),
            "amount",
            p.get("amount"),
            "dueAt",
            LocalDate.parse(p.get("dueDate").toString())
                .atStartOfDay(ZoneOffset.UTC)
                .toEpochSecond()));
  }

  int required(Map<String, Object> p) {
    return new BigDecimal(p.get("amount").toString()).compareTo(new BigDecimal("5000")) > 0 ? 2 : 1;
  }

  public synchronized Map<String, Object> act(
      String id, String actor, String kind, boolean interrupt) {
    if (kind.equals("approve") || kind.equals("reject")) role(actor, "APPROVER", id);
    else if (kind.equals("execute")) {
      if (!actor.equals("creator")) role(actor, "APPROVER", id);
    } else throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown action");
    var p = row(id);
    if (kind.equals("execute") && p.get("status").equals("SETTLED")) {
      audit(id, actor, "DUPLICATE_BLOCKED", "Payment already settled");
      return p;
    }
    require(
        !p.get("status").equals("SETTLED") && !p.get("status").equals("REJECTED"),
        "Payment is closed");
    var state = register(p);
    if (kind.equals("execute")) {
      require(
          ((List<?>) state.get("approvals")).size() >= required(p), "Additional approval required");
      require(
          !LocalDate.parse(p.get("dueDate").toString()).isAfter(LocalDate.now(ZoneOffset.UTC)),
          "Payment is not due yet");
      if (interrupt && !failpoints)
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failure injection is disabled");
      // Commit durable intent BEFORE submitting. Never infer failed settlement from a timeout.
      db.update("UPDATE payments SET status='EXECUTING' WHERE id=?", id);
      audit(id, actor, "EXECUTION_REQUESTED", "Durable intent saved before submission");
    }
    Map<String, Object> result = chain.action(kind, id, actor, Map.of());
    if (kind.equals("execute") && interrupt) {
      audit(
          id,
          "system",
          "INTERRUPTED",
          "Injected loss of response after chain confirmation; reconcile to recover");
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "Simulated interruption. Settlement may exist; run reconciliation.");
    }
    apply(id, p, result);
    importEvents();
    return row(id);
  }

  void apply(String id, Map<String, Object> p, Map<String, Object> s) {
    String status =
        Boolean.TRUE.equals(s.get("executed"))
            ? "SETTLED"
            : Boolean.TRUE.equals(s.get("rejected"))
                ? "REJECTED"
                : ((List<?>) s.get("approvals")).size() >= required(p) ? "APPROVED" : "PENDING";
    db.update("UPDATE payments SET status=?,tx_hash=? WHERE id=?", status, s.get("txHash"), id);
  }

  public synchronized List<Map<String, Object>> list() {
    List<Map<String, Object>> out = new ArrayList<>();
    for (var r : db.queryForList("SELECT id FROM payments ORDER BY created_at DESC")) {
      var p = row(r.get("id").toString());
      var s = chain.snapshot(p.get("id").toString());
      p.put("approvals", s.get("approvals"));
      p.put("required", required(p));
      out.add(p);
    }
    return out;
  }

  public List<Map<String, Object>> audits() {
    return db.queryForList("SELECT * FROM audit ORDER BY id DESC LIMIT 500");
  }

  Map<String, String> keyMap() {
    Map<String, String> map = new HashMap<>();
    for (var r : db.queryForList("SELECT id FROM payments")) {
      String id = r.get("id").toString();
      map.put(chain.snapshot(id).get("key").toString(), id);
    }
    return map;
  }

  void importEvents() {
    var keys = keyMap();
    for (var e : chain.events()) {
      try {
        db.update(
            "INSERT INTO audit(payment_id,actor,action,detail,event_key) VALUES(?,?,?,?,?)",
            keys.getOrDefault(e.get("paymentKey").toString(), e.get("paymentKey").toString()),
            e.get("actor"),
            e.get("action"),
            "Chain event • " + e.get("txHash"),
            e.get("key"));
      } catch (DuplicateKeyException ignored) {
      }
    }
  }

  public synchronized Map<String, Object> reconcile() {
    List<Map<String, Object>> flags = new ArrayList<>();
    int recovered = 0, matched = 0;
    var keys = keyMap();
    for (var r : db.queryForList("SELECT id FROM payments")) {
      String id = r.get("id").toString();
      var p = row(id);
      var s = chain.snapshot(id);
      if (Boolean.TRUE.equals(s.get("executed"))) {
        if (!p.get("recipient").toString().equalsIgnoreCase(s.get("recipient").toString())
            || new BigDecimal(p.get("amount").toString())
                    .compareTo(new BigDecimal(s.get("amount").toString()))
                != 0) {
          flags.add(Map.of("id", id, "issue", "AMOUNT_OR_RECIPIENT_MISMATCH"));
          continue;
        }
        if (((Number) s.get("confirmations")).intValue() < 1) {
          flags.add(Map.of("id", id, "issue", "AWAITING_CONFIRMATIONS"));
          continue;
        }
        if (p.get("txHash") != null && !p.get("txHash").equals(s.get("txHash"))) {
          flags.add(Map.of("id", id, "issue", "TRANSACTION_HASH_MISMATCH"));
          continue;
        }
        if (!p.get("status").equals("SETTLED")) {
          apply(id, p, s);
          audit(id, "reconciler", "RECOVERED", "Confirmed settlement restored from chain event");
          recovered++;
        }
        matched++;
      } else if (p.get("status").equals("SETTLED"))
        flags.add(Map.of("id", id, "issue", "MISSING_CHAIN_SETTLEMENT"));
      else if (Boolean.TRUE.equals(s.get("exists")) && !p.get("status").equals("EXECUTING"))
        apply(id, p, s);
      else if (p.get("status").equals("EXECUTING"))
        flags.add(Map.of("id", id, "issue", "UNCONFIRMED_INTENT_RETRY_SAFE"));
    }
    for (var e : chain.events())
      if (e.get("action").equals("EXECUTED") && !keys.containsKey(e.get("paymentKey").toString()))
        flags.add(Map.of("id", e.get("paymentKey"), "issue", "UNRECORDED_CHAIN_PAYMENT"));
    importEvents();
    return Map.of(
        "matched",
        matched,
        "recovered",
        recovered,
        "flags",
        flags,
        "checkedAt",
        Instant.now().toString());
  }

  @Scheduled(fixedDelayString = "${reconciliation.interval:30000}", initialDelay = 30000)
  public void recover() {
    try {
      reconcile();
    } catch (Exception e) {
      org.slf4j.LoggerFactory.getLogger(Payments.class)
          .warn("Reconciliation deferred: {}", e.getClass().getSimpleName());
    }
  }
}
