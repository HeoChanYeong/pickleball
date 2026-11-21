(() => {
  'use strict';
  const format = 'courtside-backup';
  const levels = ['beginner', 'intermediate', 'advanced'];
  const teams = ['blue', 'white'];
  const E = window.CourtEngine;

  function check(condition, message) {
    if (!condition) throw new Error(message || '코트사이드 백업 형식과 내용을 확인해 주세요.');
  }
  function number(value) {
    check(Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER);
    return value;
  }
  function date(value) {
    check(value === null || (Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000));
    return value;
  }
  function identity(p) {
    check(p && typeof p.name === 'string' && p.name.trim() && teams.includes(p.team) && levels.includes(p.level));
    return { name: p.name.trim(), team: p.team, level: p.level };
  }
  function rosterKey(p) {
    return p.team + '/' + p.name.normalize('NFKC').toLowerCase();
  }
  function unique(values) {
    check(new Set(values).size === values.length, '중복된 선수 또는 경기 항목이 있습니다.');
  }
  function player(p, archived) {
    const item = { ...identity(p), id: p.id, games: number(p.games) };
    check(typeof item.id === 'string' && /^p[1-9]\d*$/.test(item.id));
    if (!archived) Object.assign(item, { arrival: date(p.arrival), queueOrder: number(p.queueOrder) });
    if (!archived && p.checkInOrder != null) item.checkInOrder = number(p.checkInOrder);
    return item;
  }
  function roster(raw, archived) {
    check(Array.isArray(raw));
    const players = raw.map(p => player(p, archived));
    unique(players.map(p => p.id));
    unique(players.map(rosterKey));
    return players;
  }
  function match(m, people, completed) {
    check(m && typeof m.id === 'string' && /^m[1-9]\d*$/.test(m.id) && levels.includes(m.level));
    check(Array.isArray(m.playerIds) && m.playerIds.length === 4 && m.startedAt != null);
    unique(m.playerIds);
    const entry = { id: m.id, level: m.level, playerIds: m.playerIds.slice(), startedAt: date(m.startedAt) };
    entry.playerIds.forEach((id, i) => {
      const p = people.get(id);
      check(p && p.team === teams[Math.floor(i / 2)] && (completed || p.arrival != null));
    });
    if (completed) {
      check(Number.isInteger(m.courtIndex) && m.courtIndex >= 0 && m.courtIndex < 3 && m.endedAt != null);
      entry.courtIndex = m.courtIndex;
      entry.endedAt = date(m.endedAt);
      check(m.winner == null || m.winner === 'draw' || teams.includes(m.winner));
      if (m.winner != null) entry.winner = m.winner;
      if (m.names != null) {
        check(Array.isArray(m.names) && m.names.length === 4 && m.names.every(name => typeof name === 'string'));
        entry.names = m.names.slice();
      }
    }
    return entry;
  }
  function session(raw, archived) {
    check(raw && Array.isArray(raw.history));
    const players = roster(raw.players, archived);
    const people = new Map(players.map(p => [p.id, p]));
    const history = raw.history.map(m => match(m, people, true));
    unique(history.map(m => m.id));
    const games = new Map();
    for (const m of history) {
      for (const id of m.playerIds) games.set(id, (games.get(id) || 0) + 1);
    }
    check(players.every(p => p.games === (games.get(p.id) || 0)), '완료 경기와 선수별 출전 횟수가 일치하지 않습니다.');
    const result = { startedAt: date(raw.startedAt), endedAt: date(raw.endedAt), players, history };
    if (archived) {
      check(result.startedAt !== null && result.endedAt !== null);
      return result;
    }
    check(raw.version === 1 && ['ready','live','ended'].includes(raw.phase));
    check(Number.isInteger(raw.targetGames) && raw.targetGames >= 1 && raw.targetGames <= 20);
    check(Array.isArray(raw.courts) && raw.courts.length === 3);
    const courts = raw.courts.map(m => m === null ? null : match(m, people, false));
    const active = courts.filter(Boolean);
    check(!active.length || raw.phase === 'live');
    check((raw.phase === 'ready') === (result.startedAt === null) && (raw.phase === 'ended') === (result.endedAt !== null));
    unique(active.flatMap(m => m.playerIds));
    unique([...history, ...active].map(m => m.id));
    const queueSequence = number(raw.queueSequence);
    const nextPlayerNumber = number(raw.nextPlayerNumber);
    const nextMatchNumber = number(raw.nextMatchNumber);
    check(nextPlayerNumber > 0 && nextMatchNumber > 0);
    check(players.every(p => Number(p.id.slice(1)) < nextPlayerNumber && p.queueOrder <= queueSequence));
    check([...history, ...active].every(m => Number(m.id.slice(1)) < nextMatchNumber));
    const past = raw.pastSessions ?? [];
    check(Array.isArray(past));
    return { ...result, version: 1, phase: raw.phase, targetGames: raw.targetGames, courts,
      queueSequence, nextPlayerNumber, nextMatchNumber, pastSessions: past.map(s => session(s, true)) };
  }
  function encode(state, kind) {
    const {pendingCalls, voiceEnabled, ...matchData} = state;
    const payload = kind === 'roster' ? state.players.map(identity) : matchData;
    return JSON.stringify({ format, version: 1, kind, payload }, null, 2);
  }
  function decode(text) {
    let input;
    try { input = JSON.parse(text.replace(/^\uFEFF/, '')); }
    catch { throw new Error('올바른 JSON 파일을 선택해 주세요.'); }
    check(input && typeof input === 'object');
    if (!Object.hasOwn(input, 'format')) return { kind: 'full', data: session(input, false) };
    check(input.format === format && input.version === 1);
    if (input.kind === 'full') return { kind: 'full', data: session(input.payload, false) };
    check(input.kind === 'roster' && Array.isArray(input.payload));
    const data = input.payload.map(identity);
    unique(data.map(rosterKey));
    return { kind: 'roster', data };
  }
  function mergeRoster(state, items) {
    const keys = new Set(state.players.map(rosterKey));
    const added = items.filter(p => !keys.has(rosterKey(p)));
    for (const p of added) E.addPlayer(state, p);
    return added.length;
  }
  window.CourtBackup = { encode, decode, mergeRoster };
})();
