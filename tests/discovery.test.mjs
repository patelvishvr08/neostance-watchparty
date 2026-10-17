import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog,searchCatalog,recommendCatalog } from '../core/catalog.mjs';
test('discovery ranks exact titles, tolerates misspellings and combines multiple mood words',()=>{
 assert.equal(searchCatalog('Sintel')[0].id,'sintel');
 assert.equal(searchCatalog('sintal')[0].id,'sintel');
 assert.deepEqual(searchCatalog('calm space').map(f=>f.id),['orbit']);
 assert.deepEqual(searchCatalog('relaxing ocean').map(f=>f.id),['tides']);
 assert.equal(searchCatalog('FOOTBALL!!')[0].id,'floodlights');
 assert.equal(searchCatalog('2026','Sports')[0].id,'floodlights');
 assert.deepEqual(searchCatalog('ocean','Fantasy'),[]);
 assert.deepEqual(searchCatalog('a completely nonexistent movie title'),[]);
});
test('recommendations respect dislikes and use related moods rather than returning saved films',()=>{
 const suggested=recommendCatalog(['orbit'],[],['bunny']);
 assert.equal(suggested[0].id,'tides');
 assert.ok(suggested.every(f=>!['orbit','bunny'].includes(f.id)));
 assert.deepEqual(recommendCatalog(catalog.map(f=>f.id),[],[]),[]);
 assert.deepEqual(recommendCatalog([],[],catalog.map(f=>f.id)),[]);
 assert.ok(recommendCatalog([],['orbit'],[]).length>0);
});
