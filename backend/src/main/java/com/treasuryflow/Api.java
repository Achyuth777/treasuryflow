package com.treasuryflow;

import java.security.Principal;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class Api {
  private final Payments payments;
  private final Chain chain;

  public Api(Payments payments, Chain chain) {
    this.payments = payments;
    this.chain = chain;
  }

  @GetMapping("/config")
  Object config(Principal p) {
    var c = new HashMap<>(chain.config());
    c.put("actor", p.getName());
    return c;
  }

  @GetMapping("/payments")
  Object list() {
    return payments.list();
  }

  @PostMapping(value = "/payments", consumes = "application/json")
  Object create(Principal p, @RequestBody Map<String, Object> body) {
    return payments.create(p.getName(), body);
  }

  @PostMapping(value = "/payments/{id}/{action}", consumes = "application/json")
  Object act(
      Principal p,
      @PathVariable String id,
      @PathVariable String action,
      @RequestParam(defaultValue = "false") boolean interrupt) {
    return payments.act(id, p.getName(), action, interrupt);
  }

  @GetMapping("/audit")
  Object audit() {
    return payments.audits();
  }

  @PostMapping(value = "/reconcile", consumes = "application/json")
  Object reconcile() {
    return payments.reconcile();
  }

  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<?> status(ResponseStatusException e) {
    return ResponseEntity.status(e.getStatusCode())
        .body(Map.of("error", Objects.toString(e.getReason(), "Request failed")));
  }

  @ExceptionHandler({IllegalArgumentException.class, java.time.DateTimeException.class})
  ResponseEntity<?> invalid(Exception e) {
    return ResponseEntity.badRequest()
        .body(Map.of("error", "Invalid input: check identifier, amount and date"));
  }

  @ExceptionHandler(org.springframework.web.client.RestClientException.class)
  ResponseEntity<?> bridge(Exception e) {
    return ResponseEntity.status(503)
        .body(
            Map.of(
                "error",
                "Chain operation was rejected or unavailable. Refresh or reconcile before"
                    + " retrying."));
  }
}
