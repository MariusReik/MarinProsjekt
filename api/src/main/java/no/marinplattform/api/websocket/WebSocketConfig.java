package no.marinplattform.api.websocket;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * STOMP-over-WebSocket wiring for live position streaming (issue #8).
 * Clients connect once to {@code /ws} and subscribe to
 * {@value PositionBroadcastService#POSITIONS_TOPIC} to receive broadcasts
 * pushed by {@link PositionBroadcastService}.
 *
 * No SockJS fallback: the dashboard (#9) targets modern browsers with
 * native WebSocket support, so the extra dependency isn't worth it for v1.
 *
 * Allowed origins are wide open ("*") because there is no auth/multi-tenant
 * story yet (that's explicitly backlog, issue #21) — tighten this once that
 * lands.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns("*");
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Broadcast-only for now: no client-to-server destinations, so no
        // setApplicationDestinationPrefixes().
        registry.enableSimpleBroker("/topic");
    }
}
