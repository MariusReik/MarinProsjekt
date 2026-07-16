package no.marinplattform.api.anomaly;

import org.junit.jupiter.api.Test;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Plain Mockito unit tests — no Spring context, keeps this fast. The detection
 * rule itself is exercised against real PostGIS in
 * {@link GapEventRepositoryIntegrationTest}; here we only pin down the
 * scheduling boundary: config is passed through, and a repository failure is
 * swallowed so the schedule is not cancelled.
 */
class GapDetectionServiceTest {

    private final GapEventRepository repository = mock(GapEventRepository.class);
    private final GapDetectionProperties properties = new GapDetectionProperties(30, 12, 1000);
    private final GapDetectionService service = new GapDetectionService(repository, properties);

    @Test
    void passesConfiguredThresholdsToTheRepository() {
        when(repository.detectAndStoreGaps(30, 12, 1000)).thenReturn(2);

        service.detectGaps();

        verify(repository).detectAndStoreGaps(eq(30), eq(12), eq(1000.0));
    }

    @Test
    void swallowsRepositoryFailuresSoSchedulingIsNotCancelled() {
        when(repository.detectAndStoreGaps(30, 12, 1000)).thenThrow(new RuntimeException("db hiccup"));

        service.detectGaps(); // must not throw
    }
}
