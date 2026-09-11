import {test} from 'node:test';
import assert from 'node:assert/strict';
import {temperatureRiseGate} from '../../web/js/diagnostic-feedback.js';
test('natural small drift and cooling do not pass',()=>{
 for(const value of [500,499,495,489,515]){
  const gate=temperatureRiseGate(500,12);
  for(let time=0;time<30000;time+=100)assert.equal(gate(value,value,time),false);
 }
});
test('sustained warming passes only after duration and sample requirements',()=>{
 const gate=temperatureRiseGate(500,12);
 for(let time=0;time<1500;time+=100)assert.equal(gate(485,485,time),false);
 assert.equal(gate(485,485,1500),true);
});
test('spikes, recovery and invalid readings reset warming evidence',()=>{
 const gate=temperatureRiseGate(500,12);
 gate(485,485,0);gate(485,485,1000);
 assert.equal(gate(500,500,1400),false);
 assert.equal(gate(485,485,1600),false);
 assert.equal(gate(0,0,3000),false);
 assert.equal(gate(485,485,3100),false);
});
