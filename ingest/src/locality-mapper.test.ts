import test from 'node:test';
import assert from 'node:assert/strict';
import { mapLocality } from './locality-mapper.js';

test('maps a locality with lat/lon and localityNo', () => {
  const locality = mapLocality({
    localityNo: 12345,
    name: 'Testlokalitet',
    lat: 60.5,
    lon: 5.25,
  });
  assert.ok(locality);
  assert.equal(locality.localityNo, 12345);
  assert.equal(locality.name, 'Testlokalitet');
  assert.equal(locality.latitude, 60.5);
  assert.equal(locality.longitude, 5.25);
});

test('accepts latitude/longitude and localityNumber field variants', () => {
  const locality = mapLocality({
    localityNumber: 999,
    localityName: 'Variant',
    latitude: 61,
    longitude: 6,
  });
  assert.ok(locality);
  assert.equal(locality.localityNo, 999);
  assert.equal(locality.name, 'Variant');
});

test('trims the name', () => {
  const locality = mapLocality({ localityNo: 1, name: '  Anlegg  ', lat: 60, lon: 5 });
  assert.equal(locality?.name, 'Anlegg');
});

test('rejects a row without a locality number', () => {
  assert.equal(mapLocality({ name: 'X', lat: 60, lon: 5 }), null);
});

test('rejects a row without a name', () => {
  assert.equal(mapLocality({ localityNo: 1, lat: 60, lon: 5 }), null);
});

test('rejects out-of-range coordinates', () => {
  assert.equal(mapLocality({ localityNo: 1, name: 'X', lat: 91, lon: 5 }), null);
  assert.equal(mapLocality({ localityNo: 1, name: 'X', lat: 60, lon: 181 }), null);
});

test('rejects non-object input', () => {
  assert.equal(mapLocality(null), null);
  assert.equal(mapLocality('nope'), null);
});
