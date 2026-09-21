/**
 * اشتقاق شعار نادي الثقافة والأدب من ملفّه الرسمي — لا رسمًا تقريبيًّا.
 * ==================================================================
 * المدخل: صورتا الشعار (الملوّنة والبيضاء). المخرج: SVG بمعادلاتٍ دقيقة.
 *
 * الخطوات:
 *  ١. فكّ ترميز الصورتين في Chromium وقراءة بكسلاتهما.
 *  ٢. الصورتان نفس العمل بمقياسٍ ثابت، فتُطابَقان: البيضاء تعطي حدودًا
 *     أدقّ (ألفا منعَّمة بدقّة أعلى)، والملوّنة تعطي لون كل بكسل.
 *  ٣. تصنيف كل بكسل بإسقاط لونه على الخطّ الواصل بين لونَي الهوية.
 *  ٤. تحويل المسافة (Felzenszwalb) لاستخراج محور كل شريط وعرضه.
 *  ٥. ملاءمة دائرة بأقل المربّعات (Kása) لمحور كل قوس.
 *  ٦. قياس المعيّن الأوسط بملاءمةٍ مقيّدة تمرّ برؤوسه الأربعة.
 *  ٧. استنتاج ترتيب التشابك من ألوان مناطق التقاطع.
 *
 * التشغيل:  node tools/derive-logo.mjs <الملوّنة> <البيضاء>
 *
 * النتيجة التي خرجت من الشعار الحالي — أربع دوائر متساوية مراكزها أركان
 * مستطيلٍ واحد، مضروبة بقلمٍ ثابت ومقصوصة بذلك المستطيل — بخطأ ملاءمةٍ
 * يقلّ عن ٠.٤ بكسل. الألوان مقيسة لا مخمَّنة: ‏#612775 و‏#73a2b1.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const [, , SRC_COLOUR, SRC_WHITE] = process.argv;
if (!SRC_COLOUR || !SRC_WHITE) {
  console.error('الاستعمال: node tools/derive-logo.mjs <الصورة الملوّنة> <الصورة البيضاء>');
  process.exit(1);
}

/** يفكّ ترميز أي صيغة صور يدعمها المتصفّح (webp/png/…) ويعيد بكسلاتها. */
async function readPixels(files) {
  const require = createRequire(import.meta.url);
  /* Playwright قد يكون مثبّتًا عالميًّا لا في المشروع، فنجرّب الاثنين. */
  let chromium;
  for (const id of ['playwright', 'playwright-core']) {
    try { ({ chromium } = require(id)); break; } catch { /* التالي */ }
  }
  if (!chromium) {
    const { execSync } = require('node:child_process');
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    ({ chromium } = require(`${root}/playwright`));
  }
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto('about:blank');
  const out = [];
  for (const file of files) {
    const b64 = fs.readFileSync(file).toString('base64');
    const ext = path.extname(file).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'jpeg' : ext === 'svg' ? 'svg+xml' : ext;
    const r = await page.evaluate(async (src) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let s = ''; const CH = 8192;
      for (let i = 0; i < d.length; i += CH) s += String.fromCharCode.apply(null, d.subarray(i, i + CH));
      return { w: c.width, h: c.height, b64: btoa(s) };
    }, `data:image/${mime};base64,${b64}`);
    out.push({ meta: { w: r.w, h: r.h }, data: Buffer.from(r.b64, 'base64') });
  }
  await browser.close();
  return out;
}

const [PX1, PX2] = await readPixels([SRC_COLOUR, SRC_WHITE]);

const m1=PX1.meta, d1=PX1.data;
const m2=PX2.meta, d2=PX2.data;
const SX=(953-137+1)/(535-77+1), SY=(270-75+1)/(151-42+1);
const to1=(x,y)=>[77+(x-137)/SX, 42+(y-75)/SY];
const PLUM=[0x61,0x27,0x75], TEAL=[0x73,0xa2,0xb1];
const px1=(x,y)=>{const i=((y|0)*m1.w+(x|0))*4;return [d1[i],d1[i+1],d1[i+2]];};
const a2=(x,y)=>d2[((y|0)*m2.w+(x|0))*4+3];
const X0=Math.floor(137+(442-77)*SX)-2, X1=Math.ceil(137+(535-77)*SX)+2;
const Y0=Math.floor(75+(45-42)*SY)-2,  Y1=Math.ceil(75+(104-42)*SY)+2;
const W=X1-X0+1, H=Y1-Y0+1;

