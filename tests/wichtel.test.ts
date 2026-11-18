import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {wichtelNames,wichtelInputError,wichtelLink,wichtelToken,validWichtelToken,engilaRoundTitle} from '../src/wichtel';

test('Wichtel input and links retain the Pages path, hide tokens in the fragment and reject ambiguous participants',()=>{
 assert.deepEqual(wichtelNames(' Anna \r\n\nBen\n Clara '),['Anna','Ben','Clara']);
 assert.ok(wichtelInputError('Weihnachten',['Anna']));assert.ok(wichtelInputError('Weihnachten',['Anna','anna']));
 assert.equal(wichtelInputError('Weihnachten',['Anna M.','Anna S.']),'');
 const token='ab'.repeat(32),url=wichtelLink(token,'https://example.test/ToDo-List/?old=value#old');
 assert.equal(url,`https://example.test/ToDo-List/#engila=${token}`);
 assert.equal(wichtelToken(new URL(url).hash),token);assert.equal(wichtelToken('#wichteln='+token),token);assert.equal(wichtelToken('#other'),null);assert.equal(wichtelToken('#wichteln='),'');
 assert.equal(wichtelToken('#engila='),'');
 assert.deepEqual(wichtelNames(['Anna','Ben'].join(String.fromCharCode(13,10))),['Anna','Ben']);
 assert.equal(engilaRoundTitle('Weihnachtswichteln 2026'),'Engila Bengila 2026');assert.equal(engilaRoundTitle('Familie'),'Familie');
 assert.equal(validWichtelToken('abc'),false);assert.throws(()=>wichtelLink('abc','https://example.test/'));
});

