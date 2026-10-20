const crypto=require('node:crypto');
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
const BASE={'user-agent':UA,'referer':'https://www.bilibili.com/','accept':'application/json, text/plain, */*'};
const mixinTab=[46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];
const keyOf=u=>u.slice(u.lastIndexOf('/')+1).split('.')[0];
const md5=s=>crypto.createHash('md5').update(s).digest('hex');
function sign(p,ik,sk){const raw=ik+sk,mixin=mixinTab.map(i=>raw[i]).join('').slice(0,32);const q={...p,wts:Math.floor(Date.now()/1000)};const s=Object.keys(q).sort().map(k=>`${encodeURIComponent(k)}=${encodeURIComponent(String(q[k]).replace(/[!'()*]/g,''))}`).join('&');return s+'&w_rid='+md5(s+mixin);}
(async()=>{
  const nav=await (await fetch('https://api.bilibili.com/x/web-interface/nav',{headers:BASE})).json();
  const ik=keyOf(nav.data.wbi_img.img_url), sk=keyOf(nav.data.wbi_img.sub_url);
  const spi=await (await fetch('https://api.bilibili.com/x/frontend/finger/spi',{headers:BASE})).json();
  const cookie=`buvid3=${spi.data.b_3}; buvid4=${spi.data.b_4}`;
  console.log('buvid3 len=%d buvid4 len=%d',spi.data.b_3.length,spi.data.b_4.length);

  const dm={dm_img_list:'[]',dm_img_str:'V2ViR0wgMS4wIChPcGVuR0wgRVMgMi4wIENocm9taXVtKQ',dm_cover_img_str:'QU5HTEUgKE5WSURJQSwgTlZJRElBIEdlRm9yY2UgUlRYIDUwNjAgKDB4MDAwMDJEMDUpIERpcmVjdDNEMTEgdnNfNV8wIHBzXzVfMCwgRDNEMTEpR29vZ2xlIEluYy4gKE5WSURJQSk',dm_img_inter:'{"ds":[],"wh":[0,0,0],"of":[0,0,0]}'};
  const q=sign({mid:'546195',ps:'5',pn:'1',order:'pubdate',index:'0',platform:'web',web_location:'1550101',...dm},ik,sk);

  let r=await fetch('https://api.bilibili.com/x/space/wbi/arc/search?'+q,{headers:BASE});
  console.log('[space no-cookie] %d %s',r.status,(await r.text()).slice(0,120));

  r=await fetch('https://api.bilibili.com/x/space/wbi/arc/search?'+q,{headers:{...BASE,cookie}});
  const txt=await r.text();
  console.log('[space with-buvid] %d %s',r.status,txt.slice(0,200));

  const q2=sign({host_mid:'546195',offset:'',timezone_offset:'-480',platform:'web',features:'itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote,decorationCard,onlyfansAssetsV2,ugcDelete,onlyfansQaCard',web_location:'333.1387',...dm},ik,sk);
  r=await fetch('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?'+q2,{headers:{...BASE,cookie}});
  const t2=await r.text();
  console.log('[dynamic with-buvid] %d %s',r.status,t2.slice(0,160));

  const ts=Math.floor(Date.now()/1000);
  const hexsign=crypto.createHmac('sha256','XgwSnGZ1p').update('ts'+ts).digest('hex');
  r=await fetch(`https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket?key_id=ec02&hexsign=${hexsign}&context[ts]=${ts}&csrf=`,{method:'POST',headers:{...BASE,cookie}});
  const t3=await r.text();
  console.log('[GenWebTicket] %d %s',r.status,t3.slice(0,220));
})();
