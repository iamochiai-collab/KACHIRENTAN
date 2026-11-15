// =====================================================
//  カチレンタン  — 価値観トップ3を当てろ！
//  ・1台を回して遊ぶモード
//  ・みんなのスマホで遊ぶモード（Firebase Realtime Database）
// =====================================================
const $ = id => document.getElementById(id);
const app = $("app");
const THEMES = window.THEMES;
const THEMES_DEEP = window.THEMES_DEEP || [];
// お題の種類：ふつう / DEEP / ミックス
const KINDS = [["normal","ふつう"],["deep","DEEP"],["mix","ミックス"]];
const themeIds = kind => {
  const n=THEMES.map((_,i)=>"n"+i), d=THEMES_DEEP.map((_,i)=>"d"+i);
  return kind==="deep"?d : kind==="mix"?n.concat(d) : n;
};
const themeById = id => { const deep=id[0]==="d"; const t=(deep?THEMES_DEEP:THEMES)[+id.slice(1)]; return {q:t[0],opts:t[1].slice(),custom:false,deep,id}; };
const kindLabel = k => (KINDS.find(x=>x[0]===k)||KINDS[0])[1];
function kindSegHTML(cur){
  return `<div class="seg kind">${KINDS.map(([k,l])=>`<button data-k="${k}" class="${cur===k?"on":""} ${k}">${l}</button>`).join("")}</div>
  <p class="muted" style="margin:8px 0 0">${cur==="deep"?"🔥 DEEP：恋愛・お金・本音など、仲良しメンバー向けの深めのお題（"+THEMES_DEEP.length+"問）":cur==="mix"?"ふつうとDEEPがまざって出ます（"+(THEMES.length+THEMES_DEEP.length)+"問）":"だれとでも遊べるお題（"+THEMES.length+"問）"}</p>`;
}
const LET = ["A","B","C","D","E","F","G"];
const RK = ["1着","2着","3着"];
const LCOL = [["#ffffff","#333","#bbb"],["#222","#fff","#222"],["#d7263d","#fff","#d7263d"],["#1d4ed8","#fff","#1d4ed8"],["#f5d90a","#333","#e0c400"],["#2f9e44","#fff","#2f9e44"],["#f08c2e","#fff","#f08c2e"]];
const MAX_ONLINE = 10;
// プレイヤーの顔アイコン（img/av/av-01.png 〜 av-32.png）
const AVATARS = Array.from({length:32},(_,i)=>"av"+String(i+1).padStart(2,"0"));
const imgSrc = n => (window.IMG_DATA&&window.IMG_DATA[n]) || `img/${n}.png`;
const avSrc = v => (window.AV_DATA&&window.AV_DATA[v]) || `img/av/av-${String(v||"av01").slice(2)}.png`;
const avHTML = (v,cls="") => `<img class="av ${cls}" src="${avSrc(AVATARS.includes(v)?v:"av01")}" alt="">`;
const pickAv = used => { const u=new Set(used); const free=AVATARS.filter(a=>!u.has(a)); return shuffle(free.length?free:AVATARS)[0]; };
// アイコンをえらぶ画面
function showAvPicker(current, used, onPick){
  const bg=document.createElement("div"); bg.className="modal-bg";
  const u=new Set(used);
  bg.innerHTML=`<div class="modal"><h2>アイコンをえらぶ</h2>
    <div class="avgrid">${AVATARS.map(a=>`<button data-av="${a}" class="${a===current?"on":""}" ${u.has(a)&&a!==current?"disabled":""}>${avHTML(a)}</button>`).join("")}</div>
    <div class="gap"></div><button class="btn ghost" id="closeAv">とじる</button></div>`;
  document.body.appendChild(bg);
  bg.addEventListener("click",e=>{
    const b=e.target.closest("[data-av]");
    if(b && !b.disabled){ bg.remove(); onPick(b.dataset.av); return; }
    if(e.target===bg||e.target.id==="closeAv") bg.remove();
  });
}

