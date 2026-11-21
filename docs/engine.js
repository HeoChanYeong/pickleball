(function (root) {
  'use strict';

  const levels = ['beginner', 'intermediate', 'advanced'];
  const teams = ['blue', 'white'];

  function initialState() {
    return {
      version: 1,
      phase: 'ready',
      startedAt: null,
      endedAt: null,
      targetGames: 3,
      queueSequence: 0,
      nextPlayerNumber: 1,
      nextMatchNumber: 1,
      players: [],
      pastSessions: [],
      voiceEnabled: true,
      pendingCalls: [null, null, null],
      courts: [null, null, null],
      history: []
    };
  }

  function getPlayer(state, id) {
    const player = state.players.find(candidate => candidate.id === id);
    if (!player) throw new Error('명단에서 선수를 찾을 수 없습니다.');
    return player;
  }

  function requireLive(state) {
    if (state.phase !== 'live') throw new Error('대회 진행 중에 사용할 수 있습니다.');
  }

  function requireTarget(target) {
    if (!Number.isInteger(target) || target < 1 || target > 20) {
      throw new Error('목표 경기 수는 1에서 20 사이의 정수로 입력해 주세요.');
    }
  }

  function activePlayers(state) {
    return new Set(state.courts.filter(Boolean).flatMap(court => court.playerIds));
  }

  function queuePriority(left, right) {
    return left.games - right.games || left.queueOrder - right.queueOrder;
  }

  function nextMatch(state, busy, priority = queuePriority, order = p => p.queueOrder) {
    const waiting = state.players.filter(player =>
      player.arrival !== null && !busy.has(player.id) && player.games < state.targetGames
    ).sort(priority);
    const options = [];
    for (const level of levels) {
      const pairs = teams.map(team =>
        waiting.filter(player => player.level === level && player.team === team).slice(0, 2)
      );
      if (pairs.some(pair => pair.length < 2)) continue;
      const players = pairs.flat();
      options.push({
        level,
        players,
        counts: players.map(player => player.games).sort((a, b) => a - b),
        readyOrder: Math.max(...players.map(order))
      });
    }
    return options.sort(compareOptions)[0];
  }

  function compareOptions(left, right) {
    for (let i = 0; i < left.counts.length; i += 1) {
      const difference = left.counts[i] - right.counts[i];
      if (difference) return difference;
    }
    return left.readyOrder - right.readyOrder;
  }

  function occupied(state) {
    const ids = activePlayers(state);
    for (const call of state.pendingCalls || []) call?.playerIds.forEach(id => ids.add(id));
    return ids;
  }

  function previews(state) {
    if (state.phase !== 'live') return [null, null, null];
    const busy = occupied(state);
    const arrivals = state.players.filter(p => p.arrival !== null).sort((a, b) =>
      a.arrival - b.arrival || (a.checkInOrder ?? a.queueOrder) - (b.checkInOrder ?? b.queueOrder));
    const rank = new Map(arrivals.map((p, index) => [p.id, index]));
    const order = p => rank.get(p.id);
    const priority = (a, b) => a.games - b.games || order(a) - order(b);
    return state.courts.map(() => {
      const match = nextMatch(state, busy, priority, order);
      if (!match) return null;
      const playerIds = match.players.map(p => p.id);
      playerIds.forEach(id => busy.add(id));
      return {level: match.level, playerIds};
    });
  }

  function validCall(state, index, call, busy) {
    if (state.phase !== 'live' || state.courts[index] || !call || call.playerIds.length !== 4 ||
        new Set(call.playerIds).size !== 4) return false;
    return call.playerIds.every((id, position) => {
      const p = state.players.find(player => player.id === id);
      return p && !busy.has(id) && p.arrival !== null && p.games < state.targetGames &&
        p.level === call.level && p.team === teams[Math.floor(position / 2)];
    });
  }

  function startMatch(state, index, call) {
    state.courts[index] = {id: call.id, level: call.level, playerIds: call.playerIds.slice(), startedAt: Date.now()};
    state.pendingCalls[index] = null;
  }

  function callToken() {
    return Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16).padStart(8, '0')).join('');
  }

  function allocate(state, preferredCourt) {
    state.pendingCalls ??= [null, null, null];
    const busy = activePlayers(state);
    for (const [index, call] of state.pendingCalls.entries()) {
      if (!call) continue;
      if (!validCall(state, index, call, busy)) {
        state.pendingCalls[index] = null;
        continue;
      }
      call.playerIds.forEach(id => busy.add(id));
      if (state.voiceEnabled === false) startMatch(state, index, call);
    }
    if (state.phase !== 'live') return;
    const order = [0, 1, 2];
    if (order.includes(preferredCourt)) order.unshift(...order.splice(order.indexOf(preferredCourt), 1));
    for (const index of order) {
      if (state.courts[index] || state.pendingCalls[index]) continue;
      const match = nextMatch(state, busy);
      if (!match) break;
      const playerIds = match.players.map(p => p.id);
      playerIds.forEach(id => busy.add(id));
      const call = {id: 'm' + state.nextMatchNumber++, level: match.level, playerIds};
      if (state.voiceEnabled === false) startMatch(state, index, call);
      else state.pendingCalls[index] = {...call, token: callToken(), manual: false};
    }
  }

  function confirmCall(state, index, token, mode) {
    const call = state.pendingCalls?.[index];
    if (!call || call.token !== token || (mode === 'audio' && call.manual)) return false;
    const busy = activePlayers(state);
    state.pendingCalls.forEach((other, i) => {
      if (other && i !== index) other.playerIds.forEach(id => busy.add(id));
    });
    const valid = validCall(state, index, call, busy);
    if (valid) startMatch(state, index, call);
    allocate(state);
    return valid;
  }

  function waitingReason(state) {
    if (state.phase !== 'live' || !state.courts.includes(null)) return null;
    const checkedIn = state.players.filter(player => player.arrival !== null);
    if (checkedIn.length && checkedIn.every(player => player.games >= state.targetGames)) return 'target';
    return nextMatch(state, occupied(state)) ? null : 'players';
  }

  function setTarget(state, target) {
    if (state.phase === 'ended') throw new Error('새 경기를 준비한 뒤 목표를 변경해 주세요.');
    requireTarget(target);
    state.targetGames = target;
    allocate(state);
  }

  function start(state) {
    if (state.phase !== 'ready') throw new Error('경기 준비 상태에서 시작할 수 있습니다.');
    requireTarget(state.targetGames);
    state.phase = 'live';
    state.startedAt = Date.now();
    allocate(state);
  }

  function arrive(state, id) {
    requireLive(state);
    const player = getPlayer(state, id);
    if (player.arrival !== null) return;
    player.arrival = Date.now();
    player.queueOrder = ++state.queueSequence;
    player.checkInOrder = player.queueOrder;
    allocate(state);
  }

  function undoArrival(state, id) {
    requireLive(state);
    const player = getPlayer(state, id);
    if (activePlayers(state).has(id)) throw new Error('코트에서 경기 중인 선수의 출석은 취소할 수 없습니다.');
    if (player.arrival === null) return;
    player.arrival = null;
    player.queueOrder = 0;
    delete player.checkInOrder;
    allocate(state);
  }

  function finishCourt(state, index, expectedMatchId, winner) {
    requireLive(state);
    const match = state.courts[index];
    if (!match || (expectedMatchId !== undefined && expectedMatchId !== match.id)) {
      throw new Error('종료할 경기를 다시 확인해 주세요.');
    }
    if (!teams.includes(winner) && winner !== 'draw') throw new Error('경기 결과를 선택해 주세요.');
    const players = match.playerIds.map(id => getPlayer(state, id));
    state.history.push({
      ...match,
      playerIds: match.playerIds.slice(),
      courtIndex: index,
      winner,
      endedAt: Date.now(),
      names: players.map(player => player.name)
    });
    for (const player of players) {
      player.games += 1;
      player.queueOrder = ++state.queueSequence;
    }
    state.courts[index] = null;
    allocate(state, index);
  }

  function end(state) {
    requireLive(state);
    state.phase = 'ended';
    state.endedAt = Date.now();
    state.courts.fill(null);
    state.pendingCalls = [null, null, null];
  }

  function resetSession(state) {
    if (state.history.length) {
      state.pastSessions ??= [];
      state.pastSessions.push({
        startedAt: state.startedAt,
        endedAt: state.endedAt ?? Date.now(),
        players: state.players.map(({id, name, team, level, games}) => ({id, name, team, level, games})),
        history: state.history
      });
    }
    for (const player of state.players) {
      player.arrival = null;
      player.queueOrder = 0;
      delete player.checkInOrder;
      player.games = 0;
    }
    state.startedAt = null;
    state.endedAt = null;
    state.queueSequence = 0;
    state.history = [];
    state.courts.fill(null);
    state.pendingCalls = [null, null, null];
    state.phase = 'ready';
  }

  function rosterWritable(state, player) {
    if (state.phase === 'ended') throw new Error('새 대회를 준비한 뒤 명단을 변경해 주세요.');
    if (player && state.phase === 'live' && (player.arrival !== null || player.games > 0)) {
      throw new Error('출석했거나 경기를 마친 선수는 명단을 변경할 수 없습니다.');
    }
  }

  function normalizeName(name) {
    return name.normalize('NFKC').toLowerCase();
  }

  function details(state, data, id) {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) throw new Error('선수 이름을 입력해 주세요.');
    if (!teams.includes(data.team)) throw new Error('청팀 또는 백팀을 선택해 주세요.');
    if (!levels.includes(data.level)) throw new Error('하수, 중수, 고수 중 하나를 선택해 주세요.');
    if (state.players.some(player =>
      player.id !== id && player.team === data.team && normalizeName(player.name) === normalizeName(name)
    )) throw new Error('같은 팀에 같은 이름의 선수가 있습니다. 구분할 이름을 입력해 주세요.');
    return { name, team: data.team, level: data.level };
  }

  function addPlayer(state, data) {
    rosterWritable(state);
    const values = details(state, data);
    const player = {
      id: 'p' + state.nextPlayerNumber++,
      ...values,
      arrival: null,
      queueOrder: 0,
      games: 0
    };
    state.players.push(player);
    return player;
  }

  function updatePlayer(state, id, data) {
    const player = getPlayer(state, id);
    const values = details(state, { ...player, ...data }, id);
    const identityChanged = values.name !== player.name || values.team !== player.team;
    rosterWritable(state, identityChanged ? player : null);
    const levelChanged = values.level !== player.level;
    Object.assign(player, values);
    if (levelChanged) allocate(state);
    return player;
  }

  function removePlayer(state, id) {
    const player = getPlayer(state, id);
    rosterWritable(state, player);
    state.players.splice(state.players.indexOf(player), 1);
  }

  const api = {
    initialState, start, arrive, undoArrival, finishCourt, end, resetSession, allocate,
    addPlayer, updatePlayer, removePlayer, waitingReason, setTarget, previews, confirmCall, callToken
  };
  root.CourtEngine = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
