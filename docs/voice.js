(() => {
  'use strict';

  const grades = {beginner: '하수', intermediate: '중수', advanced: '고수'};
  const E = window.CourtEngine;

  function koreanVoices() {
    try {
      return (window.speechSynthesis?.getVoices() || []).filter(v =>
        v.localService && /^ko(?:[-_]|$)/i.test(v.lang));
    } catch { return []; }
  }

  // An open connection blocks higher-version opens in other tabs. Only the tab
  // that actually upgraded the empty database owns this turn, until close().
  async function takeAudioTurn(dbName) {
    function open(version) {
      return new Promise((resolve,reject)=>{
        const request = version === undefined ? indexedDB.open(dbName) : indexedDB.open(dbName,version);
        let upgraded = false;
        request.onupgradeneeded = () => { upgraded = true; };
        request.onsuccess = () => resolve({db:request.result, upgraded});
        request.onerror = () => reject(request.error);
      });
    }
    while (true) {
      const {db} = await open();
      const nextVersion = db.version + 1;
      db.close();
      try {
        const turn = await open(nextVersion);
        if (turn.upgraded) return () => turn.db.close();
        turn.db.close();
      } catch (error) {
        if (error.name !== 'VersionError') throw error;
      }
    }
  }

  function create({key, state, read, commit, redraw, notify}) {
    const synth = window.speechSynthesis;
    let prefs = {};
    let activated = false;
    let working = false;
    let rerun = false;
    let suspended = false;
    let replay = null;
    let current = null;
    let remote = null;
    let channel;
    try { if (window.BroadcastChannel) channel = new BroadcastChannel(key + ':voice-status'); } catch {}
    function publish(type, job) {
      if (!channel) return;
      const message = job ? {type, index: job.index, run: job.run, replay: !!job.replay,
        id: job.item.id, token: job.item.token, startedAt: job.item.startedAt} : {type};
      try { channel.postMessage(message); } catch {}
    }
    if (channel) {
      channel.onmessage = ({data}) => {
        if (!data || typeof data !== 'object') return;
        if (data.type === 'query' && current) publish('start',current);
        if (data.type === 'stop' && current?.replay && current.run === data.run) current.cancel();
        if (data.type === 'end' && remote?.run === data.run) {remote=null; redraw();}
        if (data.type !== 'start' || ![0,1,2].includes(data.index)) return;
        const s=state();
        const item=data.replay ? s.courts[data.index] : s.pendingCalls?.[data.index];
        if (!item || item.id!==data.id || (data.replay ? item.startedAt!==data.startedAt : item.token!==data.token)) return;
        remote={index:data.index,item,replay:!!data.replay,run:data.run};
        redraw();
      };
      publish('query');
    }

    function preferences() {
      try {
        const raw = localStorage.getItem(key + ':speech');
        if (raw) prefs = JSON.parse(raw) || {};
      } catch {}
      const rate = Number(prefs.rate);
      return {rate: rate >= 0.7 && rate <= 1.5 ? rate : 1, uri: String(prefs.uri || '')};
    }
    function savePreferences(rate, uri) {
      prefs = {rate, uri};
      try { localStorage.setItem(key + ':speech', JSON.stringify(prefs)); }
      catch { notify('속도와 음성 선택은 이번 창에서만 적용됩니다.'); }
    }
    function jobMatches(s, job) {
      if (s.phase !== 'live' || s.voiceEnabled === false) return false;
      const item = job.replay ? s.courts[job.index] : s.pendingCalls?.[job.index];
      return !!item && (job.replay ? item.id === job.item.id && item.startedAt === job.item.startedAt :
        item.token === job.item.token && !item.manual);
    }
    function next(s) {
      if (s.voiceEnabled === false || s.phase !== 'live') return null;
      const calls = (s.pendingCalls || []).map((item, index) => ({item, index}))
        .filter(job => job.item && !job.item.manual)
        .sort((a, b) => Number(a.item.id.slice(1)) - Number(b.item.id.slice(1)));
      return calls[0] || (replay && jobMatches(s, replay) ? replay : null);
    }
    function say(s, job) {
      const {rate, uri} = preferences();
      const voices = koreanVoices();
      const voice = voices.find(v => v.voiceURI === uri) || voices.find(v => v.default) || voices[0];
      if (!voice || !synth || !window.SpeechSynthesisUtterance) return Promise.resolve('failed');
      const names = job.item.playerIds.map(id => s.players.find(p => p.id === id).name);
      const court = (job.index + 1) + '번 코트';
      const text = court + ', ' + grades[job.item.level] + ' 다음 경기 선수를 안내합니다. 청팀 ' +
        names.slice(0, 2).join(' 선수, ') + ' 선수. 백팀 ' + names.slice(2).join(' 선수, ') +
        ' 선수. 네 분은 ' + court + '로 이동해 주세요.';
      return new Promise(resolve => {
        let settled = false;
        let timer;
        let utterance;
        function finish(result, cancel = false) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (utterance) utterance.onend = utterance.onerror = null;
          if (cancel) { try { synth.cancel(); } catch {} }
          resolve(result);
        }
        try {
          utterance = new window.SpeechSynthesisUtterance(text);
          utterance.voice = voice;
          utterance.lang = 'ko-KR';
          utterance.rate = rate;
          utterance.onend = () => finish('ended');
          utterance.onerror = () => finish('failed', true);
          // Some browsers never dispatch an end or an error after losing their audio device.
          timer = setTimeout(() => finish('failed', true), Math.max(22000, Math.min(180000, text.length * 350 / rate)));
          current = {...job, run:E.callToken(), cancel: () => finish('cancelled', true)};
          publish('start',current);
          redraw();
          synth.speak(utterance);
        } catch { finish('failed', true); }
      });
    }
    async function playNext(allowAudio) {
      if (!activated || suspended) return;
      const s = read() || state();
      const job = next(s);
      if (!job) return;
      if (job.replay) replay = null;
      const outcome = allowAudio ? await say(s, job) : 'failed';
      if (current) publish('end',current);
      current = null;
      redraw();
      if (job.replay) {
        if (outcome === 'failed') notify('음성을 재생할 수 없습니다. 코트에 표시된 선수 이름을 확인해 주세요.');
      } else if (outcome !== 'cancelled') {
        const ok = await commit(draft => {
          if (!jobMatches(draft, job)) return;
          if (outcome === 'ended') E.confirmCall(draft, job.index, job.item.token, 'audio');
          else draft.pendingCalls[job.index].manual = true;
        });
        if (!ok) { suspended = true; return; }
      }
      rerun = true;
    }
    async function pump() {
      if (!activated || suspended || working || !next(state())) return;
      working = true;
      rerun = false;
      try {
        if (navigator.locks) await navigator.locks.request(key + ':announcer', () => playNext(true));
        else if (window.indexedDB) {
          let release;
          try { release=await takeAudioTurn(key + ':announcer'); } catch {}
          try { await playNext(!!release); } finally { release?.(); }
        } else await playNext(false);
      } catch { suspended = true; notify('자동 호출을 진행할 수 없습니다. 코트에서 명단을 확인해 배정하세요.'); }
      finally {
        working = false;
        if (suspended) redraw();
        if (rerun && !suspended) queueMicrotask(pump);
      }
    }
    function sync() {
      if (remote && !jobMatches(state(),remote)) { remote=null; redraw(); }
      if (current && !jobMatches(state(), current)) current.cancel();
      if (replay && !jobMatches(state(), replay)) replay = null;
      if (working) rerun = true;
      else queueMicrotask(pump);
    }
    function activate() {
      activated = true;
      suspended = false;
      sync();
    }
    function replayMatch(index, id) {
      const item = state().courts[index];
      if (!item || item.id !== id || state().voiceEnabled === false) return;
      if (current?.replay) current.cancel();
      replay = {index, item, replay: true};
      activate();
    }
    function stopReplay() {
      if (remote?.replay) publish('stop',remote);
      replay = null;
      if (current?.replay) current.cancel();
    }
    function leave() {
      suspended = true;
      activated = false;
      replay = null;
      if (current) publish('end',current);
      current?.cancel();
    }
    return {sync, activate, leave, preferences, savePreferences, replayMatch, stopReplay,
      current: () => current || remote, activated: () => activated, suspended: () => suspended};
  }

  window.CourtVoice = {create, koreanVoices};
})();
