const crypto=require('node:crypto');
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
const H={'user-agent':UA,'referer':'https://www.bilibili.com/','accept':'application/json, text/plain, */*'};
const mixinTab=[46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];
const keyOf=u=>u.slice(u.lastIndexOf('/')+1).split('.')[0];
function wbiSign(params,imgKey,subKey){
  const raw=imgKey+subKey;
  const mixin=mixinTab.map(i=>raw[i]).join('').slice(0,32);
  const p={...params,wts:Math.floor(Date.now()/1000)};
  const q=Object.keys(p).sort().map(k=>{
    const v=String(p[k]).replace(/[!'()*]/g,'');
    return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
  }).join('&');
  return q+'&w_rid='+crypto.createHash('md5').update(q+mixin).digest('hex');
}
(async()=>{
  const nav=await (await fetch('https://api.bilibili.com/x/web-interface/nav',{headers:H})).json();
  const imgKey=keyOf(nav.data.wbi_img.img_url), subKey=keyOf(nav.data.wbi_img.sub_url);
  console.log('[nav] code=%d imgKey=%s subKey=%s',nav.code,imgKey,subKey);

  const rcmdQ=wbiSign({web_location:'1430650',feed_version:'V8',fresh_type:'3',ps:'12',fresh_idx:'1',fresh_idx_1h:'1'},imgKey,subKey);
  const rcmd=await (await fetch('https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd?'+rcmdQ,{headers:H})).json();
  console.log('[rcmd] code=%d items=%s first=%s',rcmd.code,rcmd.data&&rcmd.data.item&&rcmd.data.item.length,rcmd.data&&rcmd.data.item&&rcmd.data.item[0]&&rcmd.data.item[0].title);

  const view=await (await fetch('https://api.bilibili.com/x/web-interface/view?bvid=BV1GJ411x7h7',{headers:H})).json();
  console.log('[view] code=%d title=%s aid=%s cid=%s',view.code,view.data&&view.data.title,view.data&&view.data.aid,view.data&&view.data.cid);

  if(view.code===0){
    const pq=wbiSign({bvid:'BV1GJ411x7h7',cid:String(view.data.cid),fnval:'4048',fnver:'0',fourk:'1'},imgKey,subKey);
    const play=await (await fetch('https://api.bilibili.com/x/player/wbi/playurl?'+pq,{headers:H})).json();
    const qs=play.data&&play.data.accept_quality||[];
    console.log('[playurl] code=%d quality=%s dash=%s durl=%s',play.code,JSON.stringify(qs.slice(0,8)),!!(play.data&&play.data.dash),!!(play.data&&play.data.durl));
  }

  const sq=wbiSign({search_type:'video',keyword:'原神',page:'1'},imgKey,subKey);
  const search=await (await fetch('https://api.bilibili.com/x/web-interface/wbi/search/type?'+sq,{headers:H})).json();
  console.log('[search] code=%d numResults=%s',search.code,search.data&&search.data.numResults);

  const qr=await (await fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/generate',{headers:H})).json();
  console.log('[qr.generate] code=%d msg=%s url=%s key=%s...',qr.code,qr.message,qr.data&&qr.data.url,qr.data&&String(qr.data.qrcode_key).slice(0,8));
  if(qr.code===0){
    const poll=await (await fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key='+qr.data.qrcode_key+'&source=main-fe-header',{headers:H})).json();
    console.log('[qr.poll] code=%d msg=%s innerCode=%s',poll.code,poll.message,poll.data&&poll.data.code);
  }
})();
