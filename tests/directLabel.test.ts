import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DirectLabel} from '../src/DirectLabel';
function click(control:object|null,inside=true){
 let prevented=false,handled=false;
 const label=DirectLabel({htmlFor:'field',onClick:()=>{handled=true}});
 (label.props as any).onClick({target:{closest:()=>control},currentTarget:{contains:()=>inside},preventDefault:()=>{prevented=true}});
 return {prevented,handled};
}
test('clicks on label text and padding do not forward to a form control',()=>{
 assert.deepEqual(click(null),{prevented:true,handled:true});
});
test('direct control clicks and keyboard-generated control clicks retain native behavior',()=>{
 for(const tag of ['input','select','textarea','button','a','summary'])assert.deepEqual(click({tagName:tag}),{prevented:false,handled:true});
});
test('a control outside the label cannot make label whitespace interactive',()=>{
 assert.equal(click({tagName:'input'},false).prevented,true);
});
test('native accessible labels are preserved',()=>{
 const html=renderToStaticMarkup(createElement(DirectLabel,{htmlFor:'field'},'Teilnahme'));assert.equal(html,'<label for="field">Teilnahme</label>');
});
