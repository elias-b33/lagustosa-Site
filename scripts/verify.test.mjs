import test from 'node:test';
import assert from 'node:assert/strict';
import { menuData } from '../public/menu-data.js';
import { bookingTimes, validateBooking, stockholmDate, localAnswer } from '../public/domain.js';
import { handleAssistant } from '../lib/restaurant-assistant.mjs';
import { getDailyLunch, renderDailyLunch } from '../public/daily-lunch.js';
import { getDetailMenu } from '../public/menu-content.js';

const now = new Date('2026-10-18T10:00:00Z');
test('The complete imported menu has unique IDs and numeric prices', () => {
  assert.equal(menuData.items.length,45);
  assert.equal(new Set(menuData.items.map(item=>item.id)).size,45);
  assert(menuData.items.every(item=>Number.isInteger(item.price)&&item.price>0&&menuData.categories.some(c=>c.id===item.category)));
});
test('Bookings respect Stockholm midnight, Monday closure and lead time', () => {
  assert.equal(stockholmDate(new Date('2026-10-18T22:30:00Z')),'2026-10-19');
  assert.deepEqual(bookingTimes('2026-10-19',now),[]);
  assert.deepEqual(bookingTimes('2026-10-17',now),[]);
  assert.equal(bookingTimes('2026-10-18',now)[0],'13:00');
  assert.equal(bookingTimes('2026-10-20',now)[0],'11:30');
});

test('Lunch selects the original dishes for each service day without changing the text', () => {
  for (const [date, day, firstDish] of [
    ['2026-10-20', 'Tisdag', 'Linguine con Bolognese'],
    ['2026-10-21', 'Onsdag', 'Pasta Salmone'],
    ['2026-10-22', 'Torsdag', 'Pasta alla Amatriciana'],
    ['2026-10-23', 'Fredag', 'Pasta Carbonara'],
  ]) {
    const instant = new Date(`${date}T10:00:00Z`);
    const lunch = getDailyLunch(instant);
    assert.equal(lunch.kind, 'weekday');
    assert.equal(lunch.serviceDate, date);
    assert.equal(lunch.notice, '');
    assert.match(lunch.heading, /^Idag,/);
    assert.equal(lunch.dishes.length, 5);
    assert(lunch.dishes[0].startsWith(firstDish));
    assert.deepEqual(lunch.dishes, getDetailMenu('lunch').sections.find(section => section.title === day).paragraphs);
    assert(renderDailyLunch(instant).includes(firstDish));
  }
});

test('Closed Mondays show the next lunch and weekends select shoppinglunch', () => {
  const monday = getDailyLunch(new Date('2026-10-19T12:00:00Z'));
  assert.match(monday.notice, /stängt/);
  assert.match(monday.heading, /^Nästa lunch, tisdag 20 oktober/);
  assert.equal(monday.serviceDate, '2026-10-20');
  for (const date of ['2026-10-24', '2026-10-25']) {
    const weekend = getDailyLunch(new Date(`${date}T12:00:00Z`));
    assert.equal(weekend.kind, 'weekend');
    assert.equal(weekend.serviceDate, '2026-10-27');
    assert.match(weekend.notice, /shoppinglunch/);
    assert.doesNotMatch(weekend.heading, /^Idag/);
  }
});

test('Lunch switches at Stockholm midnight across both daylight-saving offsets', () => {
  for (const [before, after, expectedDate, expectedFirst] of [
    ['2026-10-20T21:59:59Z', '2026-10-20T22:00:00Z', '2026-10-21', 'Pasta Salmone'],
    ['2026-10-27T22:59:59Z', '2026-10-27T23:00:00Z', '2026-10-28', 'Pasta Salmone'],
  ]) {
    assert.notEqual(getDailyLunch(new Date(before)).date, expectedDate);
    const lunch = getDailyLunch(new Date(after));
    assert.equal(lunch.date, expectedDate);
    assert(lunch.dishes[0].startsWith(expectedFirst));
  }
  assert.equal(getDailyLunch(new Date('2026-10-23T22:00:00Z')).kind, 'weekend');
  assert.match(getDailyLunch(new Date('2026-10-25T23:00:00Z')).notice, /stängt/);
  assert.match(getDailyLunch(new Date('2026-03-29T22:00:00Z')).notice, /stängt/);
});
test('Booking review cannot accept closed dates or unavailable request slots', () => {
  const values={date:'2026-10-20',time:'18:00',guests:'2',name:'Testgäst',phone:'0700000000',email:'test@example.com'};
  assert.equal(validateBooking(values,now),'');
  assert.match(validateBooking({...values,date:'2026-10-19'},now),/måndagar/);
  assert.match(validateBooking({...values,time:'03:00'},now),/tiderna/);
  assert.match(validateBooking({...values,date:'2027-10-20'},now),/sex månader/);
});
test('Local guide filters actual prices and never certifies allergy safety', () => {
  const answer=localAnswer('Pizza under 190 kr').text;
  assert.match(answer,/189 kr/); assert.doesNotMatch(answer,/195 kr/);
  assert.match(localAnswer('Är pizzan glutenfri?').text,/kan inte bekräfta/);
  assert.match(localAnswer('Finns det ett ledigt bord?').text,/inte tillgång/);
  assert.match(localAnswer('När har ni lunch?').text,/Tisdag–fredag/);
});
const url='https://restaurant.test/api/assistant';
const request=(question,origin='https://restaurant.test')=>new Request(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({question})});
const env={AI_ENABLED:'true',OPENAI_API_KEY:'test-only-placeholder',OPENAI_MODEL:'configured-model'};
test('AI configuration discloses only endpoint availability and stays disabled without credentials',async()=>{
  const response=await handleAssistant(new Request('https://restaurant.test/site-config.json'),{});
  assert.deepEqual(await response.json(),{assistantApi:null});
  assert.equal((await handleAssistant(request('Hej'),{})).status,503);
});
test('AI rejects requests from other origins and oversized input',async()=>{
  assert.equal((await handleAssistant(request('Hej','https://another.test'),env)).status,403);
  assert.equal((await handleAssistant(request('x'.repeat(701)),env)).status,400);
  assert.equal((await handleAssistant(request('x'.repeat(5000)),env)).status,400);
});
test('Allergen question is answered safely without calling the AI provider',async()=>{
  const response=await handleAssistant(request('Jag har nötallergi, vad är säkert?'),env,()=>{throw new Error('Provider must not be called');});
  assert.equal(response.status,200); assert.match((await response.json()).text,/kan inte bekräfta/);
});
test('AI adapter uses server credentials, grounded context and no response storage',async()=>{
  const response=await handleAssistant(request('Vilka pizzor finns?'),env,async(endpoint,options)=>{
    assert.equal(endpoint,'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization,'Bearer test-only-placeholder');
    const payload=JSON.parse(options.body); assert.equal(payload.store,false); assert.equal(payload.model,'configured-model');
    assert.match(payload.instructions,/REGINA MARGHERITA/); assert.equal(payload.input,'Vilka pizzor finns?');
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Regina margherita kostar 145 kr.'}]}]});
  });
  assert.equal(response.status,200); assert.equal((await response.json()).text,'Regina margherita kostar 145 kr.');
});
test('Provider failures do not leak error details or report invented answers',async()=>{
  const response=await handleAssistant(request('Pasta?'),env,async()=>new Response('secret upstream information',{status:401}));
  assert.equal(response.status,502); assert.doesNotMatch(await response.text(),/secret|placeholder/);
});
