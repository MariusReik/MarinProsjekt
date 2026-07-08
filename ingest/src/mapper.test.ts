import test from 'node:test';
import assert from 'node:assert/strict';
import { mapMessage } from './mapper.js';

// Verbatim line captured from the live stream 2026-07-07.
const realMessage = JSON.parse(
  '{"mmsi":257114560,"msgtime":"2026-07-07T14:44:43+00:00","altitude":null,' +
    '"courseOverGround":null,"latitude":62.59689,"longitude":6.179337,' +
    '"navigationalStatus":0,"rateOfTurn":null,"speedOverGround":0.1,' +
    '"trueHeading":322,"imoNumber":null,"callSign":"LH4149","name":"FROEY AEGIR",' +
    '"destination":null,"eta":null,"draught":null,"shipLength":13,"shipWidth":4,' +
    '"shipType":34,"dimensionA":8,"dimensionB":5,"dimensionC":2,"dimensionD":2,' +
    '"positionFixingDeviceType":15,"reportClass":"B",' +
    '"msgtimeStatic":"2026-07-07T14:43:34+00:00","stream":"terra"}',
);

test('maps a real stream message', () => {
  const mapped = mapMessage(realMessage);
  assert.ok(mapped);
  assert.equal(mapped.position.mmsi, 257114560);
  assert.equal(mapped.position.latitude, 62.59689);
  assert.equal(mapped.position.sog, 0.1);
  assert.equal(mapped.position.cog, null); // null passes through
  assert.equal(mapped.position.rateOfTurn, null);
  assert.equal(mapped.position.msgtime.toISOString(), '2026-07-07T14:44:43.000Z');
  assert.equal(mapped.vessel.name, 'FROEY AEGIR');
  assert.equal(mapped.vessel.shipType, 34);
});

test('rejects message without mmsi', () => {
  assert.equal(mapMessage({ msgtime: '2026-07-07T14:44:43+00:00', latitude: 60, longitude: 5 }), null);
});

test('rejects message with invalid msgtime', () => {
  assert.equal(mapMessage({ mmsi: 1, msgtime: 'not-a-date', latitude: 60, longitude: 5 }), null);
});

test('rejects out-of-range coordinates', () => {
  assert.equal(mapMessage({ mmsi: 1, msgtime: '2026-07-07T14:44:43+00:00', latitude: 91, longitude: 5 }), null);
  assert.equal(mapMessage({ mmsi: 1, msgtime: '2026-07-07T14:44:43+00:00', latitude: 60, longitude: 181 }), null);
});

test('rejects non-object input', () => {
  assert.equal(mapMessage(null), null);
  assert.equal(mapMessage('string'), null);
  assert.equal(mapMessage(42), null);
});

test('maps missing name to null', () => {
  const mapped = mapMessage({ mmsi: 1, msgtime: '2026-07-07T14:44:43+00:00', latitude: 60, longitude: 5, name: '  ' });
  assert.ok(mapped);
  assert.equal(mapped.vessel.name, null);
});
