import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhone, parseContactPhone} from '../public/phone.js';
import {validateBooking} from '../public/domain.js';
import {prepareBooking} from '../public/booking.js';

test('Swedish local, international and pasted numbers normalize to the same E.164 value',()=>{
  for (const value of ['0701234567','701234567','070-123 45 67','+46 70 123 45 67','0046 70 123 45 67','+46 (0)70 123 45 67']) {
    assert.equal(normalizePhone(value),'+46701234567',value);
  }
  assert.equal(normalizePhone('08-123 456 78'),'+46812345678');
});
test('International numbers use their own numbering plan and preserve significant zeros',()=>{
  assert.equal(normalizePhone('07400 123456','GB'),'+447400123456');
  assert.equal(normalizePhone('+1 202-555-0123'),'+12025550123');
  assert.equal(normalizePhone('06 6982','IT'),'+39066982');
  assert.equal(normalizePhone('0412 345 678','AU'),'+61412345678');
  assert.equal(normalizePhone('+358 40 1234567'),'+358401234567');
  assert.equal(parseContactPhone('+44 7400 123456','SE')?.country,'GB');
});
test('Text, extensions, short numbers, invalid prefixes and oversized numbers are rejected',()=>{
  for (const value of ['',null,12345,'hej','ring 0701234567','0701234567abc','+46701234567 ext 12','++46701234567','+999123456789','12345','070123','0000000000','+461234567890123456','+11234567890']) {
    assert.equal(normalizePhone(value),'',String(value));
  }
});
test('Booking validation and email summaries enforce the same canonical phone number',()=>{
  const values={name:'Test',email:'test@example.com',phone:'070-123 45 67',date:'2026-10-27',time:'18:00',guests:'2'};
  const now=new Date('2026-10-26T10:00:00Z');
  assert.equal(validateBooking(values,now),'');
  assert.match(validateBooking({...values,phone:'random'},now),/telefonnummer/);
  assert.equal(prepareBooking(values).payload.Telefon,'+46701234567');
});
