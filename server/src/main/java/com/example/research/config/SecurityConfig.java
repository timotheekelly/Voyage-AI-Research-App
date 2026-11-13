package com.example.research.config;

import com.example.research.exception.ApiError;
import com.example.research.security.DevAuthenticationFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, SecurityProperties props, Environment env,
                                    ObjectProvider<JwtDecoder> jwtDecoder) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) ->
                                write(req, res, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication is required."))
                        .accessDeniedHandler((req, res, ex) ->
                                write(req, res, HttpStatus.FORBIDDEN, "FORBIDDEN", "You do not have access to this resource.")));

        if (props.mode() == SecurityProperties.Mode.DEV) {
            if (env.acceptsProfiles(Profiles.of("prod", "production"))) {
                throw new IllegalStateException("app.security.mode=dev must never be enabled with a production profile.");
            }
            // Development only: every request is authenticated as the seeded user. Identity is never client-supplied.
            http.addFilterBefore(new DevAuthenticationFilter(props.devUserId()), AnonymousAuthenticationFilter.class);
        } else {
            if (jwtDecoder.getIfAvailable() == null) {
                throw new IllegalStateException("app.security.mode=jwt requires spring.security.oauth2.resourceserver.jwt."
                        + "issuer-uri (or jwk-set-uri). For local development run with the 'dev' profile "
                        + "(SPRING_PROFILES_ACTIVE=dev), which uses a seeded test user.");
            }
            http.oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()));
        }
        return http.build();
    }

    private static void write(HttpServletRequest req, HttpServletResponse res, HttpStatus status, String code, String message)
            throws IOException {
        res.setStatus(status.value());
        res.setContentType("application/json");
        ApiError body = new ApiError(Instant.now(), status.value(), code, message, req.getRequestURI(), null);
        res.getWriter().write("{\"timestamp\":\"" + body.timestamp() + "\",\"status\":" + body.status()
                + ",\"error\":\"" + body.error() + "\",\"message\":\"" + body.message()
                + "\",\"path\":\"" + body.path().replace("\"", "") + "\"}");
    }
}
