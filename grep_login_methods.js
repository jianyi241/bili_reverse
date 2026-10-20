const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
(async()=>{
  const u='https://s1.hdslb.com/bfs/static/2233-monorepo/passport/static/js/index.2c6a212d.js';
  const t=await (await fetch(u,{headers:{'user-agent':UA}})).text();
  // 英文 i18n 块里的登录方式键（取英文段落，避免阿语/西语噪声）
  const keys=[...new Set([...t.matchAll(/"([a-zA-Z]{2,20}Login[a-zA-Z]{0,12})":/g)].map(m=>m[1]))];
  console.log('LOGIN_KEYS:', keys.sort().join(', '));
  for(const k of keys){
    const m=t.match(new RegExp('"'+k+'":"([^"]{0,60})"'));
    console.log('  '+k+' = '+(m?m[1]:'?'));
  }
  const tabs=[...new Set([...t.matchAll(/"(qrcode|password|sms|phone|wechat|weibo|qq|google|apple)[A-Za-z]{0,14}":/g)].map(m=>m[1]))];
  console.log('TABISH:', tabs.join(', '));
})();