// تصنيف: 1=بنفسجي 2=فيروزي 3=امتزاج (تقاطع)
const cls=new Uint8Array(W*H);
const D=[TEAL[0]-PLUM[0],TEAL[1]-PLUM[1],TEAL[2]-PLUM[2]];
const L2=D[0]**2+D[1]**2+D[2]**2;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const gx=X0+x, gy=Y0+y, a=a2(gx,gy); if(a<128) continue;
  const [fx,fy]=to1(gx,gy); let best=null,bs=-1;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const c=px1(Math.min(m1.w-1,Math.max(0,fx+dx)),Math.min(m1.h-1,Math.max(0,fy+dy)));
    const sat=Math.max(...c)-Math.min(...c); if(sat>bs){bs=sat;best=c;}
  }
  const v=[best[0]-PLUM[0],best[1]-PLUM[1],best[2]-PLUM[2]];
  const t=(v[0]*D[0]+v[1]*D[1]+v[2]*D[2])/L2;
  const perp=Math.hypot(v[0]-t*D[0],v[1]-t*D[1],v[2]-t*D[2]);
  cls[y*W+x] = (perp<32 && t>0.22 && t<0.78) ? 3 : (t<0.5 ? 1 : 2);
}
// أقنعة متّصلة: نضمّ بكسلات التقاطع للمجموعتين فيصير كل قوس قطعة واحدة
const mk=(want)=>{const m=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++) m[i]=(cls[i]===want||cls[i]===3)?1:0; return m;};

