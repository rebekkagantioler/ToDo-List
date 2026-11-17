import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {WichtelGiftCard} from '../src/WichtelGiftCard';
import {WichtelRoundLinks} from '../src/WichtelRoundLinks';
const defaults={result:null,missing:false,busy:false,error:'',onReveal:()=>{}};
test('the public gift starts closed, has no login and reveals no names in previews',()=>{
 const html=renderToStaticMarkup(createElement(WichtelGiftCard,defaults));
 assert.match(html,/Mein Los öffnen/);assert.doesNotMatch(html,/Anmelden|Passwort|wichtel-recipient|Kurse|Zeiterfassung/);
});
test('an opened gift renders only the supplied giver and recipient and escapes names',()=>{
 const html=renderToStaticMarkup(createElement(WichtelGiftCard,{...defaults,result:{title:'Weihnachten 2026',giver:'Anna',recipient:'<img src=x onerror=alert(1)>'}}));
 assert.match(html,/Persönliches Engila-Bengila-Los für Anna/);assert.match(html,/Du hast/);assert.match(html,/gezogen!/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|Mein Los öffnen/);
});
test('deleted or invalid links show a clear message without offering a login or leaking a gift',()=>{
 const html=renderToStaticMarkup(createElement(WichtelGiftCard,{...defaults,missing:true}));
 assert.match(html,/Dieser Link ist nicht mehr gültig/);assert.doesNotMatch(html,/Passwort|Mein Los öffnen|wichtel-recipient/);
});

test('Engila Bengila keeps the recipient as dynamic text and supports long names',()=>{
 for(const name of ['Clara','Markus','Anna Maria mit einem besonders langen Familiennamen']){
  const html=renderToStaticMarkup(createElement(WichtelGiftCard,{...defaults,result:{title:'Familie',giver:'Rebekka',recipient:name}}));
  assert.match(html,/Engila Bengila/);assert.ok(html.includes(name));assert.match(html,/Psst! Behalte es für dich!/);
 }
});
test('the organizer can copy a link for each person without rendering or automatically opening their assignments',()=>{
 const round:any={id:'round',title:'Engila Bengila',created_at:'2026-11-17',people:[{id:'own',name:'Rebekka',token:'ab'.repeat(32),recipient:'SECRET_RECIPIENT_ONE'},{id:'other',name:'Anna',token:'cd'.repeat(32),recipient:'SECRET_RECIPIENT_TWO'}]};
 let copied=false;
 const html=renderToStaticMarkup(createElement(WichtelRoundLinks,{round,base:'https://example.test/ToDo-List/',copied:'',onCopy:()=>{copied=true}}));
 assert.match(html,/Rebekka/);assert.match(html,/Anna/);assert.equal((html.match(/Kopieren<\/span>/g)||[]).length,2);
 assert.doesNotMatch(html,/SECRET_RECIPIENT|<a\s|Mein Los öffnen/);assert.match(html,/#engila=/);assert.equal(copied,false);
});
