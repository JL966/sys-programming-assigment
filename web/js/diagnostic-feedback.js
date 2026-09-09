export const durations={reset:20000,key:15000,hall:15000,vibration:15000,temperature:30000,light:20000,manual:30000,fm:60000,link:45000};
export const nonNormal=item=>item.status!=='NORMAL';
export function temperature(adc){const a=[834,789,739,685,628,570,512,456,404,355,310,270,235,204,177,153,133,115,100];if(adc>a[0]||adc<a[18])return null;for(let i=0;i<18;i++)if(adc>=a[i+1])return -5+i*5+Math.floor((a[i]-adc)*5/(a[i]-a[i+1]));return 85;}
export function linkPass(counts){return counts.length===2&&counts.every(n=>n>=4);}
