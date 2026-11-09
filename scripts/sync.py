import os,json,hashlib,urllib.request,urllib.parse,time,shutil
from pathlib import Path
import fitz
from PIL import Image
FOLDER='1vXwfcLCZpB9rEHypkNlpGdJ1J4kuKATu'
KEY=os.environ['DRIVE_API_KEY'].strip()
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'.cache';DIST=ROOT/'dist'
CACHE.mkdir(exist_ok=True)
def request(path,params,resource=None):
 url='https://www.googleapis.com/drive/v3/'+path+'?'+urllib.parse.urlencode(params)
 headers={'x-goog-api-key':KEY}
 if resource:headers['X-Goog-Drive-Resource-Keys']=resource
 # Standard library handles redirects without exposing the key in logs.
 for attempt in range(3):
  try:return urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=90)
  except Exception:
   if attempt==2:raise RuntimeError('Drive read failed; published site was not changed.') from None
   time.sleep(2**attempt)
def list_files():
 files=[];token=''
 while True:
  params={'q':f"'{FOLDER}' in parents and trashed=false and mimeType='application/pdf'",'fields':'nextPageToken,files(id,name,size,modifiedTime,resourceKey)','pageSize':100,'orderBy':'modifiedTime desc'}
  if token:params['pageToken']=token
  with request('files',params) as r:data=json.load(r)
  files.extend(data.get('files',[]));token=data.get('nextPageToken')
  if not token:return files
def digest(files):return hashlib.sha256(json.dumps(files,sort_keys=True).encode()).hexdigest()
files=list_files()
if not files:raise RuntimeError('Folder empty: refusing to replace working site with an empty build.')
if DIST.exists():shutil.rmtree(DIST)
shutil.copytree(ROOT/'site',DIST)
registry={};valid_dirs=[]
for f in files:
 version=hashlib.sha256((f['id']+f['modifiedTime']).encode()).hexdigest()[:20]
 target=CACHE/version;manifest=target/'manifest.json'
 if not manifest.exists():
  tmp=CACHE/(version+'.building');shutil.rmtree(tmp,ignore_errors=True);tmp.mkdir()
  resource=f['id']+'/'+f['resourceKey'] if f.get('resourceKey') else None
  pdf=tmp/'source.pdf'
  with request('files/'+f['id'],{'alt':'media'},resource) as r,pdf.open('wb') as out:shutil.copyfileobj(r,out)
  if pdf.stat().st_size!=int(f['size']):raise RuntimeError('PDF size changed during sync; no deployment.')
  doc=fitz.open(pdf);pages=[]
  if doc.is_encrypted or len(doc)==0:raise RuntimeError('Unreadable PDF; no deployment.')
  for n,page in enumerate(doc):
   pix=page.get_pixmap(matrix=fitz.Matrix(1600/page.rect.width,1600/page.rect.width),alpha=False)
   name=f'{n+1:03}.webp';image=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
   image.save(tmp/name,'WEBP',quality=85,method=4)
   with Image.open(tmp/name) as check:check.verify()
   pages.append({'url':f'/catalogue-pages/{version}/{name}','width':pix.width,'height':pix.height})
  doc.close();pdf.unlink()
  manifest_data={'fileId':f['id'],'modifiedTime':f['modifiedTime'],'pages':pages}
  (tmp/'manifest.json').write_text(json.dumps(manifest_data))
  if target.exists():shutil.rmtree(target)
  tmp.rename(target)
 registry[f['id']]=json.loads(manifest.read_text())
 shutil.copytree(target,DIST/'catalogue-pages'/version)
 valid_dirs.append(version)
if digest(files)!=digest(list_files()):raise RuntimeError('Drive changed during build; previous published version is preserved. Retry sync.')
(DIST/'catalogues.json').write_text(json.dumps({'files':files}))
(DIST/'web-catalogue.json').write_text(json.dumps({'catalogues':registry}))
# Deploy only if content or website code changed.
signature=hashlib.sha256()
for p in sorted(DIST.rglob('*')):
 if p.is_file():signature.update(str(p.relative_to(DIST)).encode());signature.update(p.read_bytes())
sig=signature.hexdigest();changed=not (CACHE/'published.sha').exists() or (CACHE/'published.sha').read_text()!=sig
(CACHE/'candidate.sha').write_text(sig)
if os.environ.get('GITHUB_OUTPUT'):
 with open(os.environ['GITHUB_OUTPUT'],'a') as out:out.write(f"changed={'true' if changed else 'false'}\n")
print(f'Prepared {len(files)} catalogues; {sum(len(v["pages"]) for v in registry.values())} pages; changed={changed}. No credentials logged.')