// ===================== 共通 =====================
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const shuffle = a => { a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const letB = (i,cls="let") => `<span class="${cls}" style="background:${LCOL[i][0]};color:${LCOL[i][1]};border:2px solid ${LCOL[i][2]}">${LET[i]}</span>`;
const store = {
  get(k,d){ try{ const v=localStorage.getItem(k); return v===null?d:JSON.parse(v); }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
};
function toast(msg){ const t=document.createElement("div"); t.className="toast"; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2000); }
function scrollTop(){ window.scrollTo(0,0); }

function judge(g,a){
  if(g[0]===a[0]&&g[1]===a[1]&&g[2]===a[2]) return {pt:6,name:"サンレンタン"};
  const common = g.filter(x=>a.includes(x)).length;
  if(common===3) return {pt:4,name:"サンレンプク"};
  if(g[0]===a[0]&&g[1]===a[1]) return {pt:3,name:"ニレンタン"};
  if(common===2) return {pt:2,name:"プクプク"};
  if(common===1) return {pt:1,name:"タン"};
  return {pt:0,name:"ハズレ"};
}

function showRules(){
  const bg=document.createElement("div"); bg.className="modal-bg";
  bg.innerHTML=`<div class="modal">
    <h2>🏇 あそびかた</h2>
    <ol>
      <li>出題者がお題を引く（7つの選択肢 A〜G）。</li>
      <li>出題者は、自分の<b>本当の気持ち</b>で1着・2着・3着を決める（ほかの人に見せない）。</li>
      <li>ほかのプレイヤーは、出題者のトップ3を予想する。</li>
      <li>結果発表！みんなの予想と正解を、3着→2着→1着の順にめくっていく。</li>
      <li>当たり方で得点。出題者を交代して、全員が出題したら合計点で勝負。</li>
    </ol>
    <h2>🎯 得点</h2>
    <table class="pt-table">
      <tr><td>サンレンタン</td><td>3つとも順位までぴったり</td><td>6点</td></tr>
      <tr><td>サンレンプク</td><td>3つとも当たり（順位はちがう）</td><td>4点</td></tr>
      <tr><td>ニレンタン</td><td>1着と2着がぴったり</td><td>3点</td></tr>
      <tr><td>プクプク</td><td>2つ当たり（順位は関係なし）</td><td>2点</td></tr>
      <tr><td>タン</td><td>1つ当たり</td><td>1点</td></tr>
    </table>
    <p class="muted">いちばん高い役だけが入ります。</p>
    <button class="btn ghost" id="closeR">とじる</button>
  </div>`;
  document.body.appendChild(bg);
  bg.addEventListener("click",e=>{ if(e.target===bg||e.target.id==="closeR") bg.remove(); });
}

function confetti(){
  const colors=["#f2b705","#d7263d","#2463eb","#ffffff","#3aa66b","#ff8fab"];
  for(let i=0;i<70;i++){
    const c=document.createElement("div"); c.className="confetti";
    c.style.left=Math.random()*100+"vw"; c.style.background=colors[i%colors.length];
    c.style.animationDuration=(2+Math.random()*2)+"s"; c.style.animationDelay=(Math.random()*.6)+"s";
    c.style.borderRadius=Math.random()<.4?"50%":"2px";
    document.body.appendChild(c); setTimeout(()=>c.remove(),5000);
  }
}

// ---------- 画面パーツ ----------
function bannerHTML(top, name, sub, av){
  return `<div class="qbanner"><small>${top}</small>${av?avHTML(av,"bav"):""}<div class="qn">${esc(name)}<span>さん</span></div>${sub?`<div class="sub">${sub}</div>`:""}</div>`;
}
function themeCardHTML(theme, tag){
  return `<div class="card">
    <span class="theme-tag ${theme.deep?"deep":""}">${theme.deep?"🔥 DEEP":tag}</span>
    <div class="theme-q ${theme.deep?"deep":""}">${esc(theme.q)}</div>
    <div class="opts">${theme.opts.map((o,i)=>`<div class="opt static">${letB(i)}${esc(o)}</div>`).join("")}</div>
  </div>`;
}
function pickHTML(theme, pick, note){
  const slot=r=>{ const v=pick[r]; return `<div class="slot ${v!==undefined?"f s"+(r+1):""}" data-slot="${r}"><div class="rk">${RK[r]}</div><div class="v">${v!==undefined?letB(v,"mini")+esc(theme.opts[v]):"？"}</div></div>`; };
  return `<div class="card">
    <div class="theme-q ${theme.deep?"deep":""}" style="margin-top:-6px">${esc(theme.q)}</div>
    <p class="muted" style="margin:6px 0 0">${note}</p>
    <div class="slots">${slot(0)}${slot(1)}${slot(2)}</div>
    <div class="opts">${theme.opts.map((o,i)=>{ const r=pick.indexOf(i); return `<button class="opt ${r>=0?"sel r"+(r+1):""}" data-o="${i}">${letB(i)}${esc(o)}${r>=0?`<span class="badge">${RK[r]}</span>`:""}</button>`; }).join("")}</div>
  </div>`;
}
// pick配列を直接いじって、変わったら onChange()
function bindPick(pick, onChange){
  app.querySelectorAll("[data-o]").forEach(b=>b.onclick=()=>{
    const i=+b.dataset.o, r=pick.indexOf(i);
    if(r>=0) pick.splice(r,1); else if(pick.length<3) pick.push(i); else { toast("3つまで。外すときはもう一度タップ"); return; }
    onChange();
  });
  app.querySelectorAll("[data-slot]").forEach(s=>s.onclick=()=>{ const r=+s.dataset.slot; if(pick[r]!==undefined){ pick.splice(r,1); onChange(); } });
}
function customFormHTML(prev){
  prev = prev && prev.custom ? prev : {q:"",opts:Array(7).fill("")};
  return `<div class="card">
    <h2>✏️ オリジナルお題</h2>
    <input class="field" id="cq" maxlength="40" placeholder="例：魔法が使えたら何をする？" value="${esc(prev.q)}">
    ${LET.map((l,i)=>`<div class="cus-row">${letB(i)}<input class="field co" maxlength="20" placeholder="選択肢${l}" value="${esc(prev.opts[i])}"></div>`).join("")}
  </div>
  <button class="btn" id="cok">このお題にする</button>
  <div class="gap"></div>
  <button class="btn ghost small" id="ccancel">やめる</button>`;
}
function readCustom(){
  const q=$("cq").value.trim(); const opts=[...app.querySelectorAll(".co")].map(i=>i.value.trim());
  if(!q){ toast("お題を入れてね"); return null; }
  if(opts.some(o=>!o)){ toast("選択肢を7つ全部入れてね"); return null; }
  if(new Set(opts).size!==7){ toast("同じ選択肢があります"); return null; }
  return {q,opts,custom:true};
}

// 結果発表 step: 0=全部ふせ, 1=予想3着, 2=正解3着, 3=予想2着, 4=正解2着, 5=予想1着, 6=正解1着
const G_OPEN = {2:1,1:3,0:5}, A_OPEN = {2:2,1:4,0:6};
const REVEAL_LABELS = [
  "🎫 みんなの3着予想をオープン！","🥉 正解の3着は…？",
  "🎫 みんなの2着予想をオープン！","🥈 正解の2着は…？",
  "🎫 みんなの1着予想をオープン！","🥇 いよいよ正解の1着！"];
function cellHTML(theme, x, r, open, cls, isNew){
  if(!open) return `<div class="cell"><div class="rk">${RK[r]}</div><div class="q">？</div></div>`;
  return `<div class="cell ${cls} ${isNew?"pop":""}"><div class="rk">${RK[r]}</div><div class="v">${letB(x,"mini")}${esc(theme.opts[x])}</div></div>`;
}
function ticketHTML(theme, name, g, answer, step, av){
  const openAns=[0,1,2].filter(r=>step>=A_OPEN[r]).map(r=>answer[r]);
  let head="<small>三連単 投票券</small>";
  if(step>=6){
    const j=judge(g,answer);
    head=`<span class="stamp ${j.pt===6?"big":j.pt?"":"zero"}">${j.name} ${j.pt}点</span>`;
  }
  const cells=[0,1,2].map(r=>{
    const open=step>=G_OPEN[r]; const x=g[r];
    let cls="";
    if(open){
      if(step>=A_OPEN[r] && x===answer[r]) cls="hitpos";
      else if(openAns.includes(x)) cls="hitset";
    }
    return cellHTML(theme,x,r,open,cls,step===G_OPEN[r]);
  }).join("");
  return `<div class="ticket"><div class="perf"></div>
    <div class="th"><span>${av?avHTML(av):""}${esc(name)} の予想</span>${head}</div>
    <div class="tb">${cells}</div></div>`;
}
function answerCardHTML(theme, qName, answer, step, av){
  const cells=[0,1,2].map(r=>cellHTML(theme,answer[r],r,step>=A_OPEN[r],"",step===A_OPEN[r])).join("");
  return `<div class="anscard"><div class="ah"><span>🏁 正解</span><b>${av?avHTML(av):""}${esc(qName)}さんの答え</b></div><div class="tb">${cells}</div></div>`;
}
// list: [{id,name,score,plus?,note?}]
function ranked(list){
  const arr=list.slice().sort((a,b)=>b.score-a.score);
  let rank=0,prev=null; arr.forEach((p,k)=>{ if(p.score!==prev){rank=k+1;prev=p.score;} p.rank=rank; });
  return arr;
}
function scoreTableHTML(r){
  return `<table class="sc">${r.map(p=>`<tr class="${p.rank===1?"lead":""}"><td><span class="rkb ${p.rank<=3?"g"+p.rank:""}">${p.rank}</span>${p.av?avHTML(p.av):""}${esc(p.name)}${p.note?` <span class="muted">${p.note}</span>`:""}</td><td class="p">${p.score}<span style="font-size:13px">点</span> ${p.plus?`<small>+${p.plus}</small>`:""}</td></tr>`).join("")}</table>`;
}
function podiumHTML(r){
  const top=[1,0,2].map(k=>r[k]).filter(Boolean);
  return `<div class="hero" style="padding:16px 0 4px"><div class="logo" style="font-size:34px">🏆 最終結果</div></div>
  <div class="podium">${top.map(p=>`<div class="pod p${Math.min(p.rank,3)}"><div class="nm">${p.rank===1?"👑":""}${p.av?avHTML(p.av,"pav"):""}${esc(p.name)}</div><div class="blk">${p.rank}<small>${p.score}点</small></div></div>`).join("")}</div>
  <div class="card">${scoreTableHTML(r)}</div>`;
}

// ===================== ホーム =====================
function viewHome(){
  scrollTop();
  app.innerHTML=`
  <div class="hero">
    <img class="hero-horse" src="${imgSrc("horse")}" alt="">
    <div class="logo">カチ<span>レン</span>タン</div>
    <div class="tag">あの人の価値観、当てられる？</div>
  </div>
  <button class="mode" id="mOnline"><img class="ic" src="${imgSrc("online")}" alt=""><div><b>みんなのスマホで</b><span>部屋を作って、URLを送って集まる（2〜${MAX_ONLINE}人）</span></div></button>
  <button class="mode" id="mPass"><img class="ic" src="${imgSrc("pass")}" alt=""><div><b>1台を回して遊ぶ</b><span>スマホ1台を手わたしで（2〜6人）</span></div></button>
  <button class="btn ghost" id="rules">あそびかた</button>`;
  $("mOnline").onclick=()=>{
    // claude.ai のページ版では通信できないので、公開サイトへ案内
    if(window.PASS_ONLY){ location.href="https://iamochiai-collab.github.io/KACHIRENTAN/"; return; }
    viewOnlineEntry("");
  };
  $("mPass").onclick=P.viewSetup;
  $("rules").onclick=showRules;
}

// =====================================================
//  1台を回して遊ぶモード
// =====================================================
const P = (()=>{
  const S = { names: store.get("srt_names",["",""]), avs: store.get("krt_avs",[]), kind: store.get("krt_kind","normal"), laps:1, players:[], round:0, totalRounds:0,
    deck:[], theme:null, answer:[], guesses:{}, order:[], gi:0, pick:[], revealStep:0, roundPts:{} };
  if(!Array.isArray(S.names)||S.names.length<2) S.names=["",""];
  if(!Array.isArray(S.avs)) S.avs=[];
  const fixAvs=()=>{ S.avs.length=Math.min(S.avs.length,S.names.length); for(let i=0;i<S.names.length;i++){ if(!AVATARS.includes(S.avs[i])||S.avs.indexOf(S.avs[i])<i) S.avs[i]=pickAv(S.avs.filter((_,k)=>k!==i)); } };
  const qAv=()=>S.players[qIdx()].av;
  const qIdx=()=>S.round % S.players.length;
  const qName=()=>S.players[qIdx()].name;
  const header=()=>`<div class="bar"><span class="race">第${S.round+1}レース / 全${S.totalRounds}</span><button class="iconbtn" id="hrules">ルール</button></div>`;
  const bindHeader=()=>{ const h=$("hrules"); if(h) h.onclick=showRules; };

  function viewSetup(){
    scrollTop();
    fixAvs();
    const rows=S.names.map((n,i)=>`
      <div class="player-row"><button class="avbtn" data-avi="${i}">${avHTML(S.avs[i])}</button>
        <input data-i="${i}" maxlength="8" placeholder="プレイヤー${i+1}" value="${esc(n)}">
        ${S.names.length>2?`<button class="del" data-del="${i}">×</button>`:""}</div>`).join("");
    app.innerHTML=`
    <div class="bar"><span class="race">1台モード</span><button class="iconbtn" id="back">← もどる</button></div>
    <div class="card"><h2>プレイヤー</h2>${rows}
      ${S.names.length<6?`<button class="btn ghost small" id="add">＋ プレイヤーを追加</button>`:`<p class="muted center">最大6人です</p>`}</div>
    <div class="card"><h2>お題の種類</h2>${kindSegHTML(S.kind)}</div>
    <div class="card"><h2>何周する？</h2>
      <div class="seg">${[1,2,3].map(n=>`<button data-l="${n}" class="${S.laps===n?"on":""}">${n}周</button>`).join("")}</div>
      <p class="muted" style="margin:8px 0 0">1周 ＝ 全員が1回ずつ出題（${S.names.length*S.laps}レース）</p></div>
    <button class="btn" id="start">スタート！</button>`;
    $("back").onclick=viewHome;
    app.querySelectorAll("input[data-i]").forEach(inp=>inp.oninput=()=>{S.names[+inp.dataset.i]=inp.value;});
    app.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{S.names.splice(+b.dataset.del,1);S.avs.splice(+b.dataset.del,1);viewSetup();});
    app.querySelectorAll("[data-avi]").forEach(b=>b.onclick=()=>{ const i=+b.dataset.avi; showAvPicker(S.avs[i],S.avs,a=>{ S.avs[i]=a; store.set("krt_avs",S.avs); viewSetup(); }); });
    const add=$("add"); if(add) add.onclick=()=>{S.names.push("");viewSetup(); const ins=app.querySelectorAll("input[data-i]"); ins[ins.length-1].focus();};
    app.querySelectorAll("[data-l]").forEach(b=>b.onclick=()=>{S.laps=+b.dataset.l;viewSetup();});
    app.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{S.kind=b.dataset.k;store.set("krt_kind",S.kind);viewSetup();});
    $("start").onclick=()=>{
      const names=S.names.map((n,i)=>n.trim()||`プレイヤー${i+1}`);
      if(new Set(names).size!==names.length){ toast("同じ名前があります"); return; }
      S.names=names; store.set("srt_names",names); store.set("krt_avs",S.avs);
      S.players=names.map((n,i)=>({name:n,score:0,av:S.avs[i]}));
      S.round=0; S.totalRounds=names.length*S.laps; S.deck=shuffle(themeIds(S.kind));
      startRound();
    };
  }
  function drawTheme(){
    if(!S.deck.length) S.deck=shuffle(themeIds(S.kind));
    S.theme=themeById(S.deck.pop());
  }
  function startRound(){
    S.answer=[]; S.guesses={}; S.pick=[]; S.revealStep=0; S.roundPts={};
    const q=qIdx(), n=S.players.length;
    S.order=[]; for(let k=1;k<n;k++) S.order.push((q+k)%n);
    S.gi=0; drawTheme();
    viewCover(q,true,viewTheme);
  }
  function viewCover(pi, isQ, next){
    scrollTop();
    app.innerHTML=`${header()}
    <div class="cover">${avHTML(S.players[pi].av,"av-big")}
      <div class="who"><b>${esc(S.players[pi].name)}</b> さん</div>
      <p>${isQ?"今回の出題者です。スマホを受け取ってね":`<b style="font-size:22px;background:#fff;color:var(--turf-dark);padding:2px 10px;border-radius:8px">${esc(qName())}さん</b> のトップ3を<br>予想する番です`}<br>（ほかの人は画面を見ないでね）</p>
      <div class="gap"></div>
      <button class="btn gold" id="open">${esc(S.players[pi].name)}さんです　ひらく</button></div>`;
    bindHeader(); $("open").onclick=next;
  }
  function viewTheme(){
    scrollTop();
    app.innerHTML=`${header()}${bannerHTML("今回の出題者",qName(),"お題を決めてね",qAv())}
    ${themeCardHTML(S.theme, S.theme.custom?"オリジナルお題":"今回のお題")}
    <button class="btn" id="ok">このお題で決める</button><div class="gap"></div>
    <div class="row"><button class="btn ghost small" id="redraw">🔄 引き直す</button><button class="btn ghost small" id="custom">✏️ 自分で作る</button></div>`;
    bindHeader();
    $("ok").onclick=()=>{ S.pick=[]; viewPick(qIdx(),true); };
    $("redraw").onclick=()=>{ drawTheme(); viewTheme(); };
    $("custom").onclick=viewCustom;
  }
  function viewCustom(){
    scrollTop();
    app.innerHTML=header()+customFormHTML(S.theme);
    bindHeader();
    $("ccancel").onclick=viewTheme;
    $("cok").onclick=()=>{ const t=readCustom(); if(t){ S.theme=t; viewTheme(); } };
  }
  function viewPick(pi, isQ, keep){
    const y=window.scrollY;
    const name=S.players[pi].name;
    app.innerHTML=`${header()}
    ${isQ?bannerHTML("出題者",qName(),"自分の本当の気持ちで答えてね",qAv()):bannerHTML("この人のトップ3を予想！",qName(),`予想する人：${avHTML(S.players[pi].av)}${esc(name)}さん`,qAv())}
    ${pickHTML(S.theme,S.pick,isQ?"1着→2着→3着の順にタップしてね。":`<b>${esc(qName())}</b>さんなら、どれを選ぶ？ 1着→2着→3着の順にタップ。`)}
    <button class="btn" id="ok" ${S.pick.length<3?"disabled":""}>${isQ?"これで決定！":"この馬券で勝負！"}</button>
    <div class="gap"></div><button class="btn ghost small" id="clear">リセット</button>`;
    if(keep) window.scrollTo(0,y); else scrollTop();
    bindHeader();
    bindPick(S.pick,()=>viewPick(pi,isQ,true));
    $("clear").onclick=()=>{ S.pick.length=0; viewPick(pi,isQ,true); };
    $("ok").onclick=()=>{
      if(S.pick.length<3) return;
      if(isQ) S.answer=S.pick.slice(); else { S.guesses[pi]=S.pick.slice(); S.gi++; }
      S.pick=[];
      if(S.gi<S.order.length) viewHandoff(S.order[S.gi]);
      else { S.revealStep=0; scrollTop(); viewReveal(); }
    };
  }
  function viewHandoff(pi){
    scrollTop();
    app.innerHTML=`${header()}
    <div class="cover"><img class="cover-pass" src="${imgSrc("pass")}" alt=""><div class="who">決まりました！</div>${avHTML(S.players[pi].av,"av-big")}
      <p>画面をかくして、<br><b style="font-size:20px">${esc(S.players[pi].name)}</b> さんにわたしてね</p>
      <div class="gap"></div><button class="btn gold" id="open">わたした！</button></div>`;
    bindHeader();
    $("open").onclick=()=>viewCover(pi,false,()=>{ S.pick=[]; viewPick(pi,false); });
  }
  function viewReveal(){
    const step=S.revealStep, done=step>=6;
    app.innerHTML=`${header()}
    ${step===0?bannerHTML("結果発表！",qName(),"の答えは…？",qAv()):""}
    <p class="theme-mini">お題：${esc(S.theme.q)}</p>
    ${answerCardHTML(S.theme,qName(),S.answer,step,qAv())}
    ${S.order.map(pi=>ticketHTML(S.theme,S.players[pi].name,S.guesses[pi],S.answer,step,S.players[pi].av)).join("")}
    <div class="sticky-btn">${done?`<button class="btn" id="next">得点を見る</button>`:`<button class="btn ${step%2===1?"gold":""}" id="next">${REVEAL_LABELS[step]}</button>`}</div>`;
    bindHeader();
    if(done){
      let best=0;
      S.order.forEach(pi=>{ const j=judge(S.guesses[pi],S.answer); S.roundPts[pi]=j.pt; best=Math.max(best,j.pt); });
      if(best===6) confetti();
      $("next").onclick=()=>{ Object.entries(S.roundPts).forEach(([pi,pt])=>S.players[pi].score+=pt); viewScore(); };
    } else {
      $("next").onclick=()=>{ const y=window.scrollY; S.revealStep++; viewReveal(); window.scrollTo(0,y); };
    }
  }
  function viewScore(){
    scrollTop();
    const last=S.round+1>=S.totalRounds;
    const r=ranked(S.players.map((p,i)=>({name:p.name,av:p.av,score:p.score,plus:S.roundPts[i],note:i===qIdx()?"(出題)":""})));
    app.innerHTML=`${header()}
    <div class="card"><h2>📋 第${S.round+1}レース 終了</h2>${scoreTableHTML(r)}</div>
    ${last?`<button class="btn gold" id="next">🏆 最終結果へ</button>`:
      `<p class="center" style="color:#fff;font-weight:900">次の出題者は <span style="background:var(--gold);color:#3b2a00;padding:2px 10px;border-radius:8px">${avHTML(S.players[(S.round+1)%S.players.length].av)}${esc(S.players[(S.round+1)%S.players.length].name)}</span> さん</p>
       <button class="btn" id="next">次のレースへ</button>`}`;
    bindHeader();
    $("next").onclick=()=>{ if(last) viewFinal(); else { S.round++; startRound(); } };
  }
  function viewFinal(){
    scrollTop();
    app.innerHTML=`${podiumHTML(ranked(S.players.map(p=>({name:p.name,av:p.av,score:p.score}))))}
    <button class="btn" id="again">同じメンバーでもう一回</button><div class="gap"></div>
    <button class="btn ghost" id="home">タイトルへ</button>`;
    confetti();
    $("again").onclick=()=>{ S.players.forEach(p=>p.score=0); S.round=0; S.deck=shuffle(themeIds(S.kind)); startRound(); };
    $("home").onclick=viewHome;
  }
  return { viewSetup };
})();

