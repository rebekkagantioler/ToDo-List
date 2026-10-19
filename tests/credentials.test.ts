import {test} from 'node:test';
import assert from 'node:assert/strict';
import {credentialsEmail} from '../src/credentials';
test('Username login and registration use the same normalized internal identifier',()=>{
 assert.equal(credentialsEmail(' Anna_12 ',true),'anna_12@accounts.planraum.invalid');
 assert.equal(credentialsEmail('ANNA_12',false),credentialsEmail('anna_12',true));
 for(const name of ['ab','a@b.at','anna name','äbc','x'.repeat(31)])assert.throws(()=>credentialsEmail(name,true));
});
test('Legacy login remains available and its username is reserved',()=>{
 assert.equal(credentialsEmail('Rebekka',false,'rebekka','old@example.com'),'old@example.com');
 assert.throws(()=>credentialsEmail('REBEKKA',true,'rebekka','old@example.com'));
 assert.equal(credentialsEmail('other@example.com',false),'other@example.com');
});
