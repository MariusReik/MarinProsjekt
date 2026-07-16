package no.marinplattform.api.anomaly;

/**
 * Delivers a single gap alert over some channel (issue #15). A webhook
 * implementation ships first ({@link WebhookGapAlertNotifier}); an email
 * variant is a planned follow-up, hence the interface.
 *
 * <p>Implementations signal a failed delivery by throwing — {@link
 * GapAlertService} catches it, leaves the gap unmarked, and retries next cycle.
 */
public interface GapAlertNotifier {

    /**
     * Send an alert for the given gap.
     *
     * @throws RuntimeException if delivery fails (non-2xx response, timeout, …)
     */
    void send(GapEvent gap);
}
