const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
const H={'user-agent':UA,'referer':'https://passport.bilibili.com/login','origin':'https://passport.bilibili.com','content-type':'application/x-www-form-urlencoded'};
const go=async(u,body)=>{const r=await fetch(u,{method:'POST',headers:H,body:new URLSearchParams(body)});return (await r.text()).slice(0,260);};
(async()=>{
  console.log('[sms/send]      ', await go('https://passport.bilibili.com/x/passport-login/web/sms/send',{cid:'86',tel:'13800138000',source:'main-fe-header',token:'',challenge:'',validate:''}));
  console.log('[login/sms]     ', await go('https://passport.bilibili.com/x/passport-login/web/login/sms',{cid:'86',tel:'13800138000',code:'123456',captcha_key:'',source:'main-fe-header'}));
  console.log('[login/pwd]     ', await go('https://passport.bilibili.com/x/passport-login/web/login',{username:'test',password:'AAAA',keep:'1',token:'',challenge:'',validate:'',seccode:'',gee_gt:'',gee_challenge:'',gee_validate:'',gee_seccode:'',recaptcha_token:'',tsp:String(Date.now()),from_spm_id:''}));
  console.log('[cookie/refresh]', await go('https://passport.bilibili.com/x/passport-login/web/cookie/refresh',{refresh_token:'x',csrf:''}));
  console.log('[qrcode invalid]');
  const r=await fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=deadbeefdeadbeefdeadbeefdeadbeef&source=main-fe-header',{headers:{'user-agent':UA,referer:'https://www.bilibili.com/'}});
  console.log('                ', (await r.text()).slice(0,200));
})();
