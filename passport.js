const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
(async()=>{
  const u='https://s1.hdslb.com/bfs/static/2233-monorepo/passport/static/js/index.2c6a212d.js';
  const t=await (await fetch(u,{headers:{'user-agent':UA}})).text();
  console.log('bytes',t.length);
  const keys=[...new Set([...t.matchAll(/["'`]([a-z0-9_\-]*passport[a-z0-9_\-\/]*)["'`]/gi)].map(m=>m[1]))];
  console.log('\nPASSPORT PATHS('+keys.length+'):\n'+keys.sort().join('\n'));
  for(const p of ['qrcode','sms','captcha','login']){
    const idx=[...t.matchAll(new RegExp(p,'g'))].slice(0,3).map(m=>m.index);
    for(const i of idx){ console.log('\n--- ['+p+'@'+i+'] ---'); console.log(t.slice(Math.max(0,i-250),i+350).replace(/\s+/g,' ')); }
  }
})();
