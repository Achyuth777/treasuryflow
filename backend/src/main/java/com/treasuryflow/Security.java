package com.treasuryflow;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class Security {
  @Bean
  UserDetailsService users(@Value("${demo.password}") String password) {
    var encoder = new BCryptPasswordEncoder();
    var encoded = encoder.encode(password);
    return new InMemoryUserDetailsManager(
        User.withUsername("creator").password(encoded).roles("CREATOR").build(),
        User.withUsername("manager1").password(encoded).roles("APPROVER").build(),
        User.withUsername("manager2").password(encoded).roles("APPROVER").build(),
        User.withUsername("auditor").password(encoded).roles("AUDITOR").build());
  }

  @Bean
  org.springframework.security.crypto.password.PasswordEncoder encoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  SecurityFilterChain filter(HttpSecurity http) throws Exception {
    // Local API uses explicit Authorization headers, no cookies or persistent browser credentials.
    return http.csrf(c -> c.disable())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(a -> a.anyRequest().authenticated())
        .httpBasic(Customizer.withDefaults())
        .build();
  }
}
