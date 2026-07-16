-- Forward migration: alerting state for gap_events (week 6, gap alerting #15).
--
-- A gap is alerted at most once. `alerted_at` NULL means "not yet delivered";
-- the alerting job (GapAlertService) claims rows WHERE alerted_at IS NULL,
-- sends the webhook, then stamps alerted_at. A failed delivery leaves it NULL
-- so the next cycle retries — the column is the dedup + delivery marker.
ALTER TABLE gap_events
    ADD COLUMN alerted_at TIMESTAMPTZ;

-- Partial index: the alerting job only ever scans the not-yet-alerted rows,
-- which is a small, shrinking set even as gap_events grows.
CREATE INDEX idx_gap_events_unalerted
    ON gap_events (detected_at)
    WHERE alerted_at IS NULL;
