(() => {
  'use strict';
  const E = window.CourtEngine;
  const storeKey = 'courtside.club.match.v1:' + new URL('.', location.href).pathname;
  const backup = window.CourtBackup;
  const levels = ['beginner', 'intermediate', 'advanced'];
  const levelName = {beginner:'A', intermediate:'B', advanced:'C'};
  const teamName = {blue:'청팀', white:'백팀'};
  const tabs = {dashboard:['dashboard','대시보드'], roster:['users','선수 명단'], history:['history','경기 기록']};
  const symbols = {
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m16 0v-2a4 4 0 0 0-3-3.9"/><circle cx="10" cy="7.5" r="3.5"/><path d="M16.5 4.3a3.4 3.4 0 0 1 0 6.5"/>',
    usercheck:'<circle cx="9" cy="7.2" r="3.4"/><path d="M3 20v-1.6A4.5 4.5 0 0 1 7.5 14h3.1a4.5 4.5 0 0 1 4.5 4.5V20m.4-10 2.1 2.2 4.4-4.4"/>',
    history:'<path d="M3 12a9 9 0 1 0 2.4-6.1L3 8.4M3 3.7v4.8h4.7"/><path d="M12 7v5l3.5 2"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2.4"/><path d="M7 3v4m10-4v4M3 10h18"/>',
    play:'<path d="m7 4.5 12 7.5-12 7.5z" fill="currentColor" stroke-linejoin="round"/>',
    settings:'<path d="M3 6h7m4 0h7M3 12h11m4 0h3M3 18h4m4 0h10"/><circle cx="12" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="9" cy="18" r="2"/>',
    court:'<rect x="2" y="5" width="20" height="14" rx="1.8"/><path d="M12 5v14M8 5v14m8-14v14M2 12h6m8 0h6"/>',
    trophy:'<path d="M8 3h8v6a4 4 0 0 1-8 0zM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v5m-5 3h10m-7-3h4l2 3H8z"/>',
    user:'<circle cx="12" cy="8" r="3.3"/><path d="M5.7 20v-1.7a5 5 0 0 1 5-5h2.6a5 5 0 0 1 5 5V20"/>',
    edit:'<path d="m15 5 4 4M4 20l4.5-1L20 7.4a1.5 1.5 0 0 0 0-2.1l-1.4-1.4a1.5 1.5 0 0 0-2.1 0L5 15.6z"/>',
    editlist:'<path d="M4 5h15M4 10h10M4 15h6m4 4 5.8-5.8 2 2-5.8 5.8-2.7.7z"/>',
    check:'<path d="m4.5 12 5 5 10-10"/>', plus:'<path d="M12 5v14M5 12h14"/>',
    circleplus:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8m-4-4h8"/>',
    circlecheck:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    x:'<path d="m6 6 12 12M6 18 18 6"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v.5"/>',
    trash:'<path d="M3 6h18M8 6V3h8v3M5.5 6l1 15h11l1-15M10 10v7m4-7v7"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.8"/><path d="m16 16 5 5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    list:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8m-8 4h8m-8 4h5"/>',
    activity:'<path d="M2 12h5l3.5-8L14 20l3-8h5"/>',
    filter:'<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    stop:'<rect x="5" y="5" width="14" height="14" rx="2"/>',
    flag:'<path d="M5 21V4c5-4 9 4 15 0v11c-6 4-10-4-15 0"/>',
    rotate:'<path d="M3 12a9 9 0 1 0 2.5-6.2L3 8.5m0-5v5h5"/>',
    dot:'<circle cx="12" cy="12" r="6" stroke-width="1.5"/>'
  };
  function icon(name,size=18) {
    return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(symbols[name] || symbols.dot)+'</svg>';
  }
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const main = document.querySelector('#main');
  const modal = document.querySelector('#app-dialog');
  let tab = activeTab();
  let queueFilter = 'all';
  let levelFilter = 'all';
  let toastTimer;
  let readError = '';
  function activeTab() {
    const key = location.hash.slice(1);
    return Object.hasOwn(tabs,key) ? key : 'dashboard';
  }
  function readStored() {
    const raw = localStorage.getItem(storeKey);
    if (raw === null) return null;
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Array.isArray(value.players) || !Array.isArray(value.courts) || value.courts.length !== 3 || !Array.isArray(value.history)) throw new Error('저장된 경기 정보를 불러올 수 없습니다.');
    return value;
  }
  let state;
  try { state = readStored() || E.initialState(); }
  catch { state = E.initialState(); readError = '이 브라우저의 저장 상태를 확인해 주세요. 경기 정보를 불러올 수 없습니다.'; }
  const api = {commit,go,notify,confirm:confirmAction,icon,escape,backups:showBackups};
  const voice = window.CourtVoice.create({key:storeKey, state:()=>state, read:readStored, commit, notify,
    redraw:()=>{ if (tab==='dashboard') render(); else updateCallBanner(); }});
  window.addEventListener('click', () => voice.activate(), {capture:true, once:true});
  window.addEventListener('pagehide', voice.leave);
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    state = readStored() || E.initialState();
    window.addEventListener('click', () => voice.activate(), {capture:true, once:true});
    render();
  });
  function notify(message) {
    const toast = document.querySelector('#toast');
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = setTimeout(()=>toast.classList.remove('show'),3900);
  }
  let writeDatabase;
  function writeWithoutWebLocks(apply) {
    if (!window.indexedDB) return apply();
    writeDatabase ??= new Promise((resolve,reject)=>{
      const request=indexedDB.open(storeKey + ':writes', 1);
      request.onupgradeneeded=()=>request.result.createObjectStore('mutex');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    }).catch(error=>{writeDatabase=null; throw error;});
    return writeDatabase.then(db=>new Promise((resolve,reject)=>{
      const tx=db.transaction('mutex','readwrite');
      let result;
      tx.objectStore('mutex').get('state').onsuccess=()=>{
        try {result=apply();} catch(error){reject(error);tx.abort();}
      };
      tx.oncomplete=()=>resolve(result);
      tx.onabort=tx.onerror=()=>reject(tx.error || new Error('저장 상태를 다시 확인해 주세요.'));
    }));
  }
  async function commit(change, options = {}) {
    const apply = () => {
      if (Object.hasOwn(options, 'expected') && localStorage.getItem(storeKey) !== options.expected) {
        throw new Error('다른 탭에서 경기 정보가 바뀌었습니다. 현재 기록을 확인하고 다시 시도해 주세요.');
      }
      const draft = options.replace ? E.initialState() : structuredClone(readStored() || state);
      if (options.replace) {
        let enabled=state.voiceEnabled;
        try { enabled=readStored()?.voiceEnabled ?? enabled; } catch {}
        draft.voiceEnabled=enabled!==false;
      }
      change(draft);
      E.allocate(draft);
      localStorage.setItem(storeKey,JSON.stringify(draft));
      state = draft;
      render();
      voice.sync();
      return true;
    };
    try {
      if (navigator.locks) return await navigator.locks.request(storeKey,apply);
      return await writeWithoutWebLocks(apply);
    } catch(error) {
      notify(error instanceof DOMException ? '브라우저 저장 공간을 확인해 주세요. 변경 사항을 저장할 수 없습니다.' : error.message);
      return false;
    }
  }
  function go(key) {
    if (!Object.hasOwn(tabs,key)) return;
    if (location.hash !== '#'+key) location.hash = key;
    else {tab=key;render();window.scrollTo(0,0);}
  }
  window.addEventListener('hashchange',()=>{
    if(location.hash === '#main') return;
    tab=activeTab();render();window.scrollTo(0,0);
  });
  window.addEventListener('storage',event=>{
    if (event.key !== storeKey && event.key !== null) return;
    try {state=readStored() || E.initialState();render();voice.sync();}
    catch {notify('다른 탭의 경기 정보를 불러올 수 없습니다.');}
  });
  function updateCallBanner() {
    const banner=document.querySelector('#voice-banner');
    const job=voice.current();
    const visible=!!job && tab!=='dashboard';
    banner.hidden=!visible;
    if (visible) {
      const names=job.item.playerIds.map(id=>state.players.find(p=>p.id===id)?.name || '');
      banner.textContent=(job.index+1)+'번 코트 '+levelName[job.item.level]+' 호출 중 · 청팀 '+names.slice(0,2).join(', ')+' / 백팀 '+names.slice(2).join(', ');
    } else banner.textContent='';
  }
  function renderNav() {
    updateCallBanner();
    document.querySelector('#navigation').innerHTML = Object.entries(tabs).map(([key,[glyph,label]])=>
      '<a class="nav-item '+(tab===key?'active':'')+'" href="#'+key+'" '+(tab===key?'aria-current="page"':'')+'>'+icon(glyph,16)+label+'</a>').join('');
    const now = new Date();
    const dateText = new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Seoul'}).format(now);
    document.querySelector('#today').innerHTML=icon('calendar',16)+'<span>'+dateText+'</span>';
    document.title = 'CourtSide | '+tabs[tab][1];
  }
  function render() {
    renderNav();
    if (tab==='roster') return window.Panels.renderRoster(state,main,api);
    if (tab==='history') return window.Panels.renderHistory(state,main,api);
    const busy = new Map();
    state.courts.forEach((match,index)=>match?.playerIds.forEach(id=>busy.set(id,index)));
    const attended = state.players.filter(p=>p.arrival!==null).length;
    const playing = state.courts.filter(Boolean).length;
    main.innerHTML = heroHTML()+statsHTML(attended,playing)+courtsHTML()+waitingHTML(busy);
  }
  function heroHTML() {
    const live = state.phase==='live', ended=state.phase==='ended';
    const phaseLabel=live?'경기 진행 중':ended?'운영 종료':'경기 시작 전';
    const subtitle=live?'도착한 선수의 이름을 누르면 같은 실력의 청백팀이 자동으로 배정됩니다.':ended?'오늘의 경기 기록과 선수별 출전 횟수를 확인하세요.':'선수 출석부터 청백팀 매칭, 코트 배정까지 한눈에 관리하세요.';
    const button=(action,glyph,label,style)=>'<button class="btn '+style+'" data-action="'+action+'">'+icon(glyph,16)+label+'</button>';
    let actions=button('start','play','경기 시작','btn-primary')+button('settings','settings','경기 설정','btn-outline');
    if(live) actions=button('checkin','usercheck','출석 체크','btn-primary')+button('settings','settings','경기 설정','btn-outline')+button('end','stop','운영 종료','btn-outline');
    if(ended) actions=button('history','list','경기 기록','btn-primary');
    actions+=button('voice-settings','settings',state.voiceEnabled===false?'음성 안내 꺼짐':'음성 안내 켜짐','btn-outline');
    if(live || ended) actions+=button('reset','rotate','오늘 경기 초기화','btn-outline');
    return '<section class="hero" aria-labelledby="hero-title"><div class="hero-plane" aria-hidden="true"></div><img class="hero-art" src="assets/hero.webp" alt="" fetchpriority="high"><div class="hero-copy"><span class="phase '+(live?'phase-live':'')+'"><i></i>'+phaseLabel+'</span><h1 id="hero-title">피클볼 운영 대시보드</h1><p>'+subtitle+'</p><div class="hero-actions">'+actions+'</div></div></section>';
  }
  function statsHTML(attended,playing) {
    const total=state.players.length;
    const blue=state.players.filter(p=>p.team==='blue').length;
    const values=[
      ['users','등록 선수',total,'명','청팀 '+blue+' · 백팀 '+(total-blue),'#566bb0','#eaf0fc'],
      ['usercheck','출석 선수',attended,'명','미도착 '+(total-attended)+'명','#397755','#e7f4e8'],
      ['court','사용 중인 코트',playing,'/ 3','빈 코트 '+(3-playing)+'면','#346d90','#e8f2f7'],
      ['trophy','완료된 경기',state.history.length,'경기','1인 목표 '+state.targetGames+'경기','#9a743a','#faf1dd']
    ];
    return '<section class="stats" aria-label="경기 운영 요약">'+values.map(([glyph,label,n,unit,sub,color,bg])=>'<div class="stat"><div class="stat-head"><span class="stat-icon" style="--i:'+color+';--ib:'+bg+'">'+icon(glyph,17)+'</span>'+label+'</div><div class="stat-numbers"><span class="number">'+n+'</span><span class="number-unit">'+unit+'</span><span class="stat-detail">'+sub+'</span></div></div>').join('')+'</section>';
  }
  function levelLabel(level) {
    const i=levels.indexOf(level);
    return '<span class="level '+level+'"><span class="level-bars" aria-hidden="true">'+[0,1,2].map(x=>'<i class="'+(x>i?'off':'')+'"></i>').join('')+'</span>'+levelName[level]+'</span>';
  }
  function lineupHTML(match) {
    return ['blue','white'].map((side,i) => {
      const players=match.playerIds.slice(i*2,i*2+2).map(id=>state.players.find(p=>p.id===id));
      const names=players.map(p=>'<span class="call-person">'+escape(p.name)+' <small>'+p.games+'회</small></span>').join('');
      return '<div class="call-team"><strong><i class="team-dot '+side+'"></i> '+teamName[side]+'</strong><span>'+names+'</span></div>';
    }).join('');
  }
  function nextPoolHTML(previews) {
    const playersById=new Map(state.players.map(p=>[p.id,p]));
    const ids=[...new Set(previews.filter(Boolean).flatMap(match=>match.playerIds))].slice(0,12);
    const players=ids.map(id=>playersById.get(id)).filter(Boolean);
    const cards=players.map(p=>'<li class="next-pool-person"><div class="next-pool-name">'+escape(p.name)+'</div><div class="next-pool-meta"><span><i class="team-dot '+p.team+'"></i> '+teamName[p.team]+'</span>'+levelLabel(p.level)+'<span>'+p.games+'회</span></div></li>').join('');
    return '<section class="next-pool" aria-labelledby="next-pool-title"><div class="call-heading"><div><span class="next-tag" lang="en">NEXT MATCH</span><h3 id="next-pool-title">다음 경기 예정 <span class="count-tag">'+players.length+'명</span></h3></div></div><p class="forecast-note">최대 12명의 공통 예정 명단입니다. 특정 코트에 예약되지 않으며, 실제 배정은 빈 코트와 출석·경기 결과에 따라 달라질 수 있습니다. 이름 옆 횟수는 오늘 완료한 경기 수입니다.</p>'+(players.length?'<ul class="next-pool-list">'+cards+'</ul>':'<p class="next-pool-empty">다음 경기 대기 중</p>')+'</section>';
  }
  function callHTML(call,index) {
    if (!call) return '';
    const speaking=voice.current()?.item.token===call.token;
    const manual=call.manual || voice.suspended();
    const title=manual?'화면 확인 대기':speaking?'지금 음성 호출 중':voice.activated()?'음성 호출 대기':'음성 호출 시작 대기';
    const button=(action,label,cls='')=>'<button type="button" class="'+cls+'" data-action="'+action+'" data-index="'+index+'" data-token="'+escape(call.token)+'">'+label+'</button>';
    let controls='';
    if (manual) controls=button('call-confirm','명단 확인 · 배정','confirm-call')+button('call-retry','다시 듣기');
    else if (speaking) controls=button('call-retry','다시 듣기')+button('call-stop','호출 중지');
    else controls=button('call-start','호출 시작')+button('call-stop','화면으로 확인');
    return '<section class="court-call"><div class="call-heading"><h4>'+title+'</h4>'+levelLabel(call.level)+'</div>'+
      lineupHTML(call)+'<div class="call-tools">'+controls+'</div></section>';
  }
  function voiceSettings() {
    const on=state.voiceEnabled!==false;
    const {rate,uri}=voice.preferences();
    const choices=window.CourtVoice.koreanVoices();
    const rates=[0.7,0.85,1,1.15,1.3,1.5].map(n=>'<option value="'+n+'"'+(n===rate?' selected':'')+'>'+n+'배</option>').join('');
    const voiceChoices=choices.map(v=>'<option value="'+escape(v.voiceURI)+'"'+(v.voiceURI===uri?' selected':'')+'>'+escape(v.name)+'</option>').join('');
    openModal('음성 호출 설정','<div class="voice-fields"><label>배정 전 음성 안내<select id="voice-on"><option value="on"'+(on?' selected':'')+'>켜기</option><option value="off"'+(!on?' selected':'')+'>끄기 · 즉시 배정</option></select></label>'+
      '<label>안내 속도<select id="voice-rate">'+rates+'</select></label><label>한국어 음성<select id="voice-choice"><option value="">기기 기본 한국어 음성</option>'+voiceChoices+'</select></label></div>'+
      '<p class="dialog-text">기기에 설치된 한국어 음성을 사용합니다. 음성이 없거나 재생에 실패하면 코트에서 이름을 확인한 뒤 배정하세요.</p>',
      '<button class="btn btn-light" data-cancel>취소</button><button class="btn btn-primary" data-save>저장</button>');
    const select=modal.querySelector('#voice-choice');
    const refresh=()=>{
      const selected=select.value;
      select.innerHTML='<option value="">기기 기본 한국어 음성</option>'+window.CourtVoice.koreanVoices().map(v=>
        '<option value="'+escape(v.voiceURI)+'">'+escape(v.name)+'</option>').join('');
      if([...select.options].some(o=>o.value===selected)) select.value=selected;
    };
    const synth=window.speechSynthesis;
    synth?.addEventListener?.('voiceschanged',refresh);
    modal.addEventListener('close',()=>synth?.removeEventListener?.('voiceschanged',refresh),{once:true});
    modal.querySelector('[data-cancel]').onclick=()=>modal.close();
    modal.querySelector('[data-save]').onclick=async()=>{
      const enabled=modal.querySelector('#voice-on').value==='on';
      voice.savePreferences(Number(modal.querySelector('#voice-rate').value),select.value);
      if(await commit(s=>{s.voiceEnabled=enabled;})){modal.close();voice.activate();}
    };
  }
  function courtsHTML() {
    const reason=E.waitingReason(state);
    const preview=E.previews(state);
    return '<section class="block" aria-labelledby="court-title"><div class="section-head"><h2 id="court-title">코트 현황 <span class="count-tag">3</span></h2><div class="court-legend"><span><i class="team-dot blue"></i>청팀</span><span><i class="team-dot white"></i>백팀</span></div></div><div class="courts">'+state.courts.map((match,i)=>{
      const call=state.pendingCalls?.[i];
      const badge=match ? levelLabel(match.level) : '<span class="level open-level">등급 자유</span>';
      const status=match?'경기 중':call?'배정 전':state.phase==='ended'?'운영 종료':reason==='target'?'목표 달성':'배정 대기';
      const slots=[0,1,2,3].map(j=>{
        const player=match && state.players.find(p=>p.id===match.playerIds[j]);
        const side=j<2?'blue':'white';
        if(!player) return '<span class="court-slot empty slot-'+j+'" aria-hidden="true">'+icon('user',12)+'</span>';
        return '<span class="court-slot filled '+side+' slot-'+j+'" title="'+teamName[side]+' '+escape(player.name)+'" aria-label="'+teamName[side]+' '+escape(player.name)+'">'+escape(player.name)+'</span>';
      }).join('');
      const action=match?'<button class="finish-btn" data-action="finish" data-index="'+i+'" data-match="'+escape(match.id)+'" aria-label="코트 '+(i+1)+' 경기 완료">'+icon('check',14)+'경기 완료</button>':'<span class="capacity">'+icon('users',14)+'0 / 4</span>';
      const replaying=voice.current()?.replay && voice.current().index===i;
      const replay=match && state.voiceEnabled!==false ? '<button class="call-replay" data-action="'+(replaying?'replay-stop':'replay')+'" data-index="'+i+'" data-match="'+escape(match.id)+'">'+(replaying?'호출 중지':'다시 듣기')+'</button>':'';
      const replayLabel=replaying?'<p class="court-call">지금 다시 호출 중 · '+match.playerIds.map(id=>escape(state.players.find(p=>p.id===id).name)).join(' · ')+'</p>':'';
      return '<article class="court-card" aria-label="코트 '+(i+1)+'"><div class="court-heading"><h3 lang="en">COURT 0'+(i+1)+'</h3>'+badge+'</div><div class="field theme-'+i+'"><div class="field-lines"><span class="net"></span><span class="vs" aria-hidden="true">VS</span>'+slots+'</div></div><div class="court-bottom"><span class="court-status '+(match?'live':'')+'"><i class="status-dot"></i>'+status+'</span><div class="court-replay-tools">'+action+replay+'</div></div>'+replayLabel+callHTML(call,i)+'</article>';
    }).join('')+'</div>'+nextPoolHTML(preview)+'</section>';
  }
  function playerStatus(p,busy) {
    if(busy.has(p.id)) return 'active';
    if(p.arrival===null) return 'absent';
    if(p.games>=state.targetGames) return 'done';
    return 'waiting';
  }
  function playerBox(p,status,busy) {
    const live=state.phase==='live';
    const label=status==='active'?'코트 '+(busy.get(p.id)+1):status==='done'?'목표 달성':status==='waiting'?'대기 중':'미도착';
    const actionable=live && ['waiting','absent'].includes(status);
    const actionText=actionable?(status==='absent'?'출석 체크':'출석 정보'):label;
    const glyph={waiting:'circlecheck',active:'court',done:'trophy',absent:live?'circleplus':'dot'}[status];
    const cls={waiting:'checked',active:'on-court',done:'done',absent:''}[status];
    const attr='class="player-chip '+p.team+'-chip '+cls+(actionable?' clickable':'')+'" title="'+escape(p.name)+' · '+teamName[p.team]+' · '+levelName[p.level]+' · '+label+' · '+p.games+'경기 완료"';
    const content='<span class="chip-name">'+escape(p.name)+'</span><span class="chip-meta">'+levelName[p.level]+(state.phase==='ready'?'':' · '+p.games+'회')+'</span><span class="chip-status">'+icon(glyph,13)+'</span>';
    return actionable?'<button type="button" '+attr+' data-player="'+escape(p.id)+'" aria-label="'+escape(p.name)+' '+actionText+'">'+content+'</button>':'<div '+attr+'>'+content+'</div>';
  }
  function waitingHTML(busy) {
    const statusMap=new Map(state.players.map(p=>[p.id,playerStatus(p,busy)]));
    const counts={all:state.players.length,absent:0,waiting:0,active:0,done:0};
    statusMap.forEach(s=>counts[s]++);
    const filters=[['all','전체'],['absent','미도착'],['waiting','대기 중'],['active','경기 중']];
    if(counts.done || state.phase==='ended') filters.push(['done','목표 달성']);
    if(!filters.some(([key])=>key===queueFilter)) queueFilter='all';
    const tabButtons=filters.map(([key,label])=>'<button type="button" class="queue-tab" data-filter-status="'+key+'" aria-pressed="'+(queueFilter===key)+'">'+label+'<b>'+counts[key]+'</b></button>').join('');
    const choices=['all',...levels].map(l=>'<option value="'+l+'" '+(levelFilter===l?'selected':'')+'>'+(l==='all'?'전체 실력':levelName[l])+'</option>').join('');
    const teams=['blue','white'].map(side=>{
      const group=state.players.filter(p=>p.team===side && (levelFilter==='all' || p.level===levelFilter) && (queueFilter==='all'||statusMap.get(p.id)===queueFilter));
      if(queueFilter==='waiting') group.sort((a,b)=>a.games-b.games||a.queueOrder-b.queueOrder);
      return '<div class="wait-team"><div class="team-head"><i class="team-dot '+side+'"></i><strong>'+teamName[side]+'</strong><span class="qty">'+group.length+'명</span></div>'+(group.length?'<div class="chips">'+group.map(p=>playerBox(p,statusMap.get(p.id),busy)).join('')+'</div>':'<p class="empty-team">해당 선수가 없습니다.</p>')+'</div>';
    }).join('');
    let help='경기를 시작한 뒤 도착한 선수의 이름을 눌러 출석을 체크하세요.';
    if(state.phase==='live') {
      const reason=E.waitingReason(state);
      help=reason==='target'?'출석한 선수 모두 목표를 달성했습니다. 늦게 도착한 선수가 있으면 이름을 눌러 주세요.':'이름을 누르면 출석합니다. 같은 실력의 청팀 2명과 백팀 2명이 모이면 자동 배정됩니다.';
      if(reason==='players' && !busy.size && counts.waiting) {
        const waiting=state.players.filter(p=>statusMap.get(p.id)==='waiting');
        const groups=levels.map(level=>{
          const members=waiting.filter(p=>p.level===level);
          if(!members.length) return '';
          const blue=members.filter(p=>p.team==='blue').length;
          return levelName[level]+' 대기 '+ '청팀 '+blue+'명 · 백팀 '+(members.length-blue)+'명';
        }).filter(Boolean);
        help=groups.join(' / ')+'. 같은 등급에서 목표 경기가 남은 선수가 양 팀에 2명씩 필요합니다.';
      }
    } else if(state.phase==='ended') help='경기 기록에서 오늘의 대진과 선수별 출전 횟수를 확인할 수 있습니다.';
    return '<section class="block" id="waiting" aria-labelledby="waiting-title"><div class="section-head"><h2 id="waiting-title">선수 대기실 <span class="count-tag">'+state.players.length+'</span></h2><button class="section-action" data-action="roster">'+icon('editlist',15)+'명단 관리</button></div><div class="waiting-shell"><div class="waiting-toolbar"><div class="queue-tabs" role="group" aria-label="선수 상태">'+tabButtons+'</div><select class="level-select" id="level-filter" aria-label="대기실 실력 필터">'+choices+'</select></div><div class="wait-teams">'+teams+'</div><div class="queue-hint">'+icon('info',15)+help+'</div></div></section>';
  }
  function openModal(title,body,buttons) {
    if(modal.open) modal.close();
    modal.innerHTML='<div class="dialog-head"><h2 id="dialog-title">'+escape(title)+'</h2><button class="icon-btn" data-dismiss aria-label="닫기">'+icon('x',17)+'</button></div>'+body+'<div class="dialog-actions">'+buttons+'</div>';
    modal.querySelector('[data-dismiss]').onclick=()=>modal.close();
    modal.showModal();
  }
  modal.addEventListener('click',event=>{
    if(event.target!==modal)return;
    const bounds=modal.getBoundingClientRect();
    if(event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom) modal.close();
  });
  function confirmAction({title,message,button,onConfirm}) {
    openModal(title,'<p class="dialog-text">'+escape(message)+'</p>','<button class="btn btn-light" id="cancel">취소</button><button class="btn btn-primary" id="accept">'+escape(button)+'</button>');
    modal.querySelector('#cancel').onclick=()=>modal.close();
    modal.querySelector('#accept').onclick=async event=>{
      event.currentTarget.disabled=true;
      try {await onConfirm();} catch(error){notify(error.message);} finally {modal.close();}
    };
  }
  function showBackups() {
    openModal('백업·복원',
      '<p class="dialog-text">명단 백업에는 이름·팀·등급이, 전체 백업에는 명단과 지난 회차, 오늘 진행 중인 경기까지 담깁니다.</p>' +
      '<div class="backup-actions"><button class="btn btn-light" data-export="roster">선수 명단 내보내기</button>' +
      '<button class="btn btn-light" data-export="full">전체 기록 내보내기</button></div>' +
      '<p class="dialog-text">가져올 코트사이드 JSON 파일을 선택하세요.</p><input type="file" id="backup-file" aria-label="백업 JSON 파일" accept=".json,application/json">',
      '<button class="btn btn-primary" data-close>닫기</button>');
    modal.querySelector('[data-close]').onclick=()=>modal.close();
    modal.querySelectorAll('[data-export]').forEach(button => button.onclick=()=>{
      try {
        const kind=button.dataset.export;
        const data=backup.encode(readStored() || state,kind);
        const url=URL.createObjectURL(new Blob([data], {type:'application/json'}));
        const link=document.createElement('a');
        link.href=url;
        link.download='courtside-'+kind+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),30000);
      } catch { notify('저장 데이터를 읽지 못해 백업할 수 없습니다.'); }
    });
    modal.querySelector('#backup-file').onchange=async event=>{
      const input=event.currentTarget;
      const file=input.files[0];
      if (!file) return;
      try {
        const imported=backup.decode(await file.text());
        if (!input.isConnected || !modal.open) return;
        const full=imported.kind==='full';
        if (!full && state.phase==='ended') throw new Error('명단을 합치려면 먼저 오늘 경기를 초기화해 주세요.');
        const expected=localStorage.getItem(storeKey);
        const players=full ? imported.data.players : imported.data;
        const message=full ? '선수 '+players.length+'명, 당일 완료 '+imported.data.history.length+'경기, 이전 '+imported.data.pastSessions.length+'회차를 복원합니다. 이 브라우저의 명단과 경기 기록 전체를 교체합니다.'
          : '선수 '+players.length+'명의 명단을 합칩니다. 같은 팀에 같은 이름이 있으면 기존 등급과 경기 기록을 유지합니다.';
        confirmAction({title:full?'전체 기록을 복원할까요?':'선수 명단을 합칠까요?',message,button:full?'전체 복원':'명단 합치기',onConfirm:async()=>{
          let added=0;
          const saved=await commit(s=>{
            if (full) {
              Object.assign(s,imported.data);
              E.allocate(s);
            } else added=backup.mergeRoster(s,players);
          },{expected,replace:full});
          if(saved) notify(full?'전체 기록을 복원했습니다.':added+'명을 명단에 추가했습니다.');
        }});
      } catch(error) {
        input.value='';
        notify(error instanceof TypeError ? '백업 파일의 형식과 내용을 확인해 주세요.' : error.message);
      }
    };
  }
  function lineupNotes(target) {
    const uneven=[], odd=[];
    for(const level of levels) {
      const group=state.players.filter(p=>p.level===level);
      if(!group.length) continue;
      const blue=group.filter(p=>p.team==='blue').length, white=group.length-blue;
      if(blue!==white || blue<2) uneven.push(levelName[level]+'(청 '+blue+'명 · 백 '+white+'명)');
      else if(blue%2 && target%2) odd.push(levelName[level]);
    }
    return {uneven,odd};
  }
  function targetNote(value) {
    const {uneven,odd}=lineupNotes(value);
    const notes=[];
    if(uneven.length) notes.push(uneven.join(', ')+' 등급은 양 팀을 같은 인원으로, 최소 2명씩 구성해야 모두 같은 횟수를 채울 수 있습니다.');
    if(odd.length) notes.push(odd.join('·')+' 등급은 팀당 인원이 홀수입니다. 짝수 목표를 선택하면 모두 같은 횟수를 채울 수 있습니다.');
    return notes.join(' ');
  }
  async function startSession() {
    if(!state.players.length) {notify('먼저 선수를 등록해 주세요.');go('roster');return;}
    const begin=async target=>{
      if(await commit(s=>{if(target) s.targetGames=target; E.start(s);})) {
        notify('경기를 시작했습니다. 대기실에서 도착한 선수의 이름을 눌러 주세요.');
        document.querySelector('#waiting')?.scrollIntoView({block:'nearest',behavior:'instant'});
      }
    };
    const {odd}=lineupNotes(state.targetGames);
    if(!odd.length) {await begin();return;}
    const even=state.targetGames+1;
    openModal('1인당 목표 경기 수', '<p class="dialog-text">'+odd.join('·')+' 등급은 팀당 인원이 홀수여서 '+state.targetGames+'경기씩 배정하면 한 자리가 남습니다. '+even+'경기로 시작하면 이 등급도 같은 횟수를 채울 수 있습니다.</p>', '<button class="btn btn-light" id="keep-goal">'+state.targetGames+'경기로 시작</button><button class="btn btn-primary" id="even-goal">'+even+'경기로 시작</button>');
    modal.querySelector('#keep-goal').onclick=()=>{modal.close();begin();};
    modal.querySelector('#even-goal').onclick=()=>{modal.close();begin(even);};
  }
  function settings() {
    const note=state.phase==='live'?'변경한 목표는 다음 배정부터 적용됩니다. 진행 중인 경기는 그대로 마칩니다.':'출전 횟수가 적은 선수부터 배정합니다. 목표를 채우면 다음 배정에서 제외됩니다.';
    openModal('경기 설정','<p class="dialog-text">'+note+'</p><form id="target-form"><label class="target-label" for="target">1인당 목표 경기 수</label><input class="target-input" type="number" inputmode="numeric" min="1" max="20" step="1" id="target" value="'+state.targetGames+'" required>경기<p class="goal-note" id="goal-note" aria-live="polite"></p></form>','<button class="btn btn-light" id="cancel">취소</button><button class="btn btn-primary" type="submit" form="target-form">저장</button>');
    modal.querySelector('#cancel').onclick=()=>modal.close();
    const targetInput=modal.querySelector('#target');
    const updateNote=()=>{modal.querySelector('#goal-note').textContent=targetNote(targetInput.valueAsNumber);};
    targetInput.oninput=updateNote;updateNote();
    modal.querySelector('#target-form').onsubmit=async event=>{
      event.preventDefault();
      const n=modal.querySelector('#target').valueAsNumber;
      if(await commit(s=>E.setTarget(s,n))){modal.close();notify('목표를 1인당 '+n+'경기로 저장했습니다.');}
    };
  }
  function showAttendance() {
    queueFilter='absent';levelFilter='all';render();
    document.querySelector('#waiting').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }
  main.addEventListener('change',event=>{
    if(event.target.id!=='level-filter')return;
    levelFilter=event.target.value;render();document.querySelector('#level-filter').focus({preventScroll:true});
  });
  main.addEventListener('click',async event=>{
    if(tab!=='dashboard')return;
    const button=event.target.closest('button');
    if(!button)return;
    if(button.dataset.filterStatus) {
      queueFilter=button.dataset.filterStatus;render();
      main.querySelector('[data-filter-status="'+queueFilter+'"]').focus({preventScroll:true});return;
    }
    if(button.dataset.player) {
      const id=button.dataset.player, p=state.players.find(player=>player.id===id);
      if(!p)return;
      if(p.arrival===null) {
        const known=new Set(state.courts.filter(Boolean).map(m=>m.id));
        if(await commit(s=>E.arrive(s,id))){
          const newIndex=state.courts.findIndex(m=>m && !known.has(m.id));
          notify(p.name+' 출석 완료'+(newIndex>=0?' · 코트 '+(newIndex+1)+'에 '+levelName[state.courts[newIndex].level]+' 경기 배정':''));
        }
      } else confirmAction({title:p.name+' 선수 출석 정보',message:teamName[p.team]+' · '+levelName[p.level]+' · '+p.games+'경기 완료\n출석을 취소하면 다음 배정에서 제외됩니다.',button:'출석 취소',onConfirm:()=>commit(s=>E.undoArrival(s,id))});
      return;
    }
    switch(button.dataset.action) {
      case 'voice-settings':voiceSettings();break;
      case 'call-start':voice.activate();break;
      case 'replay':voice.replayMatch(Number(button.dataset.index),button.dataset.match);break;
      case 'replay-stop':voice.stopReplay();break;
      case 'call-confirm':
      case 'call-retry':
      case 'call-stop': {
        const index=Number(button.dataset.index), token=button.dataset.token, action=button.dataset.action;
        await commit(s=>{
          const call=s.pendingCalls?.[index];
          if (!call || call.token!==token) return;
          if (action==='call-confirm') E.confirmCall(s,index,token,'manual');
          else {
            call.manual=action==='call-stop';
            call.token=E.callToken();
          }
        });
        if(action==='call-retry') voice.activate();
        break;
      }
      case 'start':
        await startSession();
        break;
      case 'settings':settings();break;
      case 'checkin':showAttendance();break;
      case 'roster':go('roster');break;
      case 'history':go('history');break;
      case 'finish': {
        const i=Number(button.dataset.index),id=button.dataset.match;
        const match=state.courts[i];
        if(!match || match.id!==id)return;
        const names=match.playerIds.map(pid=>state.players.find(p=>p.id===pid).name);
        const buttons=['blue','white'].map(team=>
          '<button class="btn btn-light" data-winner="'+team+'"><i class="team-dot '+team+'"></i>'+teamName[team]+' 승리</button>'
        ).join('')+'<button class="btn btn-light" data-winner="draw">무승부</button>';
        openModal('코트 '+(i+1)+' 경기 완료',
          '<p class="dialog-text">청팀 '+escape(names.slice(0,2).join(' · '))+' / 백팀 '+escape(names.slice(2).join(' · '))+
          '<br>경기 결과를 선택하면 기록을 저장하고 다음 출전 선수를 찾습니다.</p>',buttons);
        modal.querySelectorAll('[data-winner]').forEach(choice=>choice.onclick=async()=>{
          const winner=choice.dataset.winner;
          modal.querySelectorAll('[data-winner]').forEach(b=>b.disabled=true);
          if(await commit(s=>E.finishCourt(s,i,id,winner))) notify('코트 '+(i+1)+' · '+(winner==='draw'?'무승부':teamName[winner]+' 승리')+' 결과를 기록했습니다.');
          modal.close();
        });
        break;
      }
      case 'end': {
        const count=state.courts.filter(Boolean).length;
        confirmAction({title:'오늘 경기를 종료할까요?',message:count?'진행 중인 '+count+'경기는 완료 횟수에서 제외됩니다. 기록할 경기가 있다면 해당 코트에서 먼저 경기 완료를 눌러 주세요.':'완료한 경기와 선수별 출전 횟수는 경기 기록에서 확인할 수 있습니다.',button:'운영 종료',onConfirm:()=>commit(E.end)});break;
      }
      case 'reset':
        {
          const expected=localStorage.getItem(storeKey);
          confirmAction({title:'오늘 경기를 초기화할까요?',message:'출석, 진행 중인 대진과 오늘 출전 횟수를 초기화합니다. 명단과 목표는 유지하고, 완료 경기는 경기 기록의 이전 회차에 보관합니다.',button:'오늘 경기 초기화',onConfirm:()=>commit(s=>{E.resetSession(s);queueFilter='all';levelFilter='all';},{expected})});
          break;
        }
    }
  });
  render();
  if(readError)notify(readError);
  else if(state.phase==='live' && state.courts.includes(null) && E.waitingReason(state)===null) {
    // An older saved session can have a playable group waiting for the previous round.
    commit(E.allocate);
  }
})();
