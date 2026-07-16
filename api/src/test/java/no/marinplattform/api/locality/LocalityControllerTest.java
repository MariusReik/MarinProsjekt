package no.marinplattform.api.locality;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller-level tests with the repository mocked — no database. The real
 * PostGIS query is covered by LocalityRepositoryIntegrationTest.
 */
@WebMvcTest(LocalityController.class)
class LocalityControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private LocalityRepository repository;

    @Test
    void listsLocalities() throws Exception {
        when(repository.findAllLocalities()).thenReturn(List.of(
            new LocalityDto(12345, "Testlokalitet", 60.5, 5.25)
        ));

        mockMvc.perform(get("/api/localities"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].localityNo").value(12345))
            .andExpect(jsonPath("$[0].name").value("Testlokalitet"));
    }

    @Test
    void nearbyReturnsVesselsForKnownLocality() throws Exception {
        when(repository.localityExists(12345)).thenReturn(true);
        when(repository.findVesselsNearLocality(eq(12345), anyDouble(), any(), any())).thenReturn(List.of(
            new NearbyVesselDto(257123456, "MS Testvik", (short) 70, 42,
                Instant.parse("2026-07-10T08:00:00Z"), Instant.parse("2026-07-12T18:00:00Z"), 312.5)
        ));

        mockMvc.perform(get("/api/localities/12345/vessels"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].mmsi").value(257123456))
            .andExpect(jsonPath("$[0].positionCount").value(42))
            .andExpect(jsonPath("$[0].minDistanceMeters").value(312.5));
    }

    @Test
    void nearbyReturns404ForUnknownLocality() throws Exception {
        when(repository.localityExists(999999)).thenReturn(false);

        mockMvc.perform(get("/api/localities/999999/vessels"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void nearbyClampsRadiusAndWindowToBounds() throws Exception {
        when(repository.localityExists(12345)).thenReturn(true);
        when(repository.findVesselsNearLocality(anyInt(), anyDouble(), any(), any())).thenReturn(List.of());

        mockMvc.perform(get("/api/localities/12345/vessels")
                .param("radiusMeters", "9999999")
                .param("hours", "100000"))
            .andExpect(status().isOk());

        // Radius clamped to 50 000 m, window to 720 h (30 days).
        verify(repository).findVesselsNearLocality(eq(12345), eq(50_000.0), any(), any());
    }

    @Test
    void nearbyRejectsNonNumericLocality() throws Exception {
        mockMvc.perform(get("/api/localities/not-a-number/vessels"))
            .andExpect(status().isBadRequest());
    }
}