// =====================================================
//  みんなのスマホで遊ぶモード
// =====================================================
function setPath(o,path,v){
  const ks=path.split("/"); let cur=o;
  for(let i=0;i<ks.length-1;i++){ if(cur[ks[i]]==null||typeof cur[ks[i]]!=="object") cur[ks[i]]={}; cur=cur[ks[i]]; }
  const last=ks[ks.length-1];
  if(v===null||v===undefined) delete cur[last]; else cur[last]=JSON.parse(JSON.stringify(v));
}
function makeBackend(){
  const c=window.FIREBASE_CONFIG||{};
  if(c.databaseURL && window.firebase){
    try{
      firebase.initializeApp(c);
      const db=firebase.database();
      return {
        demo:false,
        async get(id){ const s=await db.ref("rooms/"+id).get(); return s.val(); },
        set(id,v){ return db.ref("rooms/"+id).set(v); },
        update(id,p){ return db.ref("rooms/"+id).update(p); },
        listen(id,cb){ const r=db.ref("rooms/"+id); const h=s=>cb(s.val()); r.on("value",h); return ()=>r.off("value",h); },
        presence(id,pid){
          const con=db.ref(".info/connected"); const me=db.ref(`rooms/${id}/players/${pid}/online`);
          const h=s=>{ if(s.val()===true){ me.onDisconnect().set(false); me.set(true); } };
          con.on("value",h);
          return ()=>{ con.off("value",h); me.onDisconnect().cancel(); };
        }
      };
    }catch(e){ console.error(e); }
  }
  // ---- デモモード（同じブラウザのタブ同士） ----
  const subs={}; const key=id=>"krt_room_"+id;
  const read=id=>store.get(key(id),null);
  const fire=id=>(subs[id]||[]).forEach(cb=>cb(read(id)));
  const bc=("BroadcastChannel" in window)?new BroadcastChannel("kachirentan"):null;
  if(bc) bc.onmessage=e=>fire(e.data);
  else window.addEventListener("storage",e=>{ if(e.key&&e.key.startsWith("krt_room_")) fire(e.key.slice(9)); });
  const write=(id,v)=>{ if(v===null) localStorage.removeItem(key(id)); else store.set(key(id),v); if(bc) bc.postMessage(id); fire(id); };
  return {
    demo:true,
    async get(id){ return read(id); },
    async set(id,v){ write(id,v); },
    async update(id,p){ const o=read(id); if(!o) return; for(const [k,v] of Object.entries(p)) setPath(o,k,v); write(id,o); },
    listen(id,cb){ (subs[id]=subs[id]||[]).push(cb); setTimeout(()=>cb(read(id)),0); return ()=>{ subs[id]=(subs[id]||[]).filter(x=>x!==cb); }; },
    presence(id,pid){
      const mark=v=>{ const o=read(id); if(o&&o.players&&o.players[pid]){ o.players[pid].online=v; write(id,o); } };
      mark(true); const off=()=>mark(false);
      window.addEventListener("pagehide",off);
      return ()=>window.removeEventListener("pagehide",off);
    }
  };
}

