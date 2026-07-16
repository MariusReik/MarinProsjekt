package no.marinplattform.api.anomaly;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Tunables for gap alerting, bound from {@code app.alerting.*} (issue #15).
 *
 * <p>The check interval ({@code check-interval-ms}) is resolved directly in
 * {@link GapAlertService}'s {@code @Scheduled} annotation, which needs a
 * placeholder string at parse time, so it is not modelled here.
 *
 * @param webhookUrl where gap alerts are POSTed; blank disables alerting (the
 *                   default, so a fresh environment stays silent until a URL is
 *                   configured)
 * @param batchLimit max gaps delivered per cycle, bounding a burst if many gaps
 *                   accumulate (default 50)
 */
@ConfigurationProperties(prefix = "app.alerting")
public record GapAlertProperties(
    @DefaultValue("") String webhookUrl,
    @DefaultValue("50") int batchLimit
) {
    /** Alerting only runs when a delivery target is configured. */
    public boolean enabled() {
        return webhookUrl != null && !webhookUrl.isBlank();
    }
}
