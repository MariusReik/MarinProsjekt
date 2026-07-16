// 1. fetches token on first call, returns access_token
// 2. second call within expiry -> cached, fetch called exactly once
// 3. call after expiry (fake timers or short expires_in) -> refetches
// 4. 500 twice then 200 -> succeeds after retries
// 5. 401 -> throws immediately, no retry
// 6. two concurrent calls -> only one fetch