const O = { be:null, id:null, pid:null, room:null, unsub:null, unpres:null, lastHTML:"", lastKey:"",
  L:{ roundKey:"", stage:"theme", draft:null, pick:[], gpick:[], gKey:"", editing:false, advKey:"", confKey:"" } };

const genId = (n,chars) => Array.from({length:n},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
const CODE_CHARS="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function viewOnlineEntry(prefill){
  scrollTop();
  if(!O.be) O.be=makeBackend();
  const name=store.get("krt_name","");
  app.innerHTML=`
  <div class="bar"><span class="race">みんなのスマホで</span><button class="iconbtn" id="back">← もどる</button></div>
  ${O.be.demo?`<div class="demo-note">⚠️ いまは<b>デモモード</b>です（Firebase未設定）。同じブラウザの別タブ同士でだけ遊べます。</div>`:""}
  <div class="card">
    <h2>あなたの名前</h2>
    <input class="field" id="nm" maxlength="8" placeholder="なまえ" value="${esc(name)}" style="font-size:20px;font-weight:900">
  </div>
  ${prefill?`
  <div class="card center">
    <p class="muted" style="margin:0">招待された部屋</p>
    <div class="code-big">${esc(prefill)}</div>
    <button class="btn" id="join">この部屋に入る</button>
  </div>
  <button class="btn ghost small" id="other">べつの部屋にする</button>`:`
  <button class="btn" id="create">🏠 部屋を作る</button>
  <div class="gap"></div>
  <div class="card">
    <h2>部屋に入る</h2>
    <input class="field code-input" id="code" maxlength="4" placeholder="ABCD" autocomplete="off">
    <button class="btn gold" id="join">入る</button>
  </div>`}`;
  $("back").onclick=()=>{ history.replaceState(null,"",location.pathname); viewHome(); };
  const getName=()=>{ const n=$("nm").value.trim(); if(!n){ toast("名前を入れてね"); $("nm").focus(); return null; } store.set("krt_name",n); return n; };
  if(prefill){
    $("join").onclick=()=>{ const n=getName(); if(n) joinRoom(prefill,n); };
    $("other").onclick=()=>{ history.replaceState(null,"",location.pathname); viewOnlineEntry(""); };
  } else {
    $("create").onclick=()=>{ const n=getName(); if(n) createRoom(n); };
    $("join").onclick=()=>{ const n=getName(); if(!n) return; const c=$("code").value.trim().toUpperCase(); if(c.length<4){ toast("4文字の部屋番号を入れてね"); return; } joinRoom(c,n); };
  }
}

