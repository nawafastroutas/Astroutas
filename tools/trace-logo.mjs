import fs from 'node:fs';
const SP='/tmp/claude-0/-home-user-Astroutas/558d0e2c-9b05-5540-b35e-f5ce2550927e/scratchpad';
const m1=JSON.parse(fs.readFileSync(`${SP}/px1.json`)), d1=fs.readFileSync(`${SP}/px1.raw`);
const m2=JSON.parse(fs.readFileSync(`${SP}/px2.json`)), d2=fs.readFileSync(`${SP}/px2.raw`);

// خريطة صورة2 → صورة1 (نفس العمل بمقياس 1.78)
const SX=(953-137+1)/(535-77+1), SY=(270-75+1)/(151-42+1);
const to1=(x2,y2)=>[77+(x2-137)/SX, 42+(y2-75)/SY];

const PLUM=[0x61,0x27,0x75], TEAL=[0x73,0xa2,0xb1];
const px1=(x,y)=>{const i=((y|0)*m1.w+(x|0))*4; return [d1[i],d1[i+1],d1[i+2],d1[i+3]];};
const a2=(x,y)=>d2[((y|0)*m2.w+(x|0))*4+3];
const d2c=(c,t)=>(c[0]-t[0])**2+(c[1]-t[1])**2+(c[2]-t[2])**2;

// منطقة الشعار في صورة2 (من صندوقه في صورة1)
const X0=Math.floor(137+(442-77)*SX)-2, X1=Math.ceil(137+(535-77)*SX)+2;
const Y0=Math.floor(75+(45-42)*SY)-2,  Y1=Math.ceil(75+(104-42)*SY)+2;
const W=X1-X0+1, H=Y1-Y0+1;

/* تصنيف البكسلات.
   عند تقاطع قوسين يمتزج اللونان، فالبكسل هناك ليس بنفسجيًا ولا فيروزيًا.
   لو أسندناه لأحدهما لانقطع قوس الآخر وظهرت ثُلمة فيه أثناء الحركة. لذلك
   نُسنده للاثنين معًا، فيبقى كلا القوسين كاملًا ويتراكبان عند السكون.
   تمييز بكسل الامتزاج من بكسل الحافّة المنعّمة نحو الأبيض: الأول داخليّ
   فألفاه مصمتة في النسخة البيضاء، والثاني ألفاه جزئية. */
const cls=new Int8Array(W*H), alpha=new Float32Array(W*H);
const BOTH=3;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const gx=X0+x, gy=Y0+y, a=a2(gx,gy); const i=y*W+x; alpha[i]=a;
  if(a<8){cls[i]=0;continue;}
  const [fx,fy]=to1(gx,gy);
  let best=null,bs=-1;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const c=px1(Math.min(m1.w-1,Math.max(0,fx+dx)),Math.min(m1.h-1,Math.max(0,fy+dy)));
    const sat=Math.max(c[0],c[1],c[2])-Math.min(c[0],c[1],c[2]);
    if(sat>bs){bs=sat;best=c;}
  }
  /* الامتزاج الحقيقي يقع على الخطّ الواصل بين اللونين؛ أما الحافّة المنعّمة
     فتميل نحو الأبيض فتبتعد عن ذلك الخطّ. نُسقط اللون على الخطّ ونقيس البُعد
     العمودي — فيتمايز الاثنان بلا لبس. */
  const D=[TEAL[0]-PLUM[0],TEAL[1]-PLUM[1],TEAL[2]-PLUM[2]];
  const L2=D[0]*D[0]+D[1]*D[1]+D[2]*D[2];
  const v=[best[0]-PLUM[0],best[1]-PLUM[1],best[2]-PLUM[2]];
  const t=(v[0]*D[0]+v[1]*D[1]+v[2]*D[2])/L2;
  const perp=Math.hypot(v[0]-t*D[0], v[1]-t*D[1], v[2]-t*D[2]);
  void perp; cls[i] = t<0.5 ? 1 : 2;
}

const F={1:new Float32Array(W*H),2:new Float32Array(W*H)};
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=y*W+x, c=cls[i]; if(!c) continue;
  F[c][i]=alpha[i];
}
// تداخل بكسل واحد عند الحدود بين المجموعتين فلا يظهر شقّ أبيض
for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
  const i=y*W+x; if(!cls[i]) continue;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const j=(y+dy)*W+(x+dx); if(!cls[j]) continue;
    F[cls[j]][i]=Math.max(F[cls[j]][i],alpha[i]*0.999);
  }
}

/* مربّعات ساجة (marching squares) بتقاطع خطّي — يعطي حوافّ دون-بكسلية ناعمة،
   والحلقات المتداخلة تتكفّل بها قاعدة even-odd في SVG. */
