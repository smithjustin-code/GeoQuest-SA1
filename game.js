// --- Crash overlay (shows any JS error at the bottom of the screen) ---
(function installCrashOverlay(){
  const overlay = document.createElement('div');
  overlay.id='crashOverlay';
  overlay.style.cssText='position:fixed;left:0;right:0;bottom:0;max-height:40vh;overflow:auto;background:rgba(160,20,20,.92);color:#fff;font:12px monospace;z-index:99999;display:none;padding:8px';
  function show(msg){
    overlay.style.display='block';
    const r = document.createElement('div');
    r.textContent = msg;
    overlay.appendChild(r);
  }
  window.addEventListener('error', e=>{ show('JS error: ' + (e.message || e.error)); });
  window.addEventListener('unhandledrejection', e=>{
    const reason = e.reason && (e.reason.message || e.reason);
    show('Promise error: ' + reason);
  });
  document.addEventListener('DOMContentLoaded', ()=>document.body.appendChild(overlay));
})();

/* ===================== Verify Code (collision-proof) ===================== */
window.__AA_SECRET = window.__AA_SECRET || "SC7Geo2025-SA";
function fnv1aHex(str){
  let h = 0x811c9dc5>>>0;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = (h + ((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)))>>>0;
  }
  return ("00000000"+h.toString(16)).slice(-8).toUpperCase();
}
function base36(n,pad=2){ return Math.max(0,n|0).toString(36).toUpperCase().padStart(pad,"0"); }
function makeCode(name, cls, xp, visited){
  const payload = `${window.__AA_SECRET}|${name}|${cls}|${xp}|${visited}|AndesAmazons`;
  const sig = fnv1aHex(payload).slice(0,6);
  return `SA-${base36(xp)}${base36(visited)}-${sig}`;
}

/* ===================== State & Save ===================== */
let state = {
  xp:0, tp:8, visited:[], answered:[], eventsSeen:[],
  currentCase:null, finalAnswered:false,
  studentName:"", className:"", sound:true,
  locationCountry:null, lastPlaceId:null,
  isFlying:false, flightStart:0, flightDuration:0,
  planeX:0, planeY:0, flightFromX:0, flightFromY:0, flightToX:0, flightToY:0,
  flightCtrlX:0, flightCtrlY:0,
  flightDestCountry:null, flightDestPlace:null,
  clues:[], leads:[]
};
function saveState(){ localStorage.setItem("AndesAmazonsSave", JSON.stringify(state)); }
function loadState(){ try{ const s=JSON.parse(localStorage.getItem("AndesAmazonsSave")||"{}"); Object.assign(state,s);}catch{} }

/* ===================== UI Helpers ===================== */
let ditherDataUrl="";
function generateDither(){
  const c=document.createElement('canvas'); c.width=8; c.height=8;
  const x=c.getContext('2d'); const img=x.createImageData(8,8);
  for(let y=0;y<8;y++) for(let i=0;i<8;i++){
    const idx=(y*8+i)*4; const v=((i+y)&1)?0x0A:0x1A;
    img.data[idx]=10+v; img.data[idx+1]=26+v; img.data[idx+2]=48+v; img.data[idx+3]=255;
  }
  x.putImageData(img,0,0); ditherDataUrl=c.toDataURL();
}
function btn(label, onClick){
  const b=document.createElement('div'); b.className='btn'; b.textContent=label;
  b.style.backgroundImage=`url(${ditherDataUrl})`; b.tabIndex=0;
  b.onclick=()=>{ onClick(); sfxClick(); };
  b.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); onClick(); sfxClick(); } };
  return b;
}
const hud = {
  case:()=>document.getElementById('hudCase'),
  student:()=>document.getElementById('hudStudent'),
  cls:()=>document.getElementById('hudClass'),
  xp:()=>document.getElementById('hudXP'),
  tp:()=>document.getElementById('hudTP'),
  visited:()=>document.getElementById('hudVisited'),
  sound:()=>document.getElementById('hudSound'),
  journal:()=>document.getElementById('hudJournal'),
  cluesBtn:()=>document.getElementById('hudClues')
};
function updateHUD(){
  const cse = state.currentCase ? getCase(state.currentCase) : null;
  hud.case().textContent = cse ? `Case: ${cse.title}` : '';
  hud.student().textContent = state.studentName?`Student: ${state.studentName}`:'';
  hud.cls().textContent = state.className?`Class: ${state.className}`:'';
  hud.xp().textContent = `XP⭐ ${state.xp}`;
  hud.tp().textContent = `TP🚶 ${state.tp}`;
 const totalCountries = (typeof DATA!=='undefined' && Array.isArray(DATA.countries)) ? DATA.countries.length : 0;
  hud.visited().textContent = `Visited📍 ${state.visited.length}/${totalCountries || '?'}`;
  hud.sound().textContent = state.sound?'🔊':'🔇';
  measureHud();
}
function toast(msg){
  const host=document.getElementById('toasts'); if(!host) return;
  const t=document.createElement('div'); t.className='toast'; t.textContent=msg;
  host.appendChild(t); setTimeout(()=>t.remove(),2700);
}