// 端末（タブ）ごとのプレイヤーID。再読みこみしても同じIDで入りなおせる
function myPid(id){
  const k="krt_pid_"+id;
  try{ let v=sessionStorage.getItem(k); if(!v){ v=genId(10,"abcdefghijkmnopqrstuvwxyz23456789"); sessionStorage.setItem(k,v); } return v; }
  catch(e){ O._pids=O._pids||{}; return O._pids[id]=O._pids[id]||genId(10,"abcdefghijkmnopqrstuvwxyz23456789"); }
}
function setPid(id,pid){ try{ sessionStorage.setItem("krt_pid_"+id,pid); }catch(e){ O._pids=O._pids||{}; O._pids[id]=pid; } }

async function createRoom(name){
  try{
    let id=""; for(let i=0;i<6;i++){ id=genId(4,CODE_CHARS); if(!(await O.be.get(id))) break; }
    const pid=myPid(id);
    await O.be.set(id,{
      createdAt:Date.now(), host:pid, settings:{laps:1},
      players:{[pid]:{name,av:pickAv([]),joinedAt:Date.now(),online:true}},
      state:{phase:"lobby"}
    });
    enterRoom(id);
  }catch(e){ console.error(e); toast("部屋を作れませんでした"); }
}
async function joinRoom(id,name){
  try{
    const room=await O.be.get(id);
    if(!room){ toast("部屋が見つかりません"); return; }
    let pid=myPid(id);
    const ps=room.players||{};
    // 同じ名前でおやすみ中の人がいたら、その人として入りなおす
    const same=Object.entries(ps).find(([k,p])=>k!==pid&&p.name===name);
    if(same){
      if(same[1].online===false){ pid=same[0]; setPid(id,pid); }
      else { toast("同じ名前の人がいます。名前を変えてね"); return; }
    }
    if(!ps[pid] && Object.keys(ps).length>=MAX_ONLINE){ toast(`満員です（${MAX_ONLINE}人まで）`); return; }
    const patch={};
    const usedAv=Object.entries(ps).filter(([k,p])=>k!==pid&&p.online!==false).map(([k,p])=>p.av);
    if(ps[pid]){ patch[`players/${pid}/name`]=name; patch[`players/${pid}/online`]=true; if(!ps[pid].av) patch[`players/${pid}/av`]=pickAv(usedAv); }
    else patch[`players/${pid}`]={name,av:pickAv(usedAv),joinedAt:Date.now(),online:true};
    await O.be.update(id,patch);
    enterRoom(id);
  }catch(e){ console.error(e); toast("部屋に入れませんでした"); }
}
function enterRoom(id){
  O.id=id; O.pid=myPid(id); O.lastHTML=""; O.lastKey="";
  history.replaceState(null,"","?room="+id);
  if(O.unsub) O.unsub(); if(O.unpres) O.unpres();
  O.unsub=O.be.listen(id,room=>{ O.room=room; renderOnline(); });
  O.unpres=O.be.presence(id,O.pid);
}
function leaveRoom(){
  const R=O.room, id=O.id, pid=O.pid;
  if(O.unsub) O.unsub(); if(O.unpres) O.unpres(); O.unsub=O.unpres=null;
  if(R && R.players){
    const patch={[`players/${pid}`]:null};
    if(R.host===pid){
      const next=onlinePlayers(R).find(p=>p.id!==pid);
      if(next) patch.host=next.id;
    }
    const others=Object.keys(R.players).filter(k=>k!==pid);
    if(others.length===0) O.be.set(id,null); else O.be.update(id,patch);
  }
  O.id=null; O.room=null;
  history.replaceState(null,"",location.pathname);
  viewOnlineEntry("");
}

