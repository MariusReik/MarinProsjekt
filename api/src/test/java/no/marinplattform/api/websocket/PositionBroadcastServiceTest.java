package no.marinplattform.api.websocket;

import no.marinplattform.api.vessel.PositionDto;
import no.marinplattform.api.vessel.VesselRepository;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Plain Mockito unit tests — no Spring context needed, keeps this fast.
 * Wiring of the STOMP endpoint/broker itself is covered indirectly by
 * ApiApplicationTests (a misconfigured WebSocketConfig fails context load).
 */
class PositionBroadcastServiceTest {

    private final VesselRepository repository = mock(VesselRepository.class);
    private final SimpMessagingTemplate messagingTemplate = mock(SimpMessagingTemplate.class);
    private final PositionBroadcastService service = new PositionBroadcastService(repository, messagingTemplate);

    @Test
    void broadcastsNewPositionsAndAdvancesWatermarkToLatestMsgtime() {
        PositionDto older = new PositionDto(257123456, Instant.parse("2026-07-11T10:00:00Z"), 60.39, 5.32, 8.5f, 90f);
        PositionDto newer = new PositionDto(257123456, Instant.parse("2026-07-11T10:00:02Z"), 60.40, 5.33, 8.6f, 91f);
        when(repository.findPositionsSince(any())).thenReturn(List.of(older, newer));

        service.broadcastNewPositions();

        verify(messagingTemplate).convertAndSend(eq(PositionBroadcastService.POSITIONS_TOPIC), eq(List.of(older, newer)));

        // Next poll must use the new watermark (max msgtime just seen), not
        // the original construction-time value.
        when(repository.findPositionsSince(any())).thenReturn(List.of());
        service.broadcastNewPositions();
        verify(repository).findPositionsSince(Instant.parse("2026-07-11T10:00:02Z"));
    }

    @Test
    void doesNotSendWhenThereAreNoNewPositions() {
        when(repository.findPositionsSince(any())).thenReturn(List.of());

        service.broadcastNewPositions();

        verifyNoInteractions(messagingTemplate);
    }

    @Test
    void swallowsRepositoryFailuresSoSchedulingIsNotCancelled() {
        when(repository.findPositionsSince(any())).thenThrow(new RuntimeException("db hiccup"));

        service.broadcastNewPositions(); // must not throw

        verifyNoInteractions(messagingTemplate);
    }
}
