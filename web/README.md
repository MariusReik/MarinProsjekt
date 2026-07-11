# web/ — Kart-dashboard (React + MapLibre GL)

Live fartøysposisjoner og historiske spor for Vestland, mot Spring Boot-API-et
(`api/`, issues #7/#8). Issue #9.

## Kjøre lokalt

Forutsetter at Postgres, ingest og API-et kjører (`infra/docker-compose.yml` +
`ingest` med `npm run dev`, se rot-README).

```bash
cd web
npm install
npm run dev
```

Åpne http://localhost:5173.

Vite dev-serveren proxyer `/api` og `/ws` til `http://localhost:8080`
(se `vite.config.ts`), så nettleseren snakker bare med én origin og API-et
trenger ingen CORS-konfig.

## Hva den gjør

- **Live fartøy:** henter et startsnapshot fra `GET /api/positions/latest`, og
  holder kartet oppdatert via STOMP-over-WebSocket på `/topic/positions`.
  Fartøy tegnes som et data-drevet MapLibre `circle`-lag for WebGL-ytelse.
- **Klikk for spor:** klikk på et fartøy henter siste 24 t fra
  `GET /api/vessels/{mmsi}/track` og tegner sporet som en linje. Panelet viser
  fart, kurs, posisjon og navn (`GET /api/vessels`).
- **Tilkoblingsstatus:** statuslinjen viser live/kobler til/frakoblet og antall
  fartøy. `@stomp/stompjs` reconnecter automatisk ved API-restart.

## Stack

Vite + React + TypeScript, `maplibre-gl`, `@stomp/stompjs`. Kartstil er
OSM-raster uten API-nøkkel (`src/map/mapStyle.ts`).

## Struktur

```
src/
  api/         types, REST-klient, STOMP-stream
  hooks/       useLivePositions (posisjonslager + stream)
  map/         MapView, kartstil, GeoJSON-hjelpere
  components/  StatusBar, VesselPanel
  config.ts    kartutsnitt (Vestland-boks), intervaller
```
