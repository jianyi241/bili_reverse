const crypto=require('node:crypto');
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
const H={'user-agent':UA,'referer':'https://www.bilibili.com/','accept':'application/json, text/plain, */*'};
const mixinTab=[46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];
const keyOf=u=>u.slice(u.lastIndexOf('/')+1).split('.')[0];
const md5=s=>crypto.createHash('md5').update(s).digest('hex');
function sign(p,ik,sk){const raw=ik+sk,mixin=mixinTab.map(i=>raw[i]).join('').slice(0,32);const q={...p,wts:Math.floor(Date.now()/1000)};const s=Object.keys(q).sort().map(k=>`${encodeURIComponent(k)}=${encodeURIComponent(String(q[k]).replace(/[!'()*]/g,''))}`).join('&');return s+'&w_rid='+md5(s+mixin);}
const g=async(u,extra={})=>{const r=await fetch(u,{headers:{...H,...extra}});const t=await r.text();return {s:r.status,t};};
(async()=>{
  const nav=await (await fetch('https://api.bilibili.com/x/web-interface/nav',{headers:H})).json();
  const ik=keyOf(nav.data.wbi_img.img_url), sk=keyOf(nav.data.wbi_img.sub_url);
  const show=(n,r,f)=>console.log(`\n[${n}] status=${r.s}\n  `+(f?f(r.t):r.t).replace(/\s+/g,' ').slice(0,300));

  let r=await g('https://api.bilibili.com/x/web-interface/popular?ps=3&pn=1');
  show('popular',r,t=>{const j=JSON.parse(t);return `code=${j.code} n=${j.data.list.length} first=${j.data.list[0].title} bvid=${j.data.list[0].bvid} owner=${j.data.list[0].owner.name}`;});
  r=await g('https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all');
  show('ranking/v2',r,t=>{const j=JSON.parse(t);return `code=${j.code} n=${j.data&&j.data.list&&j.data.list.length} first=${j.data&&j.data.list&&j.data.list[0].title}`;});
  r=await g('https://api.bilibili.com/x/v2/reply/wbi/main?'+sign({oid:'80433022',type:'1',mode:'3',pagination_str:'{"offset":""}',plat:'1',seek_rpid:'',web_location:'1315875'},ik,sk));
  show('reply/wbi/main',r,t=>{const j=JSON.parse(t);const rep=j.data&&j.data.replies||[];return `code=${j.code} replies=${rep.length} first=${rep[0]&&rep[0].member.uname}: ${rep[0]&&String(rep[0].content.message).slice(0,40)}`;});
  r=await g('https://api.bilibili.com/x/player/wbi/v2?'+sign({aid:'80433022',cid:'137649199'},ik,sk));
  show('player/wbi/v2',r,t=>{const j=JSON.parse(t);return `code=${j.code} subtitle=${JSON.stringify(j.data&&j.data.subtitle&&j.data.subtitle.subtitles&&j.data.subtitle.subtitles.length)} aid=${j.data&&j.data.aid}`;});
  r=await g('https://api.bilibili.com/x/space/wbi/arc/search?'+sign({mid:'546195',ps:'5',pn:'1',order:'pubdate',index:'0',platform:'web'},ik,sk));
  show('space/wbi/arc/search',r,t=>{const j=JSON.parse(t);return `code=${j.code} msg=${j.message} vlist=${j.data&&j.data.list&&j.data.list.vlist&&j.data.list.vlist.length}`;});
  r=await g('https://api.bilibili.com/x/relation/stat?vmid=546195');
  show('relation/stat',r);
  r=await g('https://api.bilibili.com/x/web-interface/view/detail?bvid=BV1GJ411x7h7');
  show('view/detail',r,t=>{const j=JSON.parse(t);return `code=${j.code} tags=${j.data&&j.data.Tags&&j.data.Tags.length} related=${j.data&&j.data.Related&&j.data.Related.length} staff=${j.data&&j.data.View&&j.data.View.staff&&j.data.View.staff.length}`;});
  r=await g('https://api.bilibili.com/x/v2/dm/web/seg.so?type=1&oid=137649199&pid=80433022&segment_index=1');
  console.log(`\n[danmaku seg.so] status=${r.s} bytes=${r.t.length} head=${JSON.stringify(r.t.slice(0,24))}`);
  r=await g('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=546195');
  show('dynamic/space',r,t=>{const j=JSON.parse(t);return `code=${j.code} items=${j.data&&j.data.items&&j.data.items.length}`;});
  // GenWebTicket with HMAC signature
  const ts=Math.floor(Date.now()/1000);
  const hexsign=crypto.createHmac('sha256','XgwSnGZ1p').update('ts'+ts).digest('hex');
  r=await g(`https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket?key_id=ec02&hexsign=${hexsign}&context[ts]=${ts}&csrf=`,{});
  show('GenWebTicket',r,t=>{const j=JSON.parse(t);return `code=${j.code} msg=${j.message} ticket=${j.data&&String(j.data.ticket).slice(0,16)}... ttl=${j.data&&j.data.created_at}`;});
})();
