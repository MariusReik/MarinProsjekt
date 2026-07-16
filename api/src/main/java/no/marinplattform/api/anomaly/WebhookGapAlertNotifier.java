package no.marinplattform.api.anomaly;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Delivers a gap alert as a JSON HTTP POST to the configured webhook URL
 * (issue #15). Uses Spring's {@link RestClient} (no extra dependency): a
 * non-2xx response throws {@code RestClientResponseException} by default, which
 * {@link GapAlertService} treats as a failed delivery and retries.
 *
 * <p>The URL is read per-send from {@link GapAlertProperties} rather than baked
 * into a base URL, so it can change via config without rebuilding the client,
 * and the service only calls this when a URL is actually configured.
 */
@Component
public class WebhookGapAlertNotifier implements GapAlertNotifier {

    private final RestClient restClient;
    private final GapAlertProperties properties;

    public WebhookGapAlertNotifier(GapAlertProperties properties, RestClient.Builder builder) {
        this.properties = properties;
        this.restClient = builder.build();
    }

    @Override
    public void send(GapEvent gap) {
        restClient.post()
            .uri(properties.webhookUrl())
            .contentType(MediaType.APPLICATION_JSON)
            .body(GapAlertPayload.from(gap))
            .retrieve()
            .toBodilessEntity();
    }
}
