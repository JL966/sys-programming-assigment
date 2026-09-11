export const durations={reset:20000,key:15000,hall:15000,vibration:15000,temperature:30000,light:20000,manual:30000,fm:60000,link:45000};
export const nonNormal=item=>item.status!=='NORMAL';
export function temperatureRiseGate(baseline,limit){
 let since=null,count=0;
 return (filtered,current,now=Date.now())=>{
  // The course NTC table decreases in ADC as temperature rises.
  if(current<100||current>834||baseline-filtered<limit||baseline-current<limit){since=null;count=0;return false;}
  if(since===null)since=now;
  count++;
  return count>=5&&now-since>=1500;
 };
}
export function temperature(adc){const a=[834,789,739,685,628,570,512,456,404,355,310,270,235,204,177,153,133,115,100];if(adc>a[0]||adc<a[18])return null;for(let i=0;i<18;i++)if(adc>=a[i+1])return -5+i*5+Math.floor((a[i]-adc)*5/(a[i]-a[i+1]));return 85;}
export function linkPass(counts){return counts.length===2&&counts.every(n=>n>=4);}
