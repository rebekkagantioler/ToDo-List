import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {WorksheetScoreForm} from '../src/WorksheetScoreForm';
test('worksheet point correction edits only scores and never the sheet name, date or attendance',()=>{
 const html=renderToStaticMarkup(createElement(WorksheetScoreForm,{entry:{requirementId:'sheets',source:'task-3',label:'Blatt 3',amount:3,possible:4,date:'2026-11-02'},maximum:4,busy:false,error:'',onChange:()=>{},onClose:()=>{},onSave:()=>{}}));
 assert.match(html,/Blatt 3/);assert.equal((html.match(/type="radio"/g)||[]).length,5);assert.doesNotMatch(html,/type="date"/);assert.doesNotMatch(html,/Bezeichnung/);assert.doesNotMatch(html,/teilgenommen/);assert.match(html,/Punkte speichern/);
});
