package no.marinplattform.api.anomaly;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Plain Mockito unit tests for the alerting cycle (issue #15) — no Spring
 * context, no HTTP. The repository queries are covered against real Postgres in
 * {@link GapAlertingIntegrationTest}; here we pin the delivery orchestration:
 * disabled when unconfigured, marks on success, and a single failure neither
 * marks the gap nor stops the batch.
 */
class GapAlertServiceTest {

    private final GapEventRepository repository = mock(GapEventRepository.class);
    private final GapAlertNotifier notifier = mock(GapAlertNotifier.class);

    private GapAlertService serviceWith(GapAlertProperties properties) {
        return new GapAlertService(repository, notifier, properties);
    }

    private static GapEvent gap(int mmsi) {
        return new GapEvent(
            mmsi, 100,
            Instant.parse("2026-07-16T10:00:00Z"),
            60.40, 5.32, 250.0,
            Instant.parse("2026-07-16T10:35:00Z")
        );
    }

    @Test
    void deliversPendingGapsAndMarksThemAlerted() {
        GapAlertProperties props = new GapAlertProperties("https://hook.example/gap", 50);
        GapEvent a = gap(1);
        GapEvent b = gap(2);
        when(repository.findUnalerted(50)).thenReturn(List.of(a, b));

        serviceWith(props).deliverPendingAlerts();

        verify(notifier).send(a);
        verify(notifier).send(b);
        verify(repository).markAlerted(1, 100, a.lastSeenAt());
        verify(repository).markAlerted(2, 100, b.lastSeenAt());
    }

    @Test
    void doesNothingWhenNoWebhookConfigured() {
        GapAlertProperties disabled = new GapAlertProperties("", 50);

        serviceWith(disabled).deliverPendingAlerts();

        verifyNoInteractions(repository, notifier);
    }

    @Test
    void failedDeliveryIsNotMarkedAndDoesNotStopTheBatch() {
        GapAlertProperties props = new GapAlertProperties("https://hook.example/gap", 50);
        GapEvent bad = gap(1);
        GapEvent good = gap(2);
        when(repository.findUnalerted(50)).thenReturn(List.of(bad, good));
        doThrow(new RuntimeException("503 from webhook")).when(notifier).send(bad);

        serviceWith(props).deliverPendingAlerts(); // must not throw

        // The failed gap stays unmarked (retried next cycle)...
        verify(repository, never()).markAlerted(eq(1), anyInt(), any());
        // ...and the batch continues to the next gap.
        verify(notifier).send(good);
        verify(repository).markAlerted(2, 100, good.lastSeenAt());
    }
}
