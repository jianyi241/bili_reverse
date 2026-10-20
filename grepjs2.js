const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
const [,,pageUrl,...pats]=process.argv;
const H={'user-agent':UA,'referer':'https://www.bilibili.com/'};
(async()=>{
  const html=await (await fetch(pageUrl,{headers:H})).text();
  const srcs=[...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map(m=>m[1]);
  console.log('page scripts:',srcs.length, srcs.slice(0,10).join('\n'));
  const all=[];
  for(const s of srcs){
    const u=s.startsWith('http')?s:new URL(s,pageUrl).href;
    try{ all.push([u,await (await fetch(u,{headers:H})).text()]); }catch(e){}
  }
  // also follow dynamic chunk imports for endpoint strings
  const eps=new Set();
  for(const [u,t] of all){ for(const m of t.matchAll(/["'`](https?:\/\/(?:passport|api)\.bilibili\.com\/[a-zA-Z0-9_\-\/\.]+)["'`]/g)) eps.add(m[1]); for(const m of t.matchAll(/["'`](\/x\/[a-zA-Z0-9_\-\/\.]+)["'`]/g)) eps.add(m[1]); }
  console.log('\nENDPOINTS('+eps.size+'):\n'+[...eps].sort().join('\n'));
  for(const p of pats){
    for(const [u,t] of all){
      const i=t.indexOf(p);
      if(i>=0){ console.log('\n=== ['+p+'] '+u+' ==='); console.log(t.slice(Math.max(0,i-400),i+600).replace(/\s+/g,' ')); }
    }
  }
})();