// ---- 部屋データのヘルパー ----
const allPlayers = R => Object.entries(R.players||{}).map(([id,p])=>({id,...p})).sort((a,b)=>a.joinedAt-b.joinedAt);
const onlinePlayers = R => allPlayers(R).filter(p=>p.online!==false);
const nameOf = (R,pid) => (R.players&&R.players[pid]&&R.players[pid].name) || "（退出した人）";
const avOf = (R,pid) => (R.players&&R.players[pid]&&R.players[pid].av) || "av01";
const isOnline = (R,pid) => !!(R.players&&R.players[pid]&&R.players[pid].online!==false);
const ST = R => R.state||{phase:"lobby"};
const qPidOf = R => { const s=ST(R); return s.order ? s.order[s.round % s.order.length] : null; };
const guessersOf = R => { const s=ST(R), q=qPidOf(R); return (s.order||[]).filter(p=>p!==q); };

function onlineHeader(R){
  const s=ST(R);
  const left = s.phase==="lobby" ? "ロビー" : s.phase==="final" ? "最終結果" : `第${s.round+1}レース / 全${s.total}`;
  return `<div class="bar"><span class="race">${left}<span class="online-badge">部屋 ${esc(O.id)}</span>${s.phase!=="lobby"&&s.kind==="deep"?`<span class="online-badge deep">🔥DEEP</span>`:""}</span><button class="iconbtn" id="hrules">ルール</button></div>`;
}
function scoreList(R, withPlus){
  const s=ST(R), sc=R.scores||{}, last=s.last||{}, q=qPidOf(R);
  return ranked((s.order||[]).map(pid=>({id:pid,name:nameOf(R,pid),av:avOf(R,pid),score:sc[pid]||0,plus:withPlus?last[pid]:0,note:withPlus&&pid===q?"(出題)":(!isOnline(R,pid)?"(おやすみ)":"")})));
}

function renderOnline(){
  const R=O.room;
  if(!R){ app.innerHTML=`<div class="card center"><h2>部屋がなくなりました</h2><button class="btn" id="bk">もどる</button></div>`; $("bk").onclick=()=>{ if(O.unsub) O.unsub(); O.unsub=null; history.replaceState(null,"",location.pathname); viewOnlineEntry(""); }; return; }
  if(!R.players||!R.players[O.pid]){ if(O.unsub) O.unsub(); if(O.unpres) O.unpres(); O.unsub=O.unpres=null; toast("部屋から出ました"); history.replaceState(null,"",location.pathname); viewOnlineEntry(""); return; }
  const s=ST(R);
  const key=`${s.phase}|${s.round??""}`;
  if(O.L.editing && key===O.lastKey) return; // オリジナルお題の入力中は書きかえない
  autoAdvance(R);
  let v;
  switch(s.phase){
    case "answer": v=vAnswer(R); break;
    case "guess":  v=vGuess(R); break;
    case "reveal": v=vReveal(R); break;
    case "score":  v=vScore(R); break;
    case "final":  v=vFinal(R); break;
    default:       v=vLobby(R);
  }
  const html=onlineHeader(R)+v.html;
  if(html===O.lastHTML && key===O.lastKey) return;
  const sameScreen = key===O.lastKey;
  const y=window.scrollY;
  app.innerHTML=html; O.lastHTML=html; O.lastKey=key;
  if(sameScreen) window.scrollTo(0,y); else scrollTop();
  const h=$("hrules"); if(h) h.onclick=showRules;
  if(v.bind) v.bind();
}
function rerender(){ O.lastHTML=""; renderOnline(); }

// 全員の予想がそろったら結果発表へ（出題者かホストの端末が進める）
function autoAdvance(R){
  const s=ST(R);
  if(s.phase!=="guess") return;
  if(!(qPidOf(R)===O.pid || R.host===O.pid)) return;
  const need=guessersOf(R).filter(p=>isOnline(R,p));
  const g=R.guesses||{};
  const k=`${s.gameId}-${s.round}`;
  if(need.length && need.every(p=>g[p]) && O.L.advKey!==k){
    O.L.advKey=k;
    // 描画の途中で書きこむと画面がずれるので、少しあとで
    setTimeout(()=>O.be.update(O.id,{"state/phase":"reveal","state/step":0}),0);
  }
}