/* مسافة إقليدية دقيقة (Felzenszwalb) — نحتاجها لإيجاد محور كل شريط وعرضه */
function edt(mask){
  const INF=1e12, f=new Float64Array(W*H);
  for(let i=0;i<W*H;i++) f[i]=mask[i]?INF:0;
  const tr=(g,n)=>{const d=new Float64Array(n),v=new Int32Array(n),z=new Float64Array(n+1);
    let k=0; v[0]=0; z[0]=-INF; z[1]=INF;
    for(let q=1;q<n;q++){ let s;
      while(true){ s=((g[q]+q*q)-(g[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);
        if(s<=z[k]) k--; else break; }
      k++; v[k]=q; z[k]=s; z[k+1]=INF; }
    k=0; for(let q=0;q<n;q++){ while(z[k+1]<q) k++; d[q]=(q-v[k])**2+g[v[k]]; }
    return d;};
  const col=new Float64Array(H), row=new Float64Array(W);
  for(let x=0;x<W;x++){ for(let y=0;y<H;y++) col[y]=f[y*W+x];
    const d=tr(col,H); for(let y=0;y<H;y++) f[y*W+x]=d[y]; }
  for(let y=0;y<H;y++){ for(let x=0;x<W;x++) row[x]=f[y*W+x];
    const d=tr(row,W); for(let x=0;x<W;x++) f[y*W+x]=Math.sqrt(d[x]); }
  return f;
}
// مكوّنات متّصلة
function comps(mask){
  const lab=new Int32Array(W*H).fill(-1); const out=[];
  for(let s=0;s<W*H;s++){ if(!mask[s]||lab[s]>=0) continue;
    const id=out.length, st=[s], px=[]; lab[s]=id;
    while(st.length){ const p=st.pop(); px.push(p);
      const x=p%W, y=(p/W)|0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue;
        const q=ny*W+nx; if(mask[q]&&lab[q]<0){lab[q]=id;st.push(q);} } }
    if(px.length>60) out.push(px); }
  return out;
}
/* ملاءمة دائرة بأقل المربّعات (Kása): x²+y² + Dx + Ey + F = 0 */
function fitCircle(pts){
  let Sx=0,Sy=0,Sxx=0,Syy=0,Sxy=0,Sz=0,Sxz=0,Syz=0; const n=pts.length;
  for(const [x,y] of pts){ const z=x*x+y*y;
    Sx+=x;Sy+=y;Sxx+=x*x;Syy+=y*y;Sxy+=x*y;Sz+=z;Sxz+=x*z;Syz+=y*z; }
  const A=[[Sxx,Sxy,Sx],[Sxy,Syy,Sy],[Sx,Sy,n]], b=[-Sxz,-Syz,-Sz];
  // حلّ 3×3 بحذف غاوس
  for(let i=0;i<3;i++){ let p=i;
    for(let j=i+1;j<3;j++) if(Math.abs(A[j][i])>Math.abs(A[p][i])) p=j;
    [A[i],A[p]]=[A[p],A[i]]; [b[i],b[p]]=[b[p],b[i]];
    for(let j=i+1;j<3;j++){ const f=A[j][i]/A[i][i];
      for(let k=i;k<3;k++) A[j][k]-=f*A[i][k]; b[j]-=f*b[i]; } }
  const s=[0,0,0];
  for(let i=2;i>=0;i--){ let v=b[i]; for(let k=i+1;k<3;k++) v-=A[i][k]*s[k]; s[i]=v/A[i][i]; }
  const cx=-s[0]/2, cy=-s[1]/2, r=Math.sqrt(cx*cx+cy*cy-s[2]);
  let e=0; for(const [x,y] of pts) e+=(Math.hypot(x-cx,y-cy)-r)**2;
  return { cx, cy, r, rms: Math.sqrt(e/n) };
}



/* ============================ القياس ============================ */
let bx0=1e9,by0=1e9,bx1=-1,by1=-1;
for(let y=0;y<H;y++)for(let x=0;x<W;x++) if(cls[y*W+x]){
  if(x<bx0)bx0=x; if(y<by0)by0=y; if(x>bx1)bx1=x; if(y>by1)by1=y; }
const RW=bx1-bx0+1, RH=by1-by0+1;

function ridge(want){
  const mask=mk(want), dist=edt(mask), out=[];
  for(const px of comps(mask)){
    let mx=0; for(const p of px) mx=Math.max(mx,dist[p]);
    if(px.length<900 && Math.abs((px.reduce((a,p)=>a+p%W,0)/px.length)-(bx0+bx1)/2)<10) continue;
    for(const p of px) if(dist[p]>=mx*0.86) out.push([p%W,(p/W)|0,dist[p]*2]);
  }
  return out;
}
const MX=(bx0+bx1)/2;
const fit=(want)=>{
  const pts=ridge(want);
  const all=[...pts.filter(([x])=>x>MX), ...pts.filter(([x])=>x<=MX).map(([x,y,w])=>[2*MX-x,y,w])];
  const f=fitCircle(all.map(([x,y])=>[x,y]));
  const ws=all.map(p=>p[2]);
  return { ...f, width: ws.reduce((a,b)=>a+b,0)/ws.length };
};
const P=fit(1), T=fit(2);
const R=(P.r+T.r)/2, SW=(P.width+T.width)/2;
const ox=((bx1-P.cx)+(bx1-T.cx))/2, oy=((P.cy-by0)+(by1-T.cy))/2;

// المعيّن الأوسط
const tmask=mk(2);
const seedPx=comps(tmask).find(px=>{const xs=px.map(p=>p%W);
  return Math.abs((Math.min(...xs)+Math.max(...xs))/2-MX)<10 && px.length<900;});
const S=new Set(seedPx), sxs=seedPx.map(p=>p%W), sys=seedPx.map(p=>(p/W)|0);
const sa=(Math.max(...sxs)-Math.min(...sxs))/2, sb=(Math.max(...sys)-Math.min(...sys))/2;
const scx=(Math.max(...sxs)+Math.min(...sxs))/2, scy=(Math.max(...sys)+Math.min(...sys))/2;
const sEdge=seedPx.filter(p=>{const x=p%W,y=(p/W)|0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) if(!S.has((y+dy)*W+(x+dx))) return true;
  return false;}).map(p=>[Math.abs(p%W-scx)+0.5, Math.abs(((p/W)|0)-scy)+0.5])
  .filter(([x,y])=>x>0.8&&y>0.8);
// القوس يمرّ حتمًا برأسَي الضلع، فيبقى مجهولٌ واحد: بُعد مركزه عن منتصف الوتر
const ch=Math.hypot(sa,sb), nx=sb/ch, ny=sa/ch;
let bt=0,be=1e9;
for(let t=0;t<=80;t+=0.02){
  const cxx=sa/2+t*nx, cyy=sb/2+t*ny, rr=Math.hypot(ch/2,t);
  let e=0; for(const [x,y] of sEdge) e+=(Math.hypot(x-cxx,y-cyy)-rr)**2;
  e=Math.sqrt(e/sEdge.length); if(e<be){be=e;bt=t;}
}
const SQ=Math.hypot(ch/2,bt);

