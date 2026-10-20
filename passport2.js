const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
(async()=>{
  const u='https://s1.hdslb.com/bfs/static/2233-monorepo/passport/static/js/index.2c6a212d.js';
  const t=await (await fetch(u,{headers:{'user-agent':UA}})).text();
  for(const p of ['gee_gt','recaptcha_token','refresh_token','captcha_type','login/sms','sms/send','web/login?','encrypt']){
    const i=t.indexOf(p);
    console.log(`\n=== [${p}] ${i>=0?'found@'+i:'NOT FOUND'} ===`);
    if(i>=0) console.log(t.slice(Math.max(0,i-350),i+350).replace(/\s+/g,' '));
  }
  const paths=[...new Set([...t.matchAll(/["'`]([a-z0-9_\-]+\/[a-z0-9_\-\/]*(?:login|sms|captcha|qrcode|key|country|refresh)[a-z0-9_\-\/]*)["'`]/gi)].map(m=>m[1]))];
  console.log('\nPATH-LIKE STRINGS('+paths.length+'):\n'+paths.sort().slice(0,60).join('\n'));
})();
