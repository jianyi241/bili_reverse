const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
const H={'user-agent':UA,'referer':'https://www.bilibili.com/','accept':'application/json, text/plain, */*'};
const J=async(u,opt)=>{ try{ const r=await fetch(u,{headers:H,...opt}); const t=await r.text(); return {s:r.status,h:Object.fromEntries(r.headers),b:t.slice(0,400)}; }catch(e){ return {err:e.message}; } };
(async()=>{
  const probes=[
    ['GET','https://passport.bilibili.com/x/passport-login/web/country'],
    ['GET','https://passport.bilibili.com/x/passport-login/web/public-key'],
    ['GET','https://passport.bilibili.com/x/passport-login/web/key'],
    ['GET','https://passport.bilibili.com/x/passport-login/captcha?appkey=1d8b6e7d45233436&type=login'],
    ['POST','https://passport.bilibili.com/x/passport-login/web/login'],
    ['GET','https://api.bilibili.com/x/frontend/finger/spi'],
    ['POST','https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket?csrf=xx'],
    ['GET','https://api.bilibili.com/x/web-interface/nav/stat'],
  ];
  for(const [m,u] of probes){
    const r=await J(u, m==='POST'?{method:'POST',headers:{...H,'content-type':'application/x-www-form-urlencoded'},body:'username=x&password=y'}:{});
    console.log(`\n[${m}] ${u}`);
    console.log('  status='+r.s+' body='+(r.b||r.err).replace(/\s+/g,' ').slice(0,320));
  }
})();
