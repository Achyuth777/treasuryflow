package com.treasuryflow;

import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@SuppressWarnings("unchecked")
public class Chain {
  private final RestClient client;

  public Chain(@Value("${bridge.url}") String url, @Value("${bridge.secret}") String secret) {
    client = RestClient.builder().baseUrl(url).defaultHeader("X-Bridge-Secret", secret).build();
  }

  public Map<String, Object> config() {
    return client.get().uri("/config").retrieve().body(Map.class);
  }

  public Map<String, Object> snapshot(String id) {
    return client.get().uri("/payments/" + id).retrieve().body(Map.class);
  }

  public List<Map<String, Object>> events() {
    return client.get().uri("/events").retrieve().body(List.class);
  }

  public Map<String, Object> action(
      String kind, String id, String actor, Map<String, Object> payload) {
    return client
        .post()
        .uri("/action")
        .body(Map.of("kind", kind, "id", id, "actor", actor, "payload", payload))
        .retrieve()
        .body(Map.class);
  }
}
