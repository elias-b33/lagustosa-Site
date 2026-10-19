import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingGuestCount, validateBooking } from '../public/domain.js';
import { BOOKING_RECIPIENT, BOOKING_ENDPOINT, prepareBooking, sendBooking } from '../public/booking.js';

const now = new Date('2026-10-19T12:00:00Z');
const values = { date: '2026-10-20', time: '18:00', guests: '2', name: 'Testgäst', phone: '0700000000', email: 'test@example.com', message: '' };
const pageUrl = 'https://lagustosasite.vercel.app/?tracking=private#kontakt';

test('Regular and group requests address Ayush and preserve exact guest counts', () => {
  for (const count of [1, 2, 10, 11, 30, 60]) {
    const input = { ...values, guests: count > 10 ? 'group' : String(count), groupSize: String(count), occasion: 'Företagsmiddag', flexibleTime: 'ja' };
    assert.equal(validateBooking(input, now), '');
    assert.equal(bookingGuestCount(input), count);
    const request = prepareBooking(input);
    const mail = new URL(request.mailto);
    assert.equal(mail.pathname, 'ayush.giri2006@gmail.com');
    assert.equal(mail.pathname, BOOKING_RECIPIENT);
    assert.equal(request.payload['Antal gäster'], String(count));
    assert.equal(request.isGroup, count > 10);
    assert.match(mail.searchParams.get('body'), new RegExp(count + ' gäst'));
    if (count > 10) {
      assert.match(request.subject, /^Gruppförfrågan/);
      assert.equal(request.payload['Flexibel tid'], 'Ja');
      assert.match(request.summary, /Företagsmiddag/);
      assert.match(mail.searchParams.get('body'), /besked om plats, meny och upplägg/);
    } else {
      assert.equal(request.payload.Tillfälle, undefined);
      assert.equal(request.payload['Flexibel tid'], undefined);
      assert.doesNotMatch(request.summary, /Företagsmiddag/);
    }
  }
});

test('Group size rejects blank, fractional, negative and misleading guest values', () => {
  for (const groupSize of ['', '0', '-30', '10', '30.5', '1e2', '60 personer', '1000']) {
    assert.notEqual(validateBooking({ ...values, guests: 'group', groupSize }, now), '');
  }
  assert.notEqual(validateBooking({ ...values, guests: 'Fler än 10' }, now), '');
  assert.notEqual(validateBooking({ ...values, date: '2026-11-31' }, now), '');
});

test('Confirmed provider acceptance sends one structured request with a reply address', async () => {
  let calls = 0;
  const result = await sendBooking({ ...values, guests: 'group', groupSize: '60', message: '<test> & middag' }, { pageUrl, now, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, BOOKING_ENDPOINT);
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'omit');
    const body = JSON.parse(options.body);
    assert.equal(body._replyto, values.email);
    assert.equal(body.email, values.email);
    assert.equal(body._url, 'https://lagustosasite.vercel.app/');
    assert.equal(body['Antal gäster'], '60');
    assert.equal(body.Önskemål, '<test> & middag');
    assert.match(body._subject, /^Gruppförfrågan – 60 personer/);
    return Response.json({ success: 'true', message: 'Success' });
  } });
  assert.deepEqual(result, { status: 'sent' });
  assert.equal(calls, 1);
});

test('Missing activation and provider rejection never report a sent booking', async () => {
  for (const reply of [{ success: 'false', message: 'This form needs Activation.' }, { success: false }, { message: 'Unrecognized response' }]) {
    const result = await sendBooking(values, { pageUrl, now, fetchImpl: async () => Response.json(reply) });
    assert.equal(result.status, 'failed');
    assert.match(result.message, /e-postlänken/);
    assert.doesNotMatch(result.message, /Activation/);
  }
});

test('Network errors and invalid responses are ambiguous and never retried automatically', async () => {
  for (const fail of [() => { throw new Error('timeout'); }, () => new Response('error', { status: 503 }), () => new Response('not JSON')]) {
    let calls = 0;
    const result = await sendBooking(values, { pageUrl, now, fetchImpl: async () => { calls++; return fail(); } });
    assert.equal(result.status, 'uncertain');
    assert.equal(calls, 1);
    assert.match(result.message, /innan du skickar igen/);
  }
});

test('Invalid requests, honeypots and offline copies never contact the email service', async () => {
  let calls = 0;
  const options = { pageUrl, now, fetchImpl: async () => { calls++; throw new Error('Must not send'); } };
  assert.equal((await sendBooking({ ...values, guests: 'group', groupSize: '' }, options)).status, 'invalid');
  assert.equal((await sendBooking({ ...values, website: 'spam' }, options)).status, 'failed');
  assert.equal((await sendBooking(values, { ...options, pageUrl: 'file:///STARTA-HAR.html' })).status, 'failed');
  assert.equal(calls, 0);
});
