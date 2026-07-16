package no.marinplattform.api.anomaly;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Tunables for the AIS gap-detection rule, bound from {@code app.anomaly.*}.
 *
 * <p>The scheduling interval itself ({@code gap-check-interval-ms}) is not here:
 * it is resolved directly in {@link GapDetectionService}'s {@code @Scheduled}
 * annotation, which needs a placeholder string at parse time.
 *
 * @param gapThresholdMinutes how long a vessel must be silent before its
 *                            disappearance counts as a gap (default 30 min)
 * @param lookbackHours       only vessels last seen near a locality within this
 *                            window are considered — avoids alerting on ancient
 *                            history (default 12 h)
 * @param radiusMeters        proximity to a locality that makes a vessel
 *                            relevant (default 1000 m, per brief §25)
 */
@ConfigurationProperties(prefix = "app.anomaly")
public record GapDetectionProperties(
    @DefaultValue("30") int gapThresholdMinutes,
    @DefaultValue("12") int lookbackHours,
    @DefaultValue("1000") double radiusMeters
) {}
