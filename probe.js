const wsUrl = process.argv[2];
const ws = new WebSocket(wsUrl);
let id=0; const pending=new Map();
function send(method,params={},sessionId){ return new Promise((res,rej)=>{ const m={id:++id,method,params}; if(sessionId)m.sessionId=sessionId; pending.set(m.id,{res,rej}); ws.send(JSON.stringify(m)); }); }
ws.onmessage = ev => { const m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){ const p=pending.get(m.id); pending.delete(m.id); m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result);} };
ws.onopen = async () => {
  try{
    const {cookies} = await send('Storage.getCookies',{});
    const bili = cookies.filter(c=>c.domain.includes('bilibili'));
    console.log('bili cookie count', bili.length);
    for(const c of bili) console.log([c.domain,c.name,c.expires>0?new Date(c.expires*1000).toISOString().slice(0,10):'session',c.httpOnly?'H':'',c.secure?'S':'',c.value.length].join('\t'));
    const ck = bili.filter(c=>['SESSDATA','bili_jct','DedeUserID','buvid3','buvid4','bili_ticket'].includes(c.name)).map(c=>`${c.name}=${encodeURIComponent(c.value)}`).join('; ');
    const r = await fetch('https://api.bilibili.com/x/web-interface/nav',{headers:{'cookie':ck,'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','referer':'https://www.bilibili.com/'}});
    const j = await r.json();
    console.log('NAV code=',j.code,'message=',j.message,'isLogin=',j.data&&j.data.isLogin,'uname=',j.data&&j.data.uname,'mid=',j.data&&j.data.mid);
  }catch(e){ console.log('ERR', e.message); }
  ws.close();
};
