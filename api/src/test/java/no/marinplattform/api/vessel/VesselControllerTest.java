package no.marinplattform.api.vessel;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller-level tests with the repository mocked out — no database
 * required. DB-backed behaviour is covered by VesselRepositoryIT.
 */
@WebMvcTest(VesselController.class)
class VesselControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private VesselRepository repository;

    @Test
    void listsVessels() throws Exception {
        when(repository.findAllVessels()).thenReturn(List.of(
            new VesselDto(257123456, "MS Testvik", (short) 70, Instant.parse("2026-07-09T10:00:00Z"))
        ));

        mockMvc.perform(get("/api/vessels"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].mmsi").value(257123456))
            .andExpect(jsonPath("$[0].name").value("MS Testvik"));
    }

    @Test
    void trackRejectsFromAfterTo() throws Exception {
        mockMvc.perform(get("/api/vessels/257123456/track")
                .param("from", "2026-07-09T12:00:00Z")
                .param("to", "2026-07-09T10:00:00Z"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void trackRejectsNonNumericMmsi() throws Exception {
        mockMvc.perform(get("/api/vessels/not-a-number/track"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void latestClampsLookbackToConfiguredMax() throws Exception {
        when(repository.findLatestPositions(any())).thenReturn(List.of());

        // 999 minutes is above MAX_LATEST_LOOKBACK_MINUTES (60); the
        // controller should clamp rather than reject.
        mockMvc.perform(get("/api/positions/latest").param("sinceMinutes", "999"))
            .andExpect(status().isOk());
    }
}
