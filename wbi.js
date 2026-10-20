const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
(async()=>{
  const u='https://s1.hdslb.com/bfs/static/shanks/laputa-home/assets/index-9ec3abf3.js';
  const t=await (await fetch(u,{headers:{'user-agent':UA}})).text();
  const tbl=t.match(/\[\s*46\s*,\s*47\s*,\s*18[\s\S]{0,300}?\]/);
  console.log('MIXIN_TABLE=', tbl?tbl[0].replace(/\s+/g,''):'NOT FOUND');
  const fnStart=t.indexOf('function ky(');
  const alt=t.indexOf('ky=function');
  const i=fnStart>=0?fnStart:alt;
  console.log('\n--- ky() around ---');
  console.log(t.slice(i-200,i+600).replace(/\s+/g,' '));
  const eps=[...new Set([...t.matchAll(/["'`](\/x\/[a-zA-Z0-9_\-\/\.]+)["'`]/g)].map(m=>m[1]))];
  console.log('\nENDPOINTS_IN_HOME_BUNDLE('+eps.length+'):');
  console.log(eps.sort().join('\n'));
})();