// ---- ロビー ----
function vLobby(R){
  const ps=allPlayers(R), host=R.host===O.pid, laps=(R.settings&&R.settings.laps)||1, kind=(R.settings&&R.settings.kind)||"normal";
  const on=onlinePlayers(R);
  const url=location.origin+location.pathname+"?room="+O.id;
  const hostOff=!isOnline(R,R.host);
  return { html:`
  <div class="card center">
    <p class="muted" style="margin:0">部屋番号</p>
    <div class="code-big">${esc(O.id)}</div>
    <div class="share"><input id="url" readonly value="${esc(url)}"><button class="btn small gold" id="copy">コピー</button></div>
    <p class="muted" style="margin:8px 0 0">このURLをみんなに送ってね</p>
  </div>
  <div class="card">
    <h2>参加者（${on.length}人）</h2>
    <ul class="plist">${ps.map(p=>`<li class="${p.online===false?"off":""}"><span class="dot"></span>${p.id===O.pid?`<button class="avbtn" id="myav">${avHTML(p.av)}</button>`:avHTML(p.av)}${R.host===p.id?"👑":""}${esc(p.name)}${p.id===O.pid?`<span class="tag me">あなた</span>`:p.online===false?`<span class="tag">おやすみ</span>`:""}</li>`).join("")}</ul>
    <p class="muted" style="margin:8px 0 0">自分のアイコンをタップすると変えられます</p>
  </div>
  ${host?`
  <div class="card"><h2>お題の種類</h2>${kindSegHTML(kind)}</div>
  <div class="card"><h2>何周する？</h2>
    <div class="seg">${[1,2,3].map(n=>`<button data-l="${n}" class="${laps===n?"on":""}">${n}周</button>`).join("")}</div>
    <p class="muted" style="margin:8px 0 0">1周 ＝ 全員が1回ずつ出題（${on.length*laps}レース）</p></div>
  <button class="btn" id="start" ${on.length<2?"disabled":""}>${on.length<2?"あと1人以上まってね":"スタート！"}</button>`:`
  <div class="ctrl-wait">👑 ${esc(nameOf(R,R.host))}さんがスタートするのを待ってね<br>（お題：${kind==="deep"?"🔥 DEEP":kindLabel(kind)}・${laps}周）</div>
  ${hostOff?`<div class="gap"></div><button class="btn gold small" id="takeover">ホストを引きつぐ</button>`:""}`}
  <div class="gap"></div><button class="btn ghost small" id="leave">部屋を出る</button>`,
  bind(){
    $("copy").onclick=async()=>{ try{ await navigator.clipboard.writeText(url); toast("コピーしました"); }catch(e){ $("url").select(); toast("長押しでコピーしてね"); } };
    $("leave").onclick=leaveRoom;
    $("myav").onclick=()=>{ const used=onlinePlayers(R).filter(p=>p.id!==O.pid).map(p=>p.av); showAvPicker(avOf(R,O.pid),used,a=>O.be.update(O.id,{[`players/${O.pid}/av`]:a})); };
    const t=$("takeover"); if(t) t.onclick=()=>O.be.update(O.id,{host:O.pid});
    if(host){
      app.querySelectorAll("[data-l]").forEach(b=>b.onclick=()=>O.be.update(O.id,{"settings/laps":+b.dataset.l}));
      app.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>O.be.update(O.id,{"settings/kind":b.dataset.k}));
      $("start").onclick=()=>{
        const order=onlinePlayers(R).map(p=>p.id);
        if(order.length<2) return;
        const scores={}; order.forEach(p=>scores[p]=0);
        O.be.update(O.id,{
          state:{phase:"answer",round:0,total:order.length*laps,order,used:[],kind,gameId:Date.now()},
          scores, answer:null, guesses:null
        });
      };
    }
  }};
}

function drawOnlineTheme(R){
  const s=ST(R), used=s.used||[], all=themeIds(s.kind||"normal");
  let pool=all.filter(i=>!used.includes(i));
  if(O.L.draft && !O.L.draft.custom) pool=pool.filter(i=>i!==O.L.draft.id);
  if(!pool.length) pool=all;
  const idx=pool[Math.floor(Math.random()*pool.length)];
  return themeById(idx);
}
function nextRound(R){
  const s=ST(R), r=s.round+1;
  if(r>=s.total) O.be.update(O.id,{"state/phase":"final"});
  else O.be.update(O.id,{"state/phase":"answer","state/round":r,"state/theme":null,"state/step":null,"state/last":null,answer:null,guesses:null});
}

// ---- 出題者が答えを決める ----
function vAnswer(R){
  const s=ST(R), q=qPidOf(R), qn=nameOf(R,q);
  if(q!==O.pid){
    const host=R.host===O.pid, qOff=!isOnline(R,q);
    return { html:`
    ${bannerHTML("今回の出題者",qn,"お題を選んで、答えを考えています",avOf(R,q))}
    <div class="card wait"><span class="em">🤔</span><p>${esc(qn)}さんの答えを待ってね</p></div>
    <div class="card"><h2>いまの得点</h2>${scoreTableHTML(scoreList(R,false))}</div>
    ${host&&qOff?`<button class="btn ghost small" id="skip">${esc(qn)}さんがいないので とばす</button>`:""}`,
    bind(){ const b=$("skip"); if(b) b.onclick=()=>nextRound(R); } };
  }
  // 自分が出題者
  const rk=`${s.gameId}-${s.round}`;
  if(O.L.roundKey!==rk){ O.L.roundKey=rk; O.L.stage="theme"; O.L.pick=[]; O.L.draft=drawOnlineTheme(R); O.L.editing=false; }
  const L=O.L;
  if(L.stage==="custom"){
    L.editing=true;
    return { html: customFormHTML(L.draft), bind(){
      $("ccancel").onclick=()=>{ L.editing=false; L.stage="theme"; rerender(); };
      $("cok").onclick=()=>{ const t=readCustom(); if(t){ L.draft=t; L.editing=false; L.stage="theme"; rerender(); } };
    }};
  }
  if(L.stage==="pick"){
    return { html:`
    ${bannerHTML("出題者",qn,"自分の本当の気持ちで答えてね",avOf(R,q))}
    ${pickHTML(L.draft,L.pick,"1着→2着→3着の順にタップしてね。（ほかの人には見えません）")}
    <button class="btn" id="ok" ${L.pick.length<3?"disabled":""}>これで決定！</button>
    <div class="gap"></div>
    <div class="row"><button class="btn ghost small" id="clear">リセット</button><button class="btn ghost small" id="bk">お題にもどる</button></div>`,
    bind(){
      bindPick(L.pick,rerender);
      $("clear").onclick=()=>{ L.pick.length=0; rerender(); };
      $("bk").onclick=()=>{ L.stage="theme"; rerender(); };
      $("ok").onclick=()=>{
        if(L.pick.length<3) return;
        const used=(s.used||[]).slice(); if(!L.draft.custom) used.push(L.draft.id);
        O.be.update(O.id,{"state/theme":{q:L.draft.q,opts:L.draft.opts,custom:!!L.draft.custom,deep:!!L.draft.deep},answer:L.pick.slice(),"state/used":used,"state/phase":"guess",guesses:null});
      };
    }};
  }
  return { html:`
  ${bannerHTML("今回の出題者はあなた",qn,"お題を決めてね",avOf(R,q))}
  ${themeCardHTML(L.draft, L.draft.custom?"オリジナルお題":"今回のお題")}
  <button class="btn" id="ok">このお題で決める</button><div class="gap"></div>
  <div class="row"><button class="btn ghost small" id="redraw">🔄 引き直す</button><button class="btn ghost small" id="custom">✏️ 自分で作る</button></div>`,
  bind(){
    $("ok").onclick=()=>{ L.pick=[]; L.stage="pick"; rerender(); scrollTop(); };
    $("redraw").onclick=()=>{ L.draft=drawOnlineTheme(R); rerender(); };
    $("custom").onclick=()=>{ L.stage="custom"; rerender(); };
  }};
}