/* ===================== Audio ===================== */
let audioCtx, musicTimer=null, musicStep=0;
function getAudio(){ audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)(); return audioCtx; }
function playTone(freq=440, dur=0.12, type='square', gain=0.10){
  if(!state.sound) return;
  const ctx=getAudio(); const o=ctx.createOscillator(), g=ctx.createGain();
  o.type=type; o.frequency.value=freq; o.connect(g); g.connect(ctx.destination);
  const t=ctx.currentTime;
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(gain, t+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.start(t); o.stop(t+dur+0.02);
}
function sfxClick(){ playTone(440,0.05,'square',0.08); }
function sfxCorrect(){ playTone(880,0.07,'square',0.10); setTimeout(()=>playTone(1320,0.08,'square',0.08), 60); }
function sfxWrong(){ playTone(220,0.08,'square',0.10); setTimeout(()=>playTone(180,0.10,'square',0.08), 70); }
function sfxResolve(){
  playTone(660,0.10,'square',0.10);
  setTimeout(()=>playTone(990,0.12,'square',0.10), 90);
  setTimeout(()=>playTone(1320,0.14,'square',0.10), 190);
}
function startAmbience(){
  if(!state.sound || musicTimer) return;
  const bpm=112; const stepMs=(60000/bpm)/2;
  musicTimer=setInterval(()=>{
    const root=220; const pattern=[0,7,12,7,10,7,12,7];
    const semi = pattern[musicStep % pattern.length];
    const f = root * Math.pow(2, semi/12);
    playTone(f, 0.09, (musicStep%4===0?'triangle':'square'), 0.06);
    musicStep++;
  }, stepMs);
}
function stopAmbience(){ if(musicTimer){ clearInterval(musicTimer); musicTimer=null; } }

/* ===================== Layout helpers ===================== */
function measureHud(){
  const hudEl=document.getElementById('hud'); if(!hudEl) return;
  const h=Math.ceil(hudEl.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--hud-h', h+'px');
}

/* ===================== Scenes ===================== */
function showScene(id){
  document.querySelectorAll('.scene').forEach(s=>s.classList.remove('show'));
  const el = document.getElementById(id);
  if(el) el.classList.add('show');
  updateHUD();
  if(state.sound && (id==='titleScreen' || id==='mapScreen')) startAmbience(); else stopAmbience();
}

/* ===================== Data helpers & case helpers ===================== */
function getCountry(id){ return DATA.countries.find(c=>c.id===id); }
function getCase(id){ return DATA.cases.find(c=>c.id===id); }
function activeCase(){ return state.currentCase ? getCase(state.currentCase) : null; }
function haveRequiredClues(){
  const cs = activeCase(); if(!cs || !cs.requiredClues) return true;
  return cs.requiredClues.every(id=>state.clues.includes(id));
}
function computeLeads(){
  const needed = new Set((activeCase()?.requiredClues)||[]);
  const have = new Set(state.clues||[]);
  const missing = [...needed].filter(id=>!have.has(id));
  const leads = new Set();
  DATA.countries.forEach(c=>{
    (c.events||[]).forEach(e=>{
      if(e.grantClue && missing.includes(e.grantClue)) leads.add(c.id);
    });
  });
  state.leads=[...leads];
}
function addClue(id){
  if(!id) return;
  if(!state.clues.includes(id)){
    state.clues.push(id);
    saveState();
    toast("🗂️ New clue collected!");
    computeLeads();
  }
}

/* ===================== Title & HQ ===================== */
function setupTitle(){
  // Ensure container exists
  let wrap = document.getElementById('titleButtons');
  if(!wrap){
    const container = document.querySelector('#titleScreen .center') || document.getElementById('titleScreen');
    wrap = document.createElement('div');
    wrap.id = 'titleButtons';
    if(container) container.appendChild(wrap);
  }
  // Render buttons FIRST so they appear even if another part errors later
  wrap.innerHTML='';
  const goMap = ()=>{ showScene('mapScreen'); enterMap(); };
  const goHQ  = ()=>{ showScene('hqScreen'); setupHQ(); };

  if(state.currentCase && !state.finalAnswered){
    wrap.appendChild(btn('Continue', goMap));
  }else{
    wrap.appendChild(btn('Start', goHQ));
  }
  wrap.appendChild(btn('New Game', ()=>{
    localStorage.removeItem("AndesAmazonsSave");
    state = { xp:0,tp:8,visited:[],answered:[],eventsSeen:[],currentCase:null,finalAnswered:false,
              studentName:"",className:"",sound:true,locationCountry:null,lastPlaceId:null,
              isFlying:false,flightStart:0,flightDuration:0,planeX:0,planeY:0,
              flightFromX:0,flightFromY:0,flightToX:0,flightToY:0,flightCtrlX:0,flightCtrlY:0,
              flightDestCountry:null,flightDestPlace:null, clues:[], leads:[] };
    saveState(); setupTitle();
  }));
  wrap.appendChild(btn(state.sound?'Sound Off':'Sound On', ()=>{
    state.sound=!state.sound; saveState();
    setupTitle();
  }));
  wrap.appendChild(btn('How to Play', ()=>{
    const el=document.getElementById('howTo');
    if(el) el.style.display = el.style.display==='none' ? 'block' : 'none';
  }));

  // If buttons didn't land due to an async hiccup, try once more shortly.
  setTimeout(()=>{
    if(!wrap.firstElementChild){
      console.warn('Title buttons re-render attempt');
      setupTitle();
    }
  }, 50);
}
function setupHQ(){
  const intro = document.getElementById('hqIntro');
  const list = document.getElementById('caseList');
  list.innerHTML = '';

  // Wait for DATA to be available
  if (typeof DATA === 'undefined' || !Array.isArray(DATA.cases)) {
    if (intro) intro.textContent = 'Loading case data…';
    setTimeout(setupHQ, 60);
    return;
  }

  if (intro) intro.textContent = 'Choose your case. Meet goals to resolve it.';

  DATA.cases.forEach(c=>{
    const box=document.createElement('div'); box.style.textAlign='left';
    box.innerHTML=`<strong>${c.title}</strong><p style="font-size:12px">${c.hook}</p>`;
    box.appendChild(btn('Play', ()=>{
      state.currentCase=c.id; state.xp=0; state.tp=8; state.visited=[]; state.answered=[]; state.eventsSeen=[];
      state.locationCountry=null; state.lastPlaceId=null; state.finalAnswered=false; state.clues=[]; state.leads=[];
      saveState(); showScene('mapScreen'); enterMap();
    }));
    list.appendChild(box);
  });

  // Inputs + buttons
  document.getElementById('studentName').value=state.studentName||'';
  document.getElementById('className').value=state.className||'';

  const hqBtns=document.getElementById('hqButtons'); hqBtns.innerHTML='';
  hqBtns.appendChild(btn('Save & Continue', ()=>{
    state.studentName=document.getElementById('studentName').value.trim();
    state.className=document.getElementById('className').value.trim();
    saveState();
  }));
  // Optional quality-of-life: start the only case directly
  hqBtns.appendChild(btn('Start Case', ()=>{
    const c = DATA.cases[0];
    state.currentCase=c.id; state.xp=0; state.tp=8; state.visited=[]; state.answered=[]; state.eventsSeen=[];
    state.locationCountry=null; state.lastPlaceId=null; state.finalAnswered=false; state.clues=[]; state.leads=[];
    saveState(); showScene('mapScreen'); enterMap();
  }));
  hqBtns.appendChild(btn('Back to Title', ()=>{ showScene('titleScreen'); setupTitle(); }));
}

/* ===================== Map & Projection ===================== */
const bounds = { latMin:-56, latMax:13, lonMin:-82, lonMax:-34 };
let mapCanvas, mapCtx;
let baseMapImage;
let markers=[]; // {countryId, placeId, name, type, lat, lon, _x, _y}
let hovered=null;
let mapRAF=null;

function mercY(latDeg){ const φ = latDeg * Math.PI/180; return Math.log(Math.tan(Math.PI/4 + φ/2)); }
const mercYMin = mercY(bounds.latMin);
const mercYMax = mercY(bounds.latMax);
function toXY(lat, lon){
  const nx = (lon - bounds.lonMin) / (bounds.lonMax - bounds.lonMin);
  const ny = (mercYMax - mercY(lat)) / (mercYMax - mercYMin);
  return { x: nx * mapCanvas.width, y: ny * mapCanvas.height };
}

/* ===================== Sprites ===================== */
const SPRITES={};
function makeSprite(draw){
  const c=document.createElement('canvas'); c.width=16; c.height=16;
  const g=c.getContext('2d'); g.imageSmoothingEnabled=false;
  g.clearRect(0,0,16,16); draw(g); return c;
}
function buildSprites(){
  SPRITES.capital = makeSprite(g=>{
    g.fillStyle='#FFD166'; g.strokeStyle='#0A1A30'; g.lineWidth=1;
    g.beginPath();
    g.moveTo(8,1); g.lineTo(10,6); g.lineTo(15,6); g.lineTo(11,9.5);
    g.lineTo(13,15); g.lineTo(8,12); g.lineTo(3,15); g.lineTo(5,9.5);
    g.lineTo(1,6); g.lineTo(6,6); g.closePath(); g.fill(); g.stroke();
  });
  SPRITES.heritage = makeSprite(g=>{
    g.fillStyle='#4CC9F0'; g.strokeStyle='#0A1A30'; g.lineWidth=1;
    g.fillRect(2,11,12,3); g.fillRect(3,9,10,2); g.fillRect(5,6,6,3); g.fillRect(7,4,2,2); g.strokeRect(2.5,10.5,11,4);
  });
  SPRITES.port = makeSprite(g=>{
    g.fillStyle='#38B000'; g.strokeStyle='#0A1A30';
    g.fillRect(7,2,2,9); g.beginPath(); g.arc(8,12,4,0,Math.PI,true); g.fill();
    g.beginPath(); g.arc(8,3,2,0,Math.PI*2); g.fill(); g.strokeRect(6.5,2,3,9);
  });
  SPRITES.amazon = makeSprite(g=>{
    g.fillStyle='#8AC926'; g.strokeStyle='#0A1A30';
    g.beginPath(); g.moveTo(8,2); g.quadraticCurveTo(14,6,13,12);
    g.quadraticCurveTo(8,15,8,15); g.quadraticCurveTo(8,15,3,12); g.quadraticCurveTo(2,6,8,2);
    g.fill(); g.stroke(); g.strokeStyle='rgba(10,26,48,.6)'; g.beginPath(); g.moveTo(8,3); g.lineTo(8,14); g.stroke();
  });
}
function drawCityIcon(ctx,x,y,kind,{visited,current}={}){
  const s = SPRITES[kind] || SPRITES.capital;
  const px=x-8, py=y-8;
  if(current){ ctx.save(); ctx.shadowColor='rgba(255,209,102,.55)'; ctx.shadowBlur=10; ctx.drawImage(s,px,py); ctx.restore(); }
  ctx.drawImage(s,px,py);
  if(visited){ ctx.strokeStyle='#67F28C'; ctx.lineWidth=1; ctx.strokeRect(px+.5,py+.5,15,15); }
  if(current){ ctx.strokeStyle='#FFD166'; ctx.lineWidth=1; ctx.strokeRect(px+.5,py+.5,15,15); }
}

/* ===================== Map generation & render ===================== */
function buildMarkers(){
  markers=[];
  DATA.countries.forEach(c=>{
    (c.places && c.places.length?c.places:[{id:c.id+'_capital',name:c.capital,lat:c.lat,lon:c.lon,type:'capital'}]).forEach(p=>{
      markers.push({countryId:c.id, placeId:p.id, name:p.name, type:p.type, lat:p.lat, lon:p.lon, _x:0,_y:0});
    });
  });
}
function generateTopoBitmap(){
  const w = 540, h = 600;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;

  const oceanCol = getComputedStyle(document.documentElement).getPropertyValue('--ocean').trim() || '#0D2C54';
  const landCol  = getComputedStyle(document.documentElement).getPropertyValue('--land').trim()  || '#2E8540';

  const B = { latMin:-56, latMax:13, lonMin:-82, lonMax:-34 };
  const mYmin = mercY(B.latMin), mYmax = mercY(B.latMax);
  const toXYbmp = (lat, lon) => ({
    x: (lon - B.lonMin) / (B.lonMax - B.lonMin) * w,
    y: (mYmax - mercY(lat)) / (mYmax - mYmin) * h
  });

  x.fillStyle = oceanCol; x.fillRect(0,0,w,h);

  const COAST = [
    [10.9,-73.0],[11.2,-71.5],[11.3,-70.2],[11.0,-68.7],[10.6,-67.2],[10.2,-65.8],[9.9,-64.6],[9.6,-63.6],
    [9.2,-62.5],[8.8,-61.5],[8.4,-60.6],[7.9,-59.8],[7.3,-59.0],[6.7,-58.3],[6.2,-57.6],[5.8,-56.8],[5.4,-56.1],
    [5.1,-55.2],[5.0,-54.2],[4.7,-53.3],[4.2,-52.5],[3.0,-51.6],[2.2,-50.9],[1.4,-50.1],[0.7,-49.4],[0.1,-48.8],
    [-0.5,-48.2],[-1.2,-47.5],[-2.0,-46.8],[-2.9,-46.1],[-3.7,-45.4],[-4.6,-44.8],[-5.6,-44.2],[-6.6,-43.4],
    [-7.6,-42.6],[-8.7,-41.6],[-9.8,-40.6],[-10.9,-39.6],[-12.0,-38.7],[-13.1,-37.9],[-14.2,-37.3],[-15.4,-37.1],
    [-16.7,-37.7],[-18.0,-38.8],[-19.3,-39.7],[-20.6,-40.8],[-21.9,-41.9],[-23.3,-43.2],[-24.5,-44.4],[-25.7,-45.7],
    [-26.9,-47.0],[-28.1,-48.4],[-29.2,-49.7],[-30.3,-51.0],[-31.5,-52.3],[-32.6,-53.6],[-33.5,-54.6],[-34.3,-55.5],
    [-34.9,-56.3],[-35.5,-57.0],[-36.1,-57.6],[-36.8,-58.1],[-37.6,-58.7],[-38.9,-59.9],[-40.6,-61.4],[-42.4,-63.0],
    [-44.3,-64.7],[-46.1,-66.0],[-47.8,-67.1],[-49.4,-68.0],[-51.0,-68.7],[-52.4,-69.3],[-53.5,-69.8],[-54.5,-70.2],
    [-55.0,-70.4],[-54.0,-71.0],[-52.2,-72.1],[-49.8,-72.8],[-47.2,-73.2],[-44.8,-73.2],[-42.3,-73.0],[-39.9,-72.7],
    [-37.4,-72.3],[-34.9,-71.9],[-32.4,-71.3],[-29.8,-70.7],[-27.2,-70.2],[-24.7,-69.7],[-22.3,-69.6],[-20.2,-69.8],
    [-18.2,-70.1],[-16.2,-71.8],[-14.2,-73.5],[-12.2,-75.1],[-10.2,-76.6],[-8.1,-78.0],[-6.1,-79.0],[-4.1,-79.5],
    [-2.1,-79.6],[-0.2,-79.4],[1.5,-79.0],[3.3,-78.5],[4.9,-78.0],[6.3,-77.5],[7.6,-76.8],[8.6,-75.8],[9.3,-74.6],
    [9.5,-73.3],[9.6,-72.3]
  ];

  x.fillStyle = landCol; x.beginPath();
  COAST.forEach((ll,i)=>{ const p=toXYbmp(ll[0],ll[1]); if(i===0) x.moveTo(p.x,p.y); else x.lineTo(p.x,p.y); });
  x.closePath(); x.fill();

  const ANDES = [
    [9.0,-74.5],[7.0,-75.0],[5.0,-75.8],[3.0,-76.8],[1.0,-77.8],[-1.0,-78.6],[-3.0,-79.0],
    [-5.0,-78.8],[-7.0,-77.9],[-9.2,-77.0],[-11.5,-76.2],[-13.8,-75.2],[-16.0,-73.7],[-18.0,-71.9],
    [-20.0,-70.8],[-22.0,-69.8],[-24.2,-69.2],[-26.5,-69.0],[-28.5,-69.2],[-30.8,-69.5],[-33.0,-70.0],
    [-35.0,-70.6],[-37.0,-71.2],[-39.0,-71.8],[-41.0,-72.2],[-43.0,-72.5],[-45.0,-72.7],[-47.0,-72.8],
    [-49.0,-72.9],[-51.0,-72.5]
  ];
  const strokePolyline=(pts,color,width,alpha=1)=>{ x.save(); x.strokeStyle=color; x.globalAlpha=alpha; x.lineWidth=width; x.lineJoin='round'; x.lineCap='round'; x.beginPath(); pts.forEach(([la,lo],i)=>{ const p=toXYbmp(la,lo); if(i===0) x.moveTo(p.x,p.y); else x.lineTo(p.x,p.y); }); x.stroke(); x.restore(); };
  strokePolyline(ANDES,'#66B27A',64,0.25);
  strokePolyline(ANDES,'#458C5F',36,0.30);
  strokePolyline(ANDES,'#2B6140',18,0.35);

  const AMAZON = [
    [-11.5,-74.0],[-10.2,-72.5],[-9.0,-70.8],[-8.3,-69.5],[-7.6,-68.2],[-7.0,-67.0],
    [-6.3,-65.8],[-5.7,-64.6],[-5.0,-63.4],[-4.5,-62.6],[-3.9,-61.9],[-3.3,-61.2],[-3.1,-60.2],
    [-3.0,-59.0],[-2.8,-57.8],[-2.4,-56.5],[-2.1,-55.4],[-1.8,-54.2],[-1.6,-53.1],[-1.6,-52.0],
    [-1.4,-50.8],[-1.0,-49.9],[-0.6,-49.1],[-0.1,-48.2]
  ];
  const PARANA = [
    [-15.0,-58.3],[-16.8,-58.3],[-18.5,-58.2],[-20.0,-58.1],[-21.5,-57.8],
    [-23.0,-57.6],[-24.0,-57.5],[-25.0,-57.6],[-25.3,-57.6],[-25.5,-57.6],
    [-26.5,-57.3],[-27.8,-56.8],[-29.2,-56.5],[-30.4,-56.7],[-31.5,-57.3],[-32.6,-58.0],[-33.6,-58.4],[-34.6,-58.5]
  ];
  const ORINOCO = [
    [7.0,-72.8],[7.0,-71.2],[7.3,-69.7],[7.9,-68.1],[8.7,-66.6],[9.3,-65.2],[9.5,-64.0],[9.6,-63.0],
    [9.5,-61.9],[9.5,-61.1],[9.4,-60.3],[9.2,-59.6]
  ];
  strokePolyline(AMAZON,'#4CC9F0',2,0.85);
  strokePolyline(PARANA,'#4CC9F0',2,0.85);
  strokePolyline(ORINOCO,'#4CC9F0',2,0.85);

  const BORDERS = {
    'PE-BR': [[-10.8,-73.9],[-9.9,-72.8],[-9.0,-71.2],[-7.9,-70.1],[-7.1,-69.4],[-6.1,-68.9],[-5.2,-69.2],[-4.4,-69.6],[-4.2,-70.5]],
    'PE-CL': [[-18.3,-70.4],[-17.8,-70.0]],
    'BR-AR': [[-25.7,-54.6],[-26.7,-54.6],[-27.2,-55.3],[-27.8,-55.9],[-28.3,-56.3],[-29.0,-56.6]],
    'AR-CL': [[-22.0,-68.2],[-24.0,-68.9],[-26.5,-69.1],[-28.5,-69.3],[-30.8,-69.6],[-33.0,-70.0],[-35.0,-70.6],[-37.0,-71.2],[-39.0,-71.8],[-41.0,-72.2],[-43.0,-72.5],[-45.0,-72.7],[-47.0,-72.8],[-49.0,-72.9]],
    'AR-UY': [[-30.9,-57.9],[-31.7,-57.8],[-32.5,-58.0],[-33.2,-58.2],[-34.0,-58.3],[-34.7,-58.4]],
    'BR-UY': [[-30.9,-57.0],[-31.8,-56.3],[-32.7,-55.6],[-33.4,-54.9],[-33.8,-54.2]],
    'BR-PY': [[-22.0,-54.0],[-23.2,-54.2],[-24.3,-54.5],[-25.1,-54.7],[-25.5,-54.8],[-26.1,-55.1]],
    'AR-PY': [[-27.3,-58.3],[-26.3,-58.2],[-25.3,-57.9],[-24.3,-57.7],[-23.3,-57.6],[-22.5,-57.6]]
  };
  const drawBorder=(key)=>strokePolyline(BORDERS[key],'#0A1A30',2,0.55);
  Object.keys(BORDERS).forEach(drawBorder);

  const img=x.getImageData(0,0,w,h);
  for(let yy=0; yy<h; yy++){
    for(let xx=0; xx<w; xx++){
      const i=(yy*w+xx)*4; const r=img.data[i], g=img.data[i+1], b=img.data[i+2];
      const isLand = g>b && g>r;
      if(isLand && ((xx + 2*yy) % 7 === 0)){
        img.data[i]=Math.max(0,r-3); img.data[i+1]=Math.max(0,g-2); img.data[i+2]=Math.max(0,b-1);
      }
    }
  }
  x.putImageData(img,0,0);

  baseMapImage = c;
  setMapLoading(false);
}

/* ===================== Flight visuals ===================== */
function drawPlane(ctx,x,y,frame=0){
  const bw=14,bh=4;
  ctx.fillStyle='#FFD166'; ctx.strokeStyle='#0A1A30'; ctx.lineWidth=1;
  ctx.fillRect(x-bw/2,y-bh/2,bw,bh);
  ctx.fillRect(x-bw/2-2,y-1,bw+4,2);
  ctx.fillRect(x-bw/2+2,y-bh/2-3,3,3);
  ctx.beginPath(); ctx.moveTo(x+bw/2,y-bh/2); ctx.lineTo(x+bw/2+3,y); ctx.lineTo(x+bw/2,y+bh/2); ctx.closePath(); ctx.fill();
  const px=x+bw/2+5, py=y; ctx.strokeStyle='#E6EDF7'; ctx.beginPath();
  if(frame%3===0){ ctx.moveTo(px-2,py);ctx.lineTo(px+2,py);ctx.moveTo(px,py-2);ctx.lineTo(px,py+2); }
  else if(frame%3===1){ ctx.moveTo(px-2,py-2);ctx.lineTo(px+2,py+2);ctx.moveTo(px-2,py+2);ctx.lineTo(px+2,py-2); }
  else { ctx.moveTo(px,py-3);ctx.lineTo(px,py+3); }
  ctx.stroke(); ctx.strokeStyle='#0A1A30'; ctx.strokeRect(x-bw/2,y-bh/2,bw,bh);
}
function qbez(a,b,c,t){ const u=1-t; return a*u*u + 2*b*u*t + c*t*t; }
function drawFlightArc(tEnd){
  const ctx=mapCtx; if(!ctx) return;
  const sx=state.flightFromX, sy=state.flightFromY, cx=state.flightCtrlX, cy=state.flightCtrlY, ex=state.flightToX, ey=state.flightToY;
  ctx.save(); ctx.setLineDash([4,4]); ctx.lineWidth=1; ctx.strokeStyle='rgba(255,255,255,.28)';
  ctx.beginPath();
  for(let i=0;i<=24;i++){
    const tt=Math.min(tEnd, i/24);
    const x=qbez(sx,cx,ex,tt), y=qbez(sy,cy,ey,tt);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke(); ctx.restore();
}
function drawAnimatedPlane(){
  if(!mapCtx) return;
  let x=state.planeX, y=state.planeY, frame=0, bob=0;
  if(state.isFlying){
    const now=performance.now(); const t=Math.min(1,(now-state.flightStart)/state.flightDuration);
    const cx=state.flightCtrlX, cy=state.flightCtrlY;
    x = qbez(state.flightFromX, cx, state.flightToX, t);
    y = qbez(state.flightFromY, cy, state.flightToY, t);
    state.planeX=x; state.planeY=y;
    drawFlightArc(t);
    frame = Math.floor(((now-state.flightStart)/80)%3);
    if(t>=1){ finishFlight(); }
  }else{
    frame = Math.floor((Date.now()/120)%3);
    bob = Math.sin(Date.now()/260)*2;
  }
  drawPlane(mapCtx, x, y+bob, frame);
}

/* ===================== Map render loop ===================== */
function renderMap(){
  const cont=document.getElementById('mapScreen');
  const cw=cont.clientWidth||window.innerWidth, ch=cont.clientHeight||window.innerHeight-40;
  mapCanvas.width=cw; mapCanvas.height=ch; mapCtx.imageSmoothingEnabled=false;

  mapCtx.clearRect(0,0,cw,ch);
  if(baseMapImage){ mapCtx.drawImage(baseMapImage,0,0,baseMapImage.width,baseMapImage.height,0,0,cw,ch); }

  // edges
  mapCtx.strokeStyle='rgba(255,255,255,.18)'; mapCtx.lineWidth=1;
  DATA.edges.forEach(([a,b])=>{
    const A=getCountry(a), B=getCountry(b);
    const pA=toXY(A.lat,A.lon), pB=toXY(B.lat,B.lon);
    mapCtx.beginPath(); mapCtx.moveTo(pA.x,pA.y); mapCtx.lineTo(pB.x,pB.y); mapCtx.stroke();
  });

  // markers
  markers.forEach(m=>{
    const p=toXY(m.lat,m.lon); m._x=p.x; m._y=p.y;
    const visited = state.visited.includes(m.countryId);
    const current = (state.lastPlaceId===m.placeId);
    drawCityIcon(mapCtx,m._x,m._y,m.type,{visited,current});
  });

  // leads pulse
  if(state.leads && state.leads.length){
    const t=(Date.now()%1200)/1200; const pulse=8 + Math.sin(t*2*Math.PI)*3;
    mapCtx.save(); mapCtx.lineWidth=2; mapCtx.strokeStyle='rgba(255,209,102,.65)';
    DATA.countries.forEach(c=>{
      if(state.leads.includes(c.id)){
        const p=toXY(c.lat,c.lon);
        mapCtx.beginPath(); mapCtx.arc(p.x,p.y,pulse,0,Math.PI*2); mapCtx.stroke();
      }
    });
    mapCtx.restore();
  }

  // plane
  if(!state.isFlying && state.lastPlaceId){
    const mk=markers.find(mm=>mm.placeId===state.lastPlaceId);
    if(mk){ state.planeX=mk._x; state.planeY=mk._y; }
  }
  drawAnimatedPlane();

  // message & buttons
  const msg=document.getElementById('mapMsg');
  if(state.locationCountry && state.lastPlaceId){
    const c=getCountry(state.locationCountry);
    const mk=markers.find(m=>m.placeId===state.lastPlaceId);
    msg.textContent=`Current: ${c.name} • ${mk?mk.name:""}`;
  }else msg.textContent='Choose a starting city';

  const btns=document.getElementById('mapButtons'); btns.innerHTML='';
  const cs = activeCase();
  if(cs && !state.finalAnswered &&
     state.xp>=cs.winCondition.minXP &&
     state.visited.length>=cs.winCondition.minVisited &&
     haveRequiredClues()){
    btns.appendChild(btn('Resolve Case', ()=>showFinal()));
  }else{
    btns.appendChild(btn('Journal', ()=>openJournal()));
  }
  btns.appendChild(btn('HQ', ()=>{ showScene('hqScreen'); setupHQ(); }));
}
function enterMap(){
  setMapLoading(!baseMapImage);
  buildMarkers(); hovered=null;
  if(mapRAF) cancelAnimationFrame(mapRAF);
  const loop=()=>{ renderMap(); mapRAF=requestAnimationFrame(loop); };
  loop();
}

/* ===================== Loader scope ===================== */
function setMapLoading(on){
  const s=document.getElementById('mapScreen'); if(!s) return;
  s.classList.toggle('loading', !!on);
}

/* ===================== Map Interaction ===================== */
function onMapMove(e){
  const rect=mapCanvas.getBoundingClientRect();
  const x=e.clientX-rect.left, y=e.clientY-rect.top;
  let nearest=null, d2min=1e12;
  markers.forEach(m=>{ const dx=x-m._x, dy=y-m._y, d2=dx*dx+dy*dy; if(d2<d2min){ d2min=d2; nearest=m; } });
  const thr = 18 * (mapCanvas.width/400);
  if(nearest && d2min<thr*thr){
    hovered=nearest;
    const tip=document.getElementById('mapTooltip');
    tip.textContent=`${nearest.name} • ${getCountry(nearest.countryId).name}`;
    tip.style.left=(x+12)+'px'; tip.style.top=(y+12)+'px';
    tip.style.backgroundImage=`url(${ditherDataUrl})`;
    tip.style.display='block';
  }else{
    hovered=null; document.getElementById('mapTooltip').style.display='none';
  }
}
function onMapOut(){ hovered=null; document.getElementById('mapTooltip').style.display='none'; }
function onMapClick(e){
  if(state.isFlying) return;
  const rect=mapCanvas.getBoundingClientRect();
  const x=e.clientX-rect.left, y=e.clientY-rect.top;
  let target=null, d2min=1e12;
  markers.forEach(m=>{ const dx=x-m._x, dy=y-m._y, d2=dx*dx+dy*dy; if(d2<d2min){ d2min=d2; target=m; } });
  const thr = 18 * (mapCanvas.width/400);
  if(target && d2min<thr*thr){ startFlight(target); }
}
function startFlight(target){
  if(state.locationCountry){
    const ok = DATA.edges.some(([a,b])=> (a===state.locationCountry&&b===target.countryId) || (b===state.locationCountry&&a===target.countryId));
    if(!ok){ alert('You cannot travel directly there.'); return; }
    if(state.tp<=0){ alert('No Travel Points remaining.'); return; }
    state.tp -= 1; toast('-1 TP');
  }
  const from = (state.locationCountry && state.lastPlaceId) ? markers.find(m=>m.placeId===state.lastPlaceId) : target;
  state.isFlying=true;
  state.flightStart=performance.now();
  state.flightDuration=880+Math.random()*260;

  state.flightFromX=from._x; state.flightFromY=from._y;
  state.flightToX=target._x; state.flightToY=target._y;

  const mx=(state.flightFromX+state.flightToX)/2, my=(state.flightFromY+state.flightToY)/2;
  let nx=state.flightToY - state.flightFromY, ny=-(state.flightToX - state.flightFromX);
  const len=Math.max(1, Math.hypot(nx,ny)); nx/=len; ny/=len;
  const lift = 60;
  state.flightCtrlX = mx + nx*lift; state.flightCtrlY = my + ny*lift;

  state.flightDestCountry=target.countryId; state.flightDestPlace=target.placeId;
  if(!state.visited.includes(target.countryId)) state.visited.push(target.countryId);
  saveState();
}
function finishFlight(){
  state.isFlying=false;
  state.locationCountry=state.flightDestCountry;
  state.lastPlaceId=state.flightDestPlace;
  state.planeX=state.flightToX; state.planeY=state.flightToY;
  saveState();
  showCountry(state.locationCountry);
  computeLeads();
  if(Math.random()<0.4) maybeEvent(state.locationCountry);
}

/* ===================== Country Screen ===================== */
function postcard(place,country){
  const w=160,h=100, c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d');
  const pal={
    capital:['#112240','#3A5BA0'],
    heritage:['#2B2147','#6B4F92'],
    port:['#0C2E4F','#1E5F99'],
    amazon:['#123D2A','#2E7D32'],
    other:['#0D2C54','#4CC9F0']
  }[place.type]||['#0D2C54','#4CC9F0'];
  const g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,pal[0]); g.addColorStop(1,pal[1]); x.fillStyle=g; x.fillRect(0,0,w,h);
  x.fillStyle='rgba(10,26,48,.85)';
  const B=(ax,ty,wid,ht)=>x.fillRect(ax,ty,wid,ht);
  const M=(ax,by,wid,ht)=>{ x.beginPath(); x.moveTo(ax,by); x.lineTo(ax+wid/2,by-ht); x.lineTo(ax+wid,by); x.closePath(); x.fill(); };
  const T=(ax,by)=>{ x.fillRect(ax-2,by,4,10); x.beginPath(); x.arc(ax,by-2,6,0,Math.PI*2); x.fill(); };
  if(place.type==='heritage'){ M(20,h-20,42,28); M(58,h-16,48,22); M(102,h-18,36,20);}
  else if(place.type==='port'){ B(18,h-22,12,22); B(36,h-28,10,28); B(52,h-18,10,18); B(70,h-24,12,24); B(88,h-16,12,16);}
  else if(place.type==='amazon'){ x.fillRect(0,h-24,w,8); T(28,h-36); T(66,h-34); T(110,h-39);}
  else { B(20,h-20,14,20); B(40,h-26,10,26); B(58,h-16,8,16); B(74,h-22,12,22); B(92,h-14,12,14); }
  x.fillStyle='#0A1A30'; x.fillRect(w-42,6,36,22); x.strokeStyle='#4CC9F0'; x.strokeRect(w-42,6,36,22);
  x.fillStyle='#E6EDF7'; x.font='bold 10px monospace'; x.fillText(country.name.slice(0,2).toUpperCase(),w-34,20);
  return c;
}
function showCountry(countryId){
  const country=getCountry(countryId);
  const el=document.getElementById('countryContent'); el.innerHTML='';
  const mk=markers.find(m=>m.placeId===state.lastPlaceId) || null;
  if(mk) el.appendChild(postcard(mk,country));
  const h2=document.createElement('h2'); h2.textContent = mk ? `${country.name} • ${mk.name}` : country.name; el.appendChild(h2);
  const npc=document.createElement('div'); npc.className='npc'; npc.textContent=`${country.npcs[Math.floor(Math.random()*country.npcs.length)]}:`; el.appendChild(npc);
  const remaining = country.questions.filter(q=>!state.answered.includes(q.id));
  if(remaining.length){
    const q=remaining[Math.floor(Math.random()*remaining.length)];
    const p=document.createElement('p'); p.textContent=q.prompt; el.appendChild(p);
    q.choices.forEach((t,i)=>{
      const c=document.createElement('div'); c.className='choice'; c.textContent=`${i+1}. ${t}`; c.style.backgroundImage=`url(${ditherDataUrl})`; c.tabIndex=0;
      c.onclick=()=>answer(q,i,c); c.onkeydown=e=>{ if(['1','2','3','4','Enter',' '].includes(e.key)){ if(e.key==='Enter'||e.key===' '){c.click();} else{ const idx=+e.key-1; if(idx>=0&&idx<q.choices.length) answer(q,idx,c);} } };
      el.appendChild(c);
    });
  }else{
    const fact=country.regionFacts[Math.floor(Math.random()*country.regionFacts.length)];
    const p=document.createElement('p'); p.textContent=fact; el.appendChild(p);
    el.appendChild(btn('Back to Map', ()=>{ showScene('mapScreen'); enterMap(); }));
  }
  if(country.brochure){ const br=document.createElement('div'); br.className='brochure'; br.textContent=country.brochure; el.appendChild(br); }
  showScene('countryScreen');
}
function answer(q, idx, elSel){
  if(elSel.dataset.done) return; elSel.dataset.done='y';
  const correct = idx===q.answer;
  const parent=elSel.parentNode;
  if(correct){ state.xp+=2; elSel.classList.add('correct'); sfxCorrect(); toast('⭐ +2 XP!'); }
  else { state.xp=Math.max(0,state.xp-1); elSel.classList.add('incorrect'); sfxWrong(); toast('−1 XP'); }
  state.answered.push(q.id); saveState();
  parent.querySelectorAll('.choice').forEach(c=>c.style.pointerEvents='none');
  setTimeout(()=>{
    const ex=document.createElement('p'); ex.style.fontStyle='italic'; ex.textContent=q.explain; parent.appendChild(ex);
    parent.appendChild(btn('Continue', ()=>{ showScene('mapScreen'); enterMap(); }));
  },250);
}

/* ===================== Events ===================== */
function maybeEvent(countryId){
  const country=getCountry(countryId);
  if(!country.events || !country.events.length) return;
  const pool = country.events.filter(e=>!state.eventsSeen.includes(e.id));
  const evt = (pool.length?pool:country.events)[Math.floor(Math.random()*(pool.length?pool.length:country.events.length))];
  state.eventsSeen.push(evt.id);
  if(evt.effect && typeof evt.effect.tp==='number'){ state.tp=Math.max(0,state.tp+evt.effect.tp); toast((evt.effect.tp>0?'+':'') + evt.effect.tp + ' TP'); }
  if(evt.grantClue){ addClue(evt.grantClue); }
  saveState();
  const content=document.getElementById('countryContent');
  const block=document.createElement('div'); block.style.margin='8px 0';
  block.innerHTML=`<strong>Event:</strong> ${evt.title}<br>${evt.text}`;
  content.appendChild(block);
  if(evt.quickCheck){
    const qc=evt.quickCheck;
    const p=document.createElement('p'); p.textContent=qc.prompt; content.appendChild(p);
    qc.choices.forEach((t,i)=>{
      const c=document.createElement('div'); c.className='choice'; c.textContent=`${i+1}. ${t}`; c.style.backgroundImage=`url(${ditherDataUrl})`; c.tabIndex=0;
      c.onclick=()=>handleQC(qc,i,c); c.onkeydown=e=>{ if(['1','2','3','4','Enter',' '].includes(e.key)){ if(e.key==='Enter'||e.key===' '){c.click();} else{ const idx=+e.key-1; if(idx>=0&&idx<qc.choices.length) handleQC(qc,idx,c);} } };
      content.appendChild(c);
    });
    function handleQC(q, idx, ch){
      if(ch.dataset.done) return; ch.dataset.done='y';
      const ok=idx===q.answer;
      if(ok){ state.xp+=2; ch.classList.add('correct'); sfxCorrect(); toast('⭐ +2 XP!'); }
      else { state.xp=Math.max(0,state.xp-1); ch.classList.add('incorrect'); sfxWrong(); toast('−1 XP'); }
      saveState();
      setTimeout(()=>{
        const ex=document.createElement('p'); ex.style.fontStyle='italic'; ex.textContent=q.explain; content.appendChild(ex);
        content.appendChild(btn('Continue', ()=>{ showScene('mapScreen'); enterMap(); }));
      },250);
      content.querySelectorAll('.choice').forEach(cc=>cc.style.pointerEvents='none');
    }
  }else{
    content.appendChild(btn('Continue', ()=>{ showScene('mapScreen'); enterMap(); }));
  }
}

/* ===================== Journal & Clues ===================== */
function ensureScene(id, innerId){
  let s=document.getElementById(id);
  if(!s){
    const game=document.getElementById('game');
    s=document.createElement('div'); s.id=id; s.className='scene';
    const inner=document.createElement('div'); inner.className='center'; inner.id=innerId;
    s.appendChild(inner); game.appendChild(s);
  }
  return s;
}
function openJournal(){
  ensureScene('journalScreen','journalContent');
  const cs=activeCase(); const el=document.getElementById('journalContent'); el.innerHTML='';
  const head=document.createElement('div'); head.className='journal';
  head.innerHTML = `
    <h2>📓 Journal — ${cs?cs.title:'No Case'}</h2>
    <div class="goal-row">
      <span class="pill ${state.xp>= (cs?.winCondition.minXP||0) ? 'ok':''}">XP ⭐ ${state.xp}/${cs?.winCondition.minXP||0}</span>
      <span class="pill ${state.visited.length>= (cs?.winCondition.minVisited||0) ? 'ok':''}">Visited 📍 ${state.visited.length}/${DATA.countries.length}</span>
      <span class="pill ${haveRequiredClues() ? 'ok hint':''}">Evidence 🗂️ ${state.clues.length}/${(cs?.clues||[]).length}</span>
    </div>
  `;
  el.appendChild(head);

  if(cs && cs.clues){
    const wrap=document.createElement('div'); wrap.className='clue-list';
    cs.clues.forEach(cl=>{
      const have=state.clues.includes(cl.id);
      const d=document.createElement('div'); d.className='clue';
      d.innerHTML = `<strong>${have?'✅':'⬜'} ${cl.title}</strong><br><span style="opacity:.9">${cl.text}</span>`;
      wrap.appendChild(d);
    });
    el.appendChild(wrap);
  }

  computeLeads();
  if(state.leads.length){
    const leads=document.createElement('div'); leads.className='leads';
    const names = state.leads.map(id=>getCountry(id).name).join(', ');
    leads.innerHTML = `<div><span class="lead-dot"></span><em>Leads:</em> ${names}</div>`;
    el.appendChild(leads);
  }

  el.appendChild(btn('Back to Map', ()=>{ showScene('mapScreen'); enterMap(); }));
  showScene('journalScreen');
}
function openClues(){
  ensureScene('clueScreen','clueContent');
  const cs=activeCase(); const el=document.getElementById('clueContent'); el.innerHTML='';
  const h=document.createElement('h2'); h.textContent='🗂️ Collected Clues'; el.appendChild(h);
  if(!state.clues.length){ el.appendChild(Object.assign(document.createElement('p'),{textContent:'No clues yet. Travel and watch for events!'})); }
  const list=document.createElement('div'); list.className='clue-list';
  (cs?.clues||[]).filter(c=>state.clues.includes(c.id)).forEach(cl=>{
    const d=document.createElement('div'); d.className='clue';
    d.innerHTML = `<strong>${cl.title}</strong><br><span style="opacity:.9">${cl.text}</span>`;
    list.appendChild(d);
  });
  el.appendChild(list);
  el.appendChild(btn('Back to Journal', ()=>openJournal()));
  el.appendChild(btn('Back to Map', ()=>{ showScene('mapScreen'); enterMap(); }));
  showScene('clueScreen');
}

/* ===================== Case Resolution ===================== */
function showFinal(){
  const cs=activeCase(); if(!cs) return;
  const fq=cs.winCondition.finalQuestion;
  const el=document.getElementById('finalContent'); el.innerHTML='';
  el.appendChild(Object.assign(document.createElement('h2'),{textContent:'Case Resolution — City of the Condor'}));
  if(cs.requiredClues && cs.requiredClues.length){
    const haveAll = haveRequiredClues();
    const note=document.createElement('p'); note.innerHTML = haveAll ? 'You have the necessary evidence.' : 'You are missing some evidence, but you may still attempt the final question.';
    el.appendChild(note);
  }
  el.appendChild(Object.assign(document.createElement('p'),{textContent:fq.prompt}));
  fq.choices.forEach((t,i)=>{
    const c=document.createElement('div'); c.className='choice'; c.textContent=`${i+1}. ${t}`; c.style.backgroundImage=`url(${ditherDataUrl})`; c.tabIndex=0;
    c.onclick=()=>{
      if(c.dataset.done) return; c.dataset.done='y';
      const ok=i===fq.answer;
      if(ok){ state.xp+=2; c.classList.add('correct'); sfxResolve(); toast('⭐ +2 XP!'); }
      else { state.xp=Math.max(0,state.xp-2); c.classList.add('incorrect'); sfxWrong(); toast('−2 XP'); }
      saveState();
      setTimeout(()=>{
        el.appendChild(Object.assign(document.createElement('p'),{innerHTML:(ok?'You solved the case! ':'Not quite, but case closed.')+' '+fq.explain}));
        state.finalAnswered=true; saveState();
        const code=makeCode(state.studentName,state.className,state.xp,state.visited.length);
        const cp=document.createElement('p'); cp.innerHTML=`Completion Code: <strong>${code}</strong>`; el.appendChild(cp);
        el.appendChild(btn('Back to HQ', ()=>{ state.currentCase=null; saveState(); setupHQ(); showScene('hqScreen'); }));
        el.appendChild(btn('Verify Code', ()=>openVerify()));
      },250);
    };
    c.onkeydown=e=>{ if(['1','2','3','4','Enter',' '].includes(e.key)){ if(e.key==='Enter'||e.key===' '){c.click();} else{ const idx=+e.key-1; const all=el.querySelectorAll('.choice'); if(idx>=0&&idx<all.length) all[idx].click(); } } };
    el.appendChild(c);
  });
  showScene('finalScreen');
}

/* ===================== Verify ===================== */
function openVerify(){ const o=document.getElementById('modalOverlay'); if(o) o.classList.add('active'); const r=document.getElementById('verifyResult'); if(r) r.textContent=''; }
function closeVerify(){ const o=document.getElementById('modalOverlay'); if(o) o.classList.remove('active'); }
function checkVerify(){
  const name=(document.getElementById('verifyName')?.value||'').trim();
  const cls=(document.getElementById('verifyClass')?.value||'').trim();
  const xp=parseInt(document.getElementById('verifyXP')?.value)||0;
  const vis=parseInt(document.getElementById('verifyVisited')?.value)||0;
  const code=(document.getElementById('verifyCode')?.value||'').trim().toUpperCase();
  const ok = (code===makeCode(name,cls,xp,vis));
  const r=document.getElementById('verifyResult'); if(!r) return;
  r.textContent = ok?'Valid ✔':'Invalid ✖'; r.style.color = ok?'#38B000':'#FF5964';
}

/* ===================== Input & Boot ===================== */
let mapEventsBound=false;
function bindMapEvents(){
  if(mapEventsBound) return; mapEventsBound=true;
  mapCanvas.addEventListener('mousemove', onMapMove);
  mapCanvas.addEventListener('mouseout', onMapOut);
  mapCanvas.addEventListener('click', onMapClick);
}
document.addEventListener('keydown', e=>{
  if(e.key==='m'||e.key==='M'){ state.sound=!state.sound; saveState(); updateHUD(); playTone(660,.05); }
  if(e.key==='t'||e.key==='T'){ openVerify(); }
  if(e.key==='j'||e.key==='J'){ openJournal(); }
  if(e.key==='Escape'){ closeVerify(); }
});

function init(){
  generateDither();
  loadState();
  setupTitle();                 // 1) Put the buttons on screen immediately
  updateHUD(); measureHud();    // 2) Safe HUD update

  // 3) Now wire up everything else
  mapCanvas=document.getElementById('mapCanvas'); 
  if(mapCanvas){
    mapCtx=mapCanvas.getContext('2d');
    buildSprites();
    // generate the base map async-ish so the title stays responsive
    requestAnimationFrame(()=>{
      try{
        generateTopoBitmap();
        buildMarkers();
        bindMapEvents();
      }catch(err){ console.error(err); }
    });
  }

  const close=document.getElementById('modalClose'); if(close) close.onclick=closeVerify;
  const verify=document.getElementById('verifyBtn'); if(verify) verify.onclick=checkVerify;
  const snd=hud.sound(); if(snd) snd.onclick=()=>{ state.sound=!state.sound; saveState(); updateHUD(); };

  window.addEventListener('resize', measureHud);
}
window.onload=init;

