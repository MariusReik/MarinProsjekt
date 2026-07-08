// Maps one raw stream message (combined Full/Json model) to domain objects.
// Written against the real payload observed 2026-07-07, e.g.:
// {"mmsi":257114560,"msgtime":"2026-07-07T14:44:43+00:00","latitude":62.59689,
//  "longitude":6.179337,"speedOverGround":0.1,"courseOverGround":null,
//  "trueHeading":322,"rateOfTurn":null,"navigationalStatus":0,
//  "name":"FROEY AEGIR","shipType":34,...}
// Nulls are common and pass through; structurally invalid messages return null.

export interface AisPosition {
  mmsi: number;
  msgtime: Date;
  latitude: number;
  longitude: number;
  sog: number | null;
  cog: number | null;
  trueHeading: number | null;
  rateOfTurn: number | null;
  navStatus: number | null;
}

export interface VesselInfo {
  mmsi: number;
  name: string | null;
  shipType: number | null;
  lastSeen: Date;
}

export interface MappedMessage {
  position: AisPosition;
  vessel: VesselInfo;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapMessage(raw: unknown): MappedMessage | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const msg = raw as Record<string, unknown>;

  const mmsi = Number(msg.mmsi);
  if (!Number.isInteger(mmsi) || mmsi <= 0) {
    return null;
  }

  const msgtime = new Date(String(msg.msgtime ?? ''));
  if (Number.isNaN(msgtime.getTime())) {
    return null;
  }

  const latitude = Number(msg.latitude);
  const longitude = Number(msg.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return null;
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return null;
  }

  const name = typeof msg.name === 'string' && msg.name.trim().length > 0 ? msg.name.trim() : null;

  return {
    position: {
      mmsi,
      msgtime,
      latitude,
      longitude,
      sog: toNumberOrNull(msg.speedOverGround),
      cog: toNumberOrNull(msg.courseOverGround),
      trueHeading: toNumberOrNull(msg.trueHeading),
      rateOfTurn: toNumberOrNull(msg.rateOfTurn),
      navStatus: toNumberOrNull(msg.navigationalStatus),
    },
    vessel: {
      mmsi,
      name,
      shipType: toNumberOrNull(msg.shipType),
      lastSeen: msgtime,
    },
  };
}
