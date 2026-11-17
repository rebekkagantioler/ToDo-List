import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {WichtelGiftCard} from '../src/WichtelGiftCard';
const defaults={result:null,missing:false,busy:false,error:'',onReveal:()=>{}};
test('the public gift starts closed, has no login and reveals no names in previews',()=>{
 const html=renderToStaticMarkup(createElement(WichtelGiftCard,defaults));
 assert.match(html,/Mein Los öffnen/);assert.doesNotMatch(html,/Anmelden|Passwort|wichtel-recipient|Kurse|Zeiterfassung/);
});
test('an opened gift renders only the supplied giver and recipient and escapes names',()=>{
 const html=renderToStaticMarkup(createElement(WichtelGiftCard,{...defaults,result:{title:'Weihnachten 2026',giver:'Anna',recipient:'<img src=x onerror=alert(1)>'}}));
 assert.match(html,/Anna, dein Los ist da!/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|Mein Los öffnen/);
});
test('deleted or invalid links show a clear message without offering a login or leaking a gift',()=>{
 const html=renderToStaticMarkup(createElement(WichtelGiftCard,{...defaults,missing:true}));
 assert.match(html,/Dieser Link ist nicht mehr gültig/);assert.doesNotMatch(html,/Passwort|Mein Los öffnen|wichtel-recipient/);
});
