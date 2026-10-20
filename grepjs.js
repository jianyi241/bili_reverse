const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
const [,,pageUrl,...pats]=process.argv;
const H={'user-agent':UA,'referer':pageUrl};
(async()=>{
  const html=await (await fetch(pageUrl,{headers:H})).text();
  const srcs=[...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map(m=>m[1]);
  console.log('page',pageUrl,'scripts',srcs.length);
  for(const s of srcs){
    const u=s.startsWith('http')?s:new URL(s,pageUrl).href;
    let txt;
    try{ txt=await (await fetch(u,{headers:H})).text(); }catch(e){ console.log('skip',u,e.message); continue; }
    for(const p of pats){
      const i=txt.indexOf(p);
      if(i>=0){
        console.log('\n=== MATCH ['+p+'] in '+u+' ('+txt.length+' bytes) ===');
        console.log(txt.slice(Math.max(0,i-500), i+700).replace(/\s+/g,' '));
      }
    }
  }
})();