function contours(f,T=128){
  const P=(x,y)=>(x<0||y<0||x>=W||y>=H)?0:f[y*W+x];
  const ip=(a,b)=>(T-a)/(b-a||1e-6);
  const seg=[];
  for(let y=-1;y<H;y++)for(let x=-1;x<W;x++){
    const v=[P(x,y),P(x+1,y),P(x+1,y+1),P(x,y+1)];
    const k=(v[0]>=T?1:0)|(v[1]>=T?2:0)|(v[2]>=T?4:0)|(v[3]>=T?8:0);
    if(k===0||k===15) continue;
    const T_=[x+ip(v[0],v[1]),y], R=[x+1,y+ip(v[1],v[2])],
          B=[x+ip(v[3],v[2]),y+1], L=[x,y+ip(v[0],v[3])];
    const add=(a,b)=>seg.push([a,b]);
    switch(k){
      case 1: add(L,T_);break; case 2: add(T_,R);break; case 3: add(L,R);break;
      case 4: add(R,B);break;  case 5: add(L,B); add(T_,R);break; case 6: add(T_,B);break;
      case 7: add(L,B);break;  case 8: add(B,L);break; case 9: add(B,T_);break;
      case 10: add(L,T_); add(R,B);break; case 11: add(B,R);break;
      case 12: add(R,L);break; case 13: add(R,T_);break; case 14: add(T_,L);break;
    }
  }
  // وصل القطع في حلقات مغلقة — بالفهارس، وبتسامح في مطابقة النقاط
  const K=(p)=>`${Math.round(p[0]*1000)},${Math.round(p[1]*1000)}`;
  const startAt=new Map();
  seg.forEach((s,i)=>{ const k=K(s[0]); if(!startAt.has(k)) startAt.set(k,[]); startAt.get(k).push(i); });
  const used=new Uint8Array(seg.length), loops=[];
  for(let i0=0;i0<seg.length;i0++){
    if(used[i0]) continue;
    used[i0]=1;
    const loop=[seg[i0][0], seg[i0][1]];
    let tail=seg[i0][1];
    for(let guard=0; guard<seg.length+5; guard++){
      const cand=(startAt.get(K(tail))||[]).find(j=>!used[j]);
      if(cand===undefined) break;
      used[cand]=1; tail=seg[cand][1]; loop.push(tail);
      if(K(tail)===K(loop[0])) break;
    }
    if(loop.length>10) loops.push(loop);
  }
  return loops;
}

// تبسيط Douglas–Peucker ثم تنعيم Chaikin
function dpOpen(pts,e){ if(pts.length<3)return pts;
  const d=(p,a,b)=>{const A=b[0]-a[0],B=b[1]-a[1],L=Math.hypot(A,B);
    if(L<1e-9) return Math.hypot(p[0]-a[0],p[1]-a[1]);
    return Math.abs(A*(a[1]-p[1])-B*(a[0]-p[0]))/L;};
  let mi=0,md=0; for(let i=1;i<pts.length-1;i++){const dd=d(pts[i],pts[0],pts.at(-1)); if(dd>md){md=dd;mi=i;}}
  return md>e ? [...dpOpen(pts.slice(0,mi+1),e).slice(0,-1),...dpOpen(pts.slice(mi),e)] : [pts[0],pts.at(-1)];
}
/* الحلقة مغلقة، فبدايتها = نهايتها وخطّ الأساس منعدم الطول — لذا نقسمها عند
   أبعد نقطة عن البداية ونبسّط نصفيها، وإلا انهارت كل حلقة إلى نقطتين. */
function dpClosed(pts,e){
  const p = (pts.length>1 && pts[0][0]===pts.at(-1)[0] && pts[0][1]===pts.at(-1)[1]) ? pts.slice(0,-1) : pts;
  if(p.length<4) return p;
  let fi=0,fd=-1;
  for(let i=1;i<p.length;i++){const dd=Math.hypot(p[i][0]-p[0][0],p[i][1]-p[0][1]); if(dd>fd){fd=dd;fi=i;}}
  const a=dpOpen(p.slice(0,fi+1),e), b=dpOpen([...p.slice(fi),p[0]],e);
  return [...a.slice(0,-1),...b.slice(0,-1)];
}
function chaikin(p){ const o=[];
  for(let i=0;i<p.length;i++){ const a=p[i],b=p[(i+1)%p.length];
    o.push([a[0]*0.75+b[0]*0.25,a[1]*0.75+b[1]*0.25],[a[0]*0.25+b[0]*0.75,a[1]*0.25+b[1]*0.75]); }
  return o; }

const S=2, r=(v)=>Math.round(v*S*100)/100;   // 1 بكسل مصدر = 2 وحدة SVG
const toPath=(loops)=>loops.map(l=>{
  let q=dpClosed(l,0.30); if(q.length>3) q=chaikin(q);
  return 'M'+q.map(v=>`${r(v[0])} ${r(v[1])}`).join('L')+'Z';
}).join('');

const plumLoops=contours(F[1]), tealAll=contours(F[2]);
const cx=(W-1)/2, cy=(H-1)/2;
/* المعيّن الأوسط: الحلقة الوحيدة المحصورة كلّها في قلب الشعار — نفصلها
   لتتفتّح وحدها بعد أن يلتقي القوسان، كما في الشعار الأصلي. */
const isSeed=(l)=>{
  const xs=l.map(p=>p[0]), ys=l.map(p=>p[1]);
  return Math.min(...xs)>cx-W*0.18 && Math.max(...xs)<cx+W*0.18
      && Math.min(...ys)>cy-H*0.42 && Math.max(...ys)<cy+H*0.42;
};
const seedLoops=tealAll.filter(isSeed), tealLoops=tealAll.filter(l=>!isSeed(l));
const VW=r(W-1), VH=r(H-1);

const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" role="img" aria-labelledby="clubLogoTitle">
  <title id="clubLogoTitle">شعار نادي الثقافة والأدب</title>
  <path class="club-mark-plum" fill="#612775" fill-rule="evenodd" d="${toPath(plumLoops)}"/>
  <path class="club-mark-teal" fill="#73a2b1" fill-rule="evenodd" d="${toPath(tealLoops)}"/>
  <path class="club-mark-seed" fill="#73a2b1" fill-rule="evenodd" d="${toPath(seedLoops)}"/>
</svg>`;
fs.writeFileSync(`${SP}/mark-traced.svg`, svg);
console.log(`viewBox 0 0 ${VW} ${VH}  (نسبة ${(VW/VH).toFixed(2)})`);
console.log(`حلقات: بنفسجي=${plumLoops.length} فيروزي=${tealLoops.length} معيّن=${seedLoops.length}`);
console.log(`الحجم: ${(svg.length/1024).toFixed(1)}KB`);