/* ترتيب التشابك: أيّ لونٍ فوق في كل منطقة تقاطع؟ */
const hw=SW/2;
const onBand=(x,y,c)=>Math.abs(Math.hypot(x-c[0],y-c[1])-R)<=hw;
const side=(plumC,tealC)=>{
  let p=0,t=0;
  for(let y=0;y<RH;y++)for(let x=0;x<RW;x++){
    const px=x+0.5, py=y+0.5;
    if(!onBand(px,py,plumC)||!onBand(px,py,tealC)) continue;
    const c=cls[(y+by0)*W+(x+bx0)]; if(c===1)p++; else if(c===2)t++; }
  return p>t ? 'plum' : 'teal';
};
const leftTop  = side([ox,oy],[ox,RH-oy]);
const rightTop = side([RW-ox,oy],[RW-ox,RH-oy]);

/* ============================ الإخراج ============================ */
const f=v=>Math.round(v*100)/100;
const A=f(sa), B=f(sb), Q=f(SQ), CX=f(scx-bx0), CY=f(scy-by0);
const seedPath=`M${CX} ${f(CY-B)}A${Q} ${Q} 0 0 0 ${f(CX+A)} ${CY}`
  +`A${Q} ${Q} 0 0 0 ${CX} ${f(CY+B)}A${Q} ${Q} 0 0 0 ${f(CX-A)} ${CY}`
  +`A${Q} ${Q} 0 0 0 ${CX} ${f(CY-B)}Z`;
const circle=(cx,cy)=>`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}"/>`;
const grp=(cls_,colour,body)=>`  <g class="club-mark-${cls_}" clip-path="url(#clubMarkClip)" fill="none"\n`
  +`     stroke="${colour}" stroke-width="${f(SW)}">${body}</g>`;
const PLUM_L=circle(ox,oy), PLUM_R=circle(RW-ox,oy);
const TEAL_L=circle(ox,RH-oy), TEAL_R=circle(RW-ox,RH-oy);
// الجانبان لا يتلامسان، فترتيب الرسم وحده يكفي لصنع التشابك
const layers = leftTop==='teal'
  ? [grp('plum','#612775',PLUM_L), grp('teal','#73a2b1',TEAL_L+TEAL_R), grp('plum','#612775',PLUM_R)]
  : [grp('teal','#73a2b1',TEAL_L), grp('plum','#612775',PLUM_L+PLUM_R), grp('teal','#73a2b1',TEAL_R)];

const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RW} ${RH}" role="img" aria-labelledby="clubLogoTitle">
  <title id="clubLogoTitle">شعار نادي الثقافة والأدب</title>
  <!-- مولَّدٌ آليًّا بـ tools/derive-logo.mjs من ملف الشعار الرسمي.
       أربع دوائر نق=${f(R)} مراكزها أركان المستطيل ${RW}×${RH} (بإزاحة ${f(ox)}، ${f(oy)})،
       بقلمٍ عرضه ${f(SW)}، مقصوصةٌ بالمستطيل. متشابكة: ${leftTop==='teal'?'الفيروزي':'البنفسجي'} فوق يسارًا.
       معيّنٌ أوسط ${f(A*2)}×${f(B*2)} أضلاعه أقواسٌ نق=${Q}. -->
  <clipPath id="clubMarkClip"><rect width="${RW}" height="${RH}"/></clipPath>
${layers.join('\n')}
  <path class="club-mark-seed" fill="#73a2b1" d="${seedPath}"/>
</svg>
`;
fs.mkdirSync('assets',{recursive:true});
fs.writeFileSync('assets/club-logo.svg', svg);

console.log(`مستطيل الشعار     : ${RW} × ${RH}`);
console.log(`نصف قطر الدوائر   : ${f(R)}   (خطأ الملاءمة ${((P.rms+T.rms)/2).toFixed(3)}px)`);
console.log(`عرض القلم         : ${f(SW)}`);
console.log(`إزاحة المراكز     : (${f(ox)}, ${f(oy)}) عن الأركان`);
console.log(`المعيّن            : ${f(A*2)}×${f(B*2)}  نق الضلع=${Q}  (خطأ ${be.toFixed(3)}px)`);
console.log(`التشابك           : يسارًا ${leftTop==='teal'?'الفيروزي':'البنفسجي'} فوق، يمينًا ${rightTop==='teal'?'الفيروزي':'البنفسجي'} فوق`);
console.log(`\nكُتب: assets/club-logo.svg (${svg.length} بايت)`);
