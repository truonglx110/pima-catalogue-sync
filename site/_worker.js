const FOLDER='1vXwfcLCZpB9rEHypkNlpGdJ1J4kuKATu';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function google(path,params,key,headers={}){
 const url=new URL('https://www.googleapis.com/drive/v3/'+path);
 for(const [k,v]of Object.entries(params))url.searchParams.set(k,v);
 return fetch(url.href,{headers:{'x-goog-api-key':key,...headers},redirect:'manual'});
}
const app={async fetch(request,env){
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 if(!env.DRIVE_API_KEY)return json({error:'Chưa cấu hình DRIVE_API_KEY trên Cloudflare.'},503);
 const key=String(env.DRIVE_API_KEY).trim();
 if(!/^[A-Za-z0-9_-]{20,100}$/.test(key))return json({error:'KEY_FORMAT: Secret DRIVE_API_KEY không đúng định dạng. Chỉ dán giá trị key, bỏ dấu ngoặc, khoảng trắng và xuống dòng.'},503);
 let step='START';
 try{
 if(url.pathname==='/api/catalogues'){
  const cacheKey=new Request(url.origin+'/api/catalogues');const cache=globalThis.caches?.default;
  let cached;try{cached=await cache?.match(cacheKey)}catch{}if(cached)return cached;
  let files=[],pageToken='';
  for(let n=0;n<20;n++){
   step='DRIVE_LIST';const r=await google('files',{q:"'"+FOLDER+"' in parents and trashed = false and mimeType = 'application/pdf'",fields:'nextPageToken,files(id,name,modifiedTime,size,resourceKey)',orderBy:'modifiedTime desc',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true',...(pageToken?{pageToken}:{})},key);
   if(!r.ok)return json({error:'Không đọc được thư mục công khai. Kiểm tra API key, Google Drive API và quyền chia sẻ. Mã '+r.status},502);
   step='DRIVE_LIST_JSON';const data=await r.json();files.push(...(data.files||[]));pageToken=data.nextPageToken||'';if(!pageToken)break;
  }
  if(pageToken)return json({error:'Thư mục vượt giới hạn 2.000 PDF của bản này.'},422);
  const response=new Response(JSON.stringify({files}),{headers:{'Content-Type':'application/json','Cache-Control':'public,max-age=60','X-Content-Type-Options':'nosniff'}});
  try{await cache?.put(cacheKey,response.clone())}catch{}return response;
 }
 const match=url.pathname.match(/^\/api\/pdf\/([\w-]+)$/);if(!match)return json({error:'Not found'},404);
 const id=match[1];
 step='PDF_MEMBERSHIP';
 const listing=await app.fetch(new Request(url.origin+'/api/catalogues'),env);
 if(!listing.ok)return listing;
 const data=await listing.json(),file=data.files?.find(item=>item.id===id);
 if(!file)return json({error:'PDF không nằm trong danh sách catalogue công khai.'},403);
 const headers=file.resourceKey?{'X-Goog-Drive-Resource-Keys':id+'/'+file.resourceKey}:{};
 const range=request.headers.get('Range');
 if(range&&!/^bytes=\d+-\d*$/.test(range))return json({error:'Range không hợp lệ'},416);
 const cache=globalThis.caches?.default;
 const segmentURL=new URL(url.origin+'/__pdf_segment/'+id);segmentURL.searchParams.set('v',file.modifiedTime);segmentURL.searchParams.set('range',range||'full');
 const segmentKey=new Request(segmentURL.href);
 if(range){try{const hit=await cache?.match(segmentKey);if(hit){const h=new Headers(hit.headers);h.set('Cache-Control','private,max-age=3600');h.set('X-PIMA-Cache','HIT');return new Response(hit.body,{status:206,headers:h})}}catch{}}
 step='PDF_MEDIA';const r=await google('files/'+id,{alt:'media',supportsAllDrives:'true'},key,{...headers,...(range?{Range:range}:{})});
 if(!r.ok)return json({error:'Chưa tải được PDF. Mã '+r.status},502);
 const out=new Headers({'Content-Type':'application/pdf','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 for(const name of ['Content-Length','Content-Range','Accept-Ranges'])if(r.headers.has(name))out.set(name,r.headers.get(name));
 if(range&&r.status===206){
  out.set('Cache-Control','public,max-age=86400');out.set('X-PIMA-Cache','MISS');
  const bytes=await r.arrayBuffer();
  if(bytes.byteLength<=1048576){try{await cache?.put(segmentKey,new Response(bytes,{status:200,headers:out}))}catch{}}
  out.set('Cache-Control','private,max-age=3600');return new Response(bytes,{status:206,headers:out});
 }
 return new Response(r.body,{status:r.status,headers:out});
 }catch(error){const detail=(String(error?.name||'Error')+': '+String(error?.message||'Unknown')).split(key).join('[REDACTED]').replace(/AIza[A-Za-z0-9_-]+/g,'[REDACTED]').slice(0,350);return json({error:'Kết nối thất bại tại '+step+' — '+detail},502)}
}};

export default app;
