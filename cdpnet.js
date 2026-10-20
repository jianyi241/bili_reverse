const [,,wsUrl,target,durMs]=process.argv;
const ws=new WebSocket(wsUrl); let id=0; const pend=new Map(); const urls=new Map();
const send=(m,p={})=>new Promise((res,rej)=>{const msg={id:++id,method:m,params:p};pend.set(msg.id,{res,rej});ws.send(JSON.stringify(msg));});
ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result);return;}
  if(m.method==='Network.requestWillBeSent'){const r=m.params.request;urls.set(r.url.slice(0,400),r.method);}
};
ws.onopen=async()=>{
  try{
    await send('Network.enable',{});
    await send('Page.enable',{});
    const p=send('Page.navigate',{url:target});
    await new Promise(r=>setTimeout(r,Number(durMs||9000)));
    await p.catch(()=>{});
    const arr=[...urls.entries()].filter(([u])=>/api|passport|hdslb\.com\/bfs\/static|web-frontend/.test(u));
    for(const [u,m] of arr) console.log(m.padEnd(5),u);
    console.log('TOTAL',arr.length);
  }catch(e){console.log('ERR',e.message);}
  ws.close();
};