test('Only the pinned owner can manage draws; anonymous links reveal one fixed other person, retries are stable and deletion revokes links',async()=>{
 const db=new PGlite(),owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 const source=await readFile('supabase/wichteln.sql','utf8');
 const sql=source.replace(/md5\(lower\(email\)\)='[a-f0-9]{32}'/,"email='owner@example.test'");
 assert.notEqual(sql,source);
 try{
  await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO authenticated,anon;INSERT INTO auth.users VALUES('${owner}','owner@example.test','{}'),('${other}','other@example.test','{"username":"Rebekka"}');`);
  await db.exec(sql);
  await db.exec(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${other}',false)`);
  assert.equal((await db.query('SELECT wichtel_is_admin() AS allowed')).rows[0].allowed,false);
  await assert.rejects(()=>db.query('SELECT wichtel_list()'));
  await assert.rejects(()=>db.query('SELECT * FROM wichtel_people'));
  await assert.rejects(()=>db.query('UPDATE wichtel_config SET owner_id=$1',[other]));
  await assert.rejects(()=>db.query('SELECT wichtel_draw($1,$2,$3)',[randomUUID(),'Fremd',['Anna','Ben']]));
  await assert.rejects(()=>db.query('SELECT wichtel_delete($1)',[randomUUID()]));
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${owner}',false)`);
  assert.equal((await db.query('SELECT wichtel_is_admin() AS allowed')).rows[0].allowed,true);
  for(const names of [[],['Anna'],['Anna','anna'],['Anna',null],['Anna',' '],Array(101).fill('X')])await assert.rejects(()=>db.query('SELECT wichtel_draw($1,$2,$3)',[randomUUID(),'Weihnachten',names]));
  const ids:string[]=[];const allTokens:string[]=[];
  for(const n of [2,3,10,100]){
   const id=randomUUID(),names=n===3?['Rebekka','Anna','Ben']:Array.from({length:n},(_,i)=>`Person ${i+1}`);ids.push(id);
   await db.query('SELECT wichtel_draw($1,$2,$3)',[id,'Weihnachten',names]);
   const list:any=(await db.query('SELECT wichtel_list() AS rounds')).rows[0].rounds;
   const round=list.find((r:any)=>r.id===id);assert.equal(round.people.length,n);
   const results=new Map<string,unknown>();
   const recipients:string[]=[],tokens=round.people.map((p:any)=>p.token);allTokens.push(...tokens);
   assert.equal(new Set(tokens).size,n);assert.ok(tokens.every(validWichtelToken));
   for(const person of round.people){
    assert.deepEqual(Object.keys(person).sort(),['id','name','revealed_at','token']);
    assert.equal(person.revealed_at,null);
    assert.equal(person.recipient,undefined);assert.equal(person.recipient_id,undefined);
    const result:any=(await db.query('SELECT wichtel_reveal($1) AS result',[person.token])).rows[0].result;
    assert.deepEqual(Object.keys(result).sort(),['giver','recipient','title']);
    results.set(person.token,result);
    assert.equal(result.giver,person.name);assert.notEqual(result.recipient,person.name);assert.ok(names.includes(result.recipient));recipients.push(result.recipient);
   }
   const opened:any=(await db.query('SELECT wichtel_list() AS rounds')).rows[0].rounds.find((r:any)=>r.id===id);
   assert.ok(opened.people.every((p:any)=>typeof p.revealed_at==='string'));
   assert.equal(new Set(recipients).size,n);
   await db.query('SELECT wichtel_draw($1,$2,$3)',[id,'Weihnachten',names]);
   const retry:any=(await db.query('SELECT wichtel_list() AS rounds')).rows[0].rounds;
   assert.deepEqual(retry.find((r:any)=>r.id===id),opened);
   for(const token of tokens)assert.deepEqual((await db.query('SELECT wichtel_reveal($1) AS result',[token])).rows[0].result,results.get(token));
   await assert.rejects(()=>db.query('SELECT wichtel_draw($1,$2,$3)',[id,'Andere Runde',names]));
  }
  assert.equal(new Set(allTokens).size,allTokens.length);
  // The small upgrade is safe for an already running draw and retains its view markers.
  await db.exec('RESET ROLE');await db.exec(await readFile('supabase/wichteln-gelesen.sql','utf8'));
  await db.exec(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${owner}',false)`);
  const upgraded:any=(await db.query('SELECT wichtel_list() AS rounds')).rows[0].rounds;
  assert.ok(upgraded.every((round:any)=>round.people.every((person:any)=>typeof person.revealed_at==='string')));
  // Reinstalling the temporary feature never re-draws existing rounds.
  await db.exec('RESET ROLE');await db.exec(sql);
  await db.exec(`SET ROLE anon;SELECT set_config('request.jwt.claim.sub','',false)`);
  await assert.rejects(()=>db.query('SELECT wichtel_list()'));
  await assert.rejects(()=>db.query('SELECT wichtel_draw($1,$2,$3)',[randomUUID(),'Fremd',['A','B']]));
  await assert.rejects(()=>db.query('SELECT * FROM wichtel_people'));
  assert.equal((await db.query('SELECT wichtel_reveal($1) AS result',['bad'])).rows[0].result,null);
  assert.equal((await db.query('SELECT wichtel_reveal($1) AS result',['00'.repeat(32)])).rows[0].result,null);
  const before:any=(await db.query('SELECT wichtel_reveal($1) AS result',[allTokens[0]])).rows[0].result;assert.ok(before.recipient);
  await db.exec(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${owner}',false)`);
  assert.equal((await db.query('SELECT wichtel_delete($1) AS removed',[ids[0]])).rows[0].removed,true);
  assert.equal((await db.query('SELECT wichtel_reveal($1) AS result',[allTokens[0]])).rows[0].result,null);
  assert.ok((await db.query('SELECT wichtel_reveal($1) AS result',[allTokens[2]])).rows[0].result);
  await db.exec('RESET ROLE');await db.exec(await readFile('supabase/wichteln-entfernen.sql','utf8'));
  assert.equal((await db.query("SELECT to_regclass('public.wichtel_people') AS t")).rows[0].t,null);
 }finally{await db.close()}
});
