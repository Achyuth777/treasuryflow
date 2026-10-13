package com.treasuryflow;

import static org.junit.jupiter.api.Assertions.*;

import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "spring.datasource.url=jdbc:h2:mem:treasury;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "demo.failpoints=true",
      "reconciliation.interval=3600000"
    })
@EnabledIfEnvironmentVariable(named = "LIVE_CHAIN", matches = "true")
@SuppressWarnings("unchecked")
class PaymentIntegrationTest {
  @Autowired TestRestTemplate http;
  @Autowired JdbcTemplate db;

  TestRestTemplate as(String user) {
    return http.withBasicAuth(user, "treasury-demo-only");
  }

  Map<String, Object> input(String amount) {
    var config = as("creator").getForObject("/api/config", Map.class);
    var suppliers = (List<Map<String, Object>>) config.get("suppliers");
    return new HashMap<>(
        Map.of(
            "id",
            UUID.randomUUID().toString(),
            "invoice",
            "TEST-" + UUID.randomUUID(),
            "recipient",
            suppliers.get(0).get("id"),
            "amount",
            amount,
            "dueDate",
            LocalDate.now(java.time.ZoneOffset.UTC).toString()));
  }

  String create(String amount) {
    var b = input(amount);
    assertEquals(
        200, as("creator").postForEntity("/api/payments", b, Map.class).getStatusCode().value());
    return b.get("id").toString();
  }

  ResponseEntity<Map> action(String id, String user, String action) {
    return as(user).postForEntity("/api/payments/" + id + "/" + action, Map.of(), Map.class);
  }

  @Test
  void authenticationAndUnauthorizedApproval() {
    assertEquals(401, http.getForEntity("/api/payments", String.class).getStatusCode().value());
    String id = create("100");
    assertEquals(403, action(id, "auditor", "approve").getStatusCode().value());
    assertEquals(
        403,
        as("manager1")
            .postForEntity("/api/payments", input("1"), Map.class)
            .getStatusCode()
            .value());
  }

  @Test
  void duplicateIdAndInvoiceAreSafe() {
    var b = input("100");
    assertEquals(
        200, as("creator").postForEntity("/api/payments", b, Map.class).getStatusCode().value());
    assertEquals(
        200, as("creator").postForEntity("/api/payments", b, Map.class).getStatusCode().value());
    assertEquals(
        1,
        db.queryForObject("SELECT COUNT(*) FROM payments WHERE id=?", Integer.class, b.get("id")));
    var changed = new HashMap<>(b);
    changed.put("amount", "101");
    assertEquals(
        409,
        as("creator").postForEntity("/api/payments", changed, Map.class).getStatusCode().value());
    changed = new HashMap<>(b);
    changed.put("id", UUID.randomUUID().toString());
    assertEquals(
        409,
        as("creator").postForEntity("/api/payments", changed, Map.class).getStatusCode().value());
  }

  @Test
  void twoApprovalsAndDuplicateExecution() {
    String id = create("6000");
    assertEquals(200, action(id, "manager1", "approve").getStatusCode().value());
    assertEquals(409, action(id, "creator", "execute").getStatusCode().value());
    assertEquals(200, action(id, "manager2", "approve").getStatusCode().value());
    var result = action(id, "creator", "execute");
    assertEquals(200, result.getStatusCode().value());
    assertEquals("SETTLED", result.getBody().get("status"));
    var retry = action(id, "creator", "execute");
    assertEquals(result.getBody().get("txHash"), retry.getBody().get("txHash"));
  }

  @Test
  void interruptionRecoversAndMismatchIsFlagged() {
    String id = create("100");
    assertEquals(200, action(id, "manager1", "approve").getStatusCode().value());
    assertEquals(503, action(id, "creator", "execute?interrupt=true").getStatusCode().value());
    assertEquals(
        "EXECUTING", db.queryForObject("SELECT status FROM payments WHERE id=?", String.class, id));
    long start = System.nanoTime();
    var r = as("auditor").postForObject("/api/reconcile", Map.of(), Map.class);
    System.out.println(
        "MEASUREMENT reconciliation millis=" + (System.nanoTime() - start) / 1_000_000);
    assertTrue(((Number) r.get("recovered")).intValue() >= 1);
    assertEquals(
        "SETTLED", db.queryForObject("SELECT status FROM payments WHERE id=?", String.class, id));
    db.update("UPDATE payments SET amount=101 WHERE id=?", id);
    r = as("auditor").postForObject("/api/reconcile", Map.of(), Map.class);
    assertTrue(
        ((List<Map<String, Object>>) r.get("flags"))
            .stream()
                .anyMatch(
                    f ->
                        f.get("id").equals(id)
                            && f.get("issue").equals("AMOUNT_OR_RECIPIENT_MISMATCH")));
    assertEquals(
        101, db.queryForObject("SELECT amount FROM payments WHERE id=?", Integer.class, id));
  }

  @Test
  void invalidInputAndRejection() {
    var b = input("0");
    assertEquals(
        409, as("creator").postForEntity("/api/payments", b, Map.class).getStatusCode().value());
    String id = create("99");
    assertEquals(200, action(id, "manager2", "reject").getStatusCode().value());
    assertEquals(409, action(id, "creator", "execute").getStatusCode().value());
  }

  @Test
  void futurePaymentCannotExecute() {
    var b = input("100");
    b.put("dueDate", LocalDate.now(java.time.ZoneOffset.UTC).plusDays(1).toString());
    as("creator").postForEntity("/api/payments", b, Map.class);
    String id = b.get("id").toString();
    assertEquals(200, action(id, "manager1", "approve").getStatusCode().value());
    assertEquals(409, action(id, "creator", "execute").getStatusCode().value());
  }

  @Test
  void formPostsCannotMutatePayments() {
    String id = create("1");
    var headers = new HttpHeaders();
    headers.setContentType(MediaType.TEXT_PLAIN);
    var response =
        as("manager1")
            .exchange(
                "/api/payments/" + id + "/approve",
                HttpMethod.POST,
                new HttpEntity<>("", headers),
                String.class);
    assertEquals(415, response.getStatusCode().value());
  }
}