// ---- みんなが予想する ----
function vGuess(R){
  const s=ST(R), q=qPidOf(R), qn=nameOf(R,q), g=R.guesses||{};
  const guessers=guessersOf(R);
  const me=O.pid;
  const gk=`${s.gameId}-${s.round}`;
  if(O.L.gKey!==gk){ O.L.gKey=gk; O.L.gpick=[]; }
  if(guessers.includes(me) && !g[me]){
    const pick=O.L.gpick;
    return { html:`
    ${bannerHTML("この人のトップ3を予想！",qn,`予想する人：${avHTML(avOf(R,me))}${esc(nameOf(R,me))}さん（あなた）`,avOf(R,q))}
    ${pickHTML(s.theme,pick,`<b>${esc(qn)}</b>さんなら、どれを選ぶ？ 1着→2着→3着の順にタップ。`)}
    <button class="btn" id="ok" ${pick.length<3?"disabled":""}>この馬券で勝負！</button>
    <div class="gap"></div><button class="btn ghost small" id="clear">リセット</button>`,
    bind(){
      bindPick(pick,rerender);
      $("clear").onclick=()=>{ pick.length=0; rerender(); };
      $("ok").onclick=()=>{ if(pick.length<3) return; O.be.update(O.id,{[`guesses/${me}`]:pick.slice()}); };
    }};
  }
  const done=guessers.filter(p=>g[p]).length;
  const canForce=(R.host===me||q===me) && done>0;
  const who = q===me ? "あなたの答えを、みんなが予想中…" : g[me] ? "予想を出しました！ほかの人を待ってね" : "観戦中です";
  return { html:`
  ${bannerHTML("今回の出題者",qn,`お題：${esc(s.theme.q)}`,avOf(R,q))}
  <div class="card wait"><img class="em-horse" src="${imgSrc("horse")}" alt=""><p>${who}</p><p class="muted">${done} / ${guessers.length} 人が予想ずみ</p></div>
  <div class="card"><ul class="plist">${guessers.map(p=>`<li class="${isOnline(R,p)?"":"off"}"><span class="dot"></span>${avHTML(avOf(R,p))}${esc(nameOf(R,p))}${g[p]?`<span class="tag ok">✅ 予想ずみ</span>`:isOnline(R,p)?`<span class="tag">⏳ 考え中</span>`:`<span class="tag">おやすみ</span>`}</li>`).join("")}</ul></div>
  ${canForce&&done<guessers.length?`<button class="btn ghost small" id="force">待たずに結果発表へ</button>`:""}`,
  bind(){ const f=$("force"); if(f) f.onclick=()=>O.be.update(O.id,{"state/phase":"reveal","state/step":0}); } };
}

// ---- 結果発表 ----
function controllerOf(R){ const q=qPidOf(R); return isOnline(R,q)?q:R.host; }
function vReveal(R){
  const s=ST(R), q=qPidOf(R), qn=nameOf(R,q), g=R.guesses||{}, answer=R.answer||[];
  const step=s.step||0, done=step>=6;
  const players=guessersOf(R).filter(p=>g[p]);
  const ctrl=controllerOf(R)===O.pid;
  if(done){
    const best=Math.max(0,...players.map(p=>judge(g[p],answer).pt));
    const ck=`${s.gameId}-${s.round}`;
    if(best===6 && O.L.confKey!==ck){ O.L.confKey=ck; setTimeout(confetti,100); }
  }
  let btn;
  if(ctrl) btn = done?`<button class="btn" id="next">得点を見る</button>`:`<button class="btn ${step%2===1?"gold":""}" id="next">${REVEAL_LABELS[step]}</button>`;
  else btn = `<div class="ctrl-wait">⏳ ${esc(nameOf(R,controllerOf(R)))}さんが${done?"得点を出すのを":"めくるのを"}待ってね</div>`;
  return { html:`
  ${step===0?bannerHTML("結果発表！",qn,"の答えは…？",avOf(R,q)):""}
  <p class="theme-mini">お題：${esc(s.theme.q)}</p>
  ${answerCardHTML(s.theme,qn,answer,step,avOf(R,q))}
  ${players.map(p=>ticketHTML(s.theme,nameOf(R,p)+(p===O.pid?"（あなた）":""),g[p],answer,step,avOf(R,p))).join("")}
  <div class="sticky-btn">${btn}</div>`,
  bind(){
    const b=$("next"); if(!b) return;
    b.onclick=()=>{
      if(!done){ O.be.update(O.id,{"state/step":step+1}); return; }
      const sc=R.scores||{}, last={}, patch={};
      players.forEach(p=>{ const pt=judge(g[p],answer).pt; last[p]=pt; patch[`scores/${p}`]=(sc[p]||0)+pt; });
      patch["state/last"]=last; patch["state/phase"]="score";
      O.be.update(O.id,patch);
    };
  }};
}

// ---- レース終了 ----
function vScore(R){
  const s=ST(R), host=R.host===O.pid, last=s.round+1>=s.total;
  const nextQ=s.order[(s.round+1)%s.order.length];
  return { html:`
  <div class="card"><h2>📋 第${s.round+1}レース 終了</h2>${scoreTableHTML(scoreList(R,true))}</div>
  ${!last?`<p class="center" style="color:#fff;font-weight:900">次の出題者は <span style="background:var(--gold);color:#3b2a00;padding:2px 10px;border-radius:8px">${avHTML(avOf(R,nextQ))}${esc(nameOf(R,nextQ))}</span> さん</p>`:""}
  ${host?`<button class="btn ${last?"gold":""}" id="next">${last?"🏆 最終結果へ":"次のレースへ"}</button>`:
    `<div class="ctrl-wait">⏳ 👑${esc(nameOf(R,R.host))}さんが進めるのを待ってね</div>
     ${!isOnline(R,R.host)?`<div class="gap"></div><button class="btn gold small" id="takeover">ホストを引きつぐ</button>`:""}`}`,
  bind(){
    const b=$("next"); if(b) b.onclick=()=>nextRound(R);
    const t=$("takeover"); if(t) t.onclick=()=>O.be.update(O.id,{host:O.pid});
  }};
}

// ---- 最終結果 ----
function vFinal(R){
  const host=R.host===O.pid;
  const fk="final-"+ST(R).gameId;
  if(O.L.confKey!==fk){ O.L.confKey=fk; setTimeout(confetti,100); }
  return { html:`
  ${podiumHTML(scoreList(R,false))}
  ${host?`<button class="btn" id="again">もう一回あそぶ（ロビーへ）</button>`:`<div class="ctrl-wait">👑${esc(nameOf(R,R.host))}さんが「もう一回」を押すと、ロビーにもどります</div>`}
  <div class="gap"></div><button class="btn ghost small" id="leave">部屋を出る</button>`,
  bind(){
    const a=$("again"); if(a) a.onclick=()=>{ O.be.update(O.id,{state:{phase:"lobby"},scores:null,answer:null,guesses:null}); };
    $("leave").onclick=leaveRoom;
  }};
}

// ===================== スタート =====================
(function boot(){
  const m=location.search.match(/[?&]room=([A-Za-z0-9]{4,8})/);
  if(m) viewOnlineEntry(m[1].toUpperCase());
  else viewHome();
})();
