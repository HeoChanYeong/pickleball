(() => {
  "use strict";

  const teamNames = { blue: "청팀", white: "백팀" };
  const levelNames = { beginner: "A", intermediate: "B", advanced: "C" };
  const rosterFilters = { query: "", team: "", level: "" };
  let historyTab = "matches";
  let sessionFilter = "";
  let courtFilter = "";
  let activeEditor = null;

  function textValue(value) {
    return String(value == null ? "" : value);
  }

  function searchable(name) {
    return textValue(name).normalize("NFKC").trim().toLocaleLowerCase("ko");
  }

  function playersOnCourt(state) {
    return new Set(state.courts.filter(Boolean).flatMap(court => court.playerIds));
  }

  function writable(state, player) {
    return state.phase === "ready" ||
      (state.phase === "live" && player.arrival == null && player.games === 0);
  }

  function statusOf(player, occupied, state) {
    const phase = state.phase;
    if (occupied.has(player.id)) return { name: "경기 중", style: "playing" };
    if (player.games >= state.targetGames) return { name: "목표 달성", style: "present" };
    if (phase === "ended" && (player.arrival != null || player.games)) return { name: "참석", style: "present" };
    if (player.arrival != null) return { name: "대기 중", style: "present" };
    return { name: "미도착", style: "absent" };
  }

  function teamPill(team, winner) {
    return '<span class="cp-team cp-team-' + team + '"><i aria-hidden="true"></i>' + teamNames[team] + (winner === team ? ' 승리' : '') + '</span>';
  }

  function levelLabel(level) {
    return '<span class="cp-level cp-level-' + level + '"><span class="cp-meter" aria-hidden="true"><i></i><i></i><i></i></span>' + levelNames[level] + '</span>';
  }

  function levelPicker(player, api) {
    const choices = Object.entries(levelNames).map(([level, label]) =>
      '<option value="' + level + '"' + (level === player.level ? ' selected' : '') + '>' + label + '</option>'
    ).join("");
    return '<select class="level-select" data-player-level="' + api.escape(player.id) + '" aria-label="' +
      api.escape(player.name) + ' 등급 변경">' + choices + '</select>';
  }

  function selector(label, field, options, current) {
    const choices = options.map(([val, name]) =>
      '<option value="' + val + '"' + (val === current ? ' selected' : '') + '>' + name + '</option>'
    ).join("");
    return '<label class="cp-select"><span class="cp-vh">' + label + '</span><select data-filter="' + field + '">' +
      choices + '</select><svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></label>';
  }

  function emptyState(icon, title, description) {
    return '<div class="cp-empty"><span class="cp-empty-icon" aria-hidden="true">' + icon + '</span>' +
      '<strong>' + title + '</strong><p>' + description + '</p></div>';
  }

  function drawRosterRows(state, el, api) {
    const occupied = playersOnCourt(state);
    const query = searchable(rosterFilters.query);
    const list = state.players.filter(p =>
      searchable(p.name).includes(query) &&
      (!rosterFilters.team || p.team === rosterFilters.team) &&
      (!rosterFilters.level || p.level === rosterFilters.level)
    );
    if (!list.length) {
      el.innerHTML = state.players.length
        ? emptyState(api.icon("search", 26), "조건에 맞는 선수가 없습니다", "다른 이름을 입력하거나 팀과 등급을 변경해 보세요.") +
          '<div class="cp-empty-action"><button class="cp-btn" type="button" data-clear-filters>필터 초기화</button></div>'
        : emptyState(api.icon("users", 28), "등록된 선수가 없습니다", "선수 등록을 눌러 첫 번째 선수의 이름과 팀, 등급을 입력하세요.");
      return;
    }
    el.innerHTML = '<table class="cp-table"><caption class="cp-vh">선수 명단</caption><thead><tr>' +
      '<th scope="col">선수 이름</th><th scope="col">소속 팀</th><th scope="col">등급</th><th scope="col">출석 상태</th>' +
      '<th scope="col">완료 경기</th><th scope="col"><span class="cp-vh">관리</span></th></tr></thead><tbody>' +
      list.map(p => {
        const s = statusOf(p, occupied, state);
        const name = api.escape(p.name);
        const id = api.escape(textValue(p.id));
        const actions = writable(state, p)
          ? '<button type="button" class="cp-icon-btn" data-edit="' + id + '" aria-label="' + name + ' 수정" title="선수 수정">' + api.icon("edit", 17) + '</button>' +
            '<button type="button" class="cp-icon-btn cp-danger-icon" data-delete="' + id + '" aria-label="' + name + ' 삭제" title="선수 삭제">' + api.icon("trash", 17) + '</button>' : '';
        return '<tr><th scope="row"><span class="cp-player"><span class="cp-avatar cp-avatar-' + p.team + '" aria-hidden="true">' +
          api.escape(Array.from(p.name.trim())[0] || "·") + '</span><span class="cp-name">' + name + '</span></span></th>' +
          '<td>' + teamPill(p.team) + '</td><td>' + (state.phase === "live" ? levelPicker(p, api) : levelLabel(p.level)) + '</td><td><span class="cp-status cp-status-' + s.style + '">' +
          s.name + '</span></td><td><span class="cp-number">' + p.games + '</span><span class="cp-unit">회</span></td>' +
          '<td class="cp-actions">' + actions + '</td></tr>';
      }).join("") + '</tbody></table>';
  }

  function choiceGroup(name, label, options, current) {
    return '<fieldset class="cp-fieldset"><legend>' + label + '</legend><div class="cp-choice-row">' +
      Object.entries(options).map(([key, value]) =>
        '<label class="cp-choice"><input type="radio" name="' + name + '" value="' + key + '"' +
        (key === current ? ' checked' : '') + ' required><span>' +
        (name === "team" ? '<i class="cp-choice-team cp-choice-' + key + '" aria-hidden="true"></i>' : '') + value +
        '</span></label>').join("") + '</div></fieldset>';
  }

  function editPlayers(state, player, api) {
    if (activeEditor) activeEditor.close();
    const dialog = document.createElement("dialog");
    dialog.className = "cp-dialog";
    dialog.setAttribute("aria-labelledby", "cp-dialog-title");
    const title = player ? "선수 정보 수정" : "선수 등록";
    const nameInput = player
      ? '<input class="cp-text" id="cp-names" name="names" type="text" required value="' + api.escape(player.name) + '" autocomplete="off" autofocus>'
      : '<textarea class="cp-text" id="cp-names" name="names" rows="3" required placeholder="선수 이름을 한 줄에 한 명씩 입력" autofocus></textarea>' +
        '<span class="cp-help" id="cp-names-help">같은 팀과 등급의 선수 이름을 쉼표나 줄바꿈으로 구분하세요.</span>';
    dialog.innerHTML = '<form class="cp-editor"><header><h2 id="cp-dialog-title">' + title + '</h2>' +
      '<button class="cp-icon-btn" type="button" data-dismiss aria-label="닫기">' + api.icon("x", 21) + '</button></header>' +
      '<div class="cp-editor-body"><label class="cp-field" for="cp-names"><span>선수 이름</span>' + nameInput + '</label>' +
      choiceGroup("team", "소속 팀", teamNames, player ? player.team : rosterFilters.team || "blue") +
      choiceGroup("level", "실력 등급", levelNames, player ? player.level : rosterFilters.level || "beginner") +
      '<p class="cp-form-error" role="alert" hidden></p></div><footer><button class="cp-btn" type="button" data-dismiss>취소</button>' +
      '<button class="cp-btn cp-primary" type="submit">' + (player ? "수정 저장" : "등록하기") + '</button></footer></form>';
    document.body.append(dialog);
    activeEditor = dialog;
    if (!player) dialog.querySelector("textarea").setAttribute("aria-describedby", "cp-names-help");
    dialog.querySelectorAll("[data-dismiss]").forEach(button => button.onclick = () => dialog.close());
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      if (activeEditor === dialog) activeEditor = null;
    }, {once: true});
    dialog.querySelector("form").onsubmit = async event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const fields = { team: values.get("team"), level: values.get("level") };
      const names = player
        ? [values.get("names").trim()]
        : values.get("names").split(/[,，、\r\n]+/).map(name => name.trim()).filter(Boolean);
      const error = dialog.querySelector(".cp-form-error");
      if (!names.length || !names[0]) {
        error.textContent = "선수 이름을 입력해 주세요.";
        error.hidden = false;
        return;
      }
      const submit = dialog.querySelector("button[type=submit]");
      if (submit.disabled) return;
      submit.disabled = true;
      const saved = await api.commit(live => {
        const draft = JSON.parse(JSON.stringify(live));
        try {
          if (player) {
            const edited = { ...fields, name: names[0] };
            const changes = Object.fromEntries(Object.entries(edited).filter(([key, value]) => value !== player[key]));
            CourtEngine.updatePlayer(draft, player.id, changes);
          } else names.forEach(name => CourtEngine.addPlayer(draft, { ...fields, name }));
        } catch (reason) {
          error.textContent = reason.message || "선수 정보를 확인해 주세요.";
          error.hidden = false;
          throw reason;
        }
        Object.assign(live, draft);
      });
      submit.disabled = false;
      if (saved) {
        dialog.close();
        api.notify(player ? "선수 정보를 수정했습니다." : names.length + "명을 등록했습니다.");
      }
    };
    dialog.showModal();
  }

  function renderRoster(state, container, api) {
    const blueCount = state.players.filter(p => p.team === "blue").length;
    const description = state.phase === "live"
      ? "등급 칸에서 A·B·C를 변경하세요. 새 등급은 다음 배정부터 적용됩니다."
      : "선수 이름과 소속 팀, 실력 등급을 관리하세요.";
    container.innerHTML = '<section class="cs-panel" aria-labelledby="cp-roster-heading"><div class="cp-page-heading"><div><h1 id="cp-roster-heading">선수 명단</h1>' +
      '<p>' + description + '</p></div>' +
      '<div class="cp-page-actions"><button type="button" class="cp-btn" data-backup>백업·복원</button>' +
      (state.phase !== "ended" ? '<button class="cp-btn cp-primary" data-add type="button">' + api.icon("plus", 18) + '선수 등록</button>' : '') +
      '</div></div><div class="cp-surface"><div class="cp-surface-head"><h2>등록 선수 <span class="cp-count">' + state.players.length +
      '명</span></h2><div class="cp-team-summary"><span><i class="cp-dot-blue"></i>청팀 <b>' + blueCount + '</b>명</span><span><i class="cp-dot-white"></i>백팀 <b>' +
      (state.players.length - blueCount) + '</b>명</span></div></div><div class="cp-toolbar"><label class="cp-search">' +
      api.icon("search", 18) + '<span class="cp-vh">선수 이름 검색</span><input type="search" placeholder="선수 이름 검색" value="' +
      api.escape(rosterFilters.query) + '"></label>' +
      selector("팀 선택", "team", [["","전체 팀"], ...Object.entries(teamNames)], rosterFilters.team) +
      selector("등급 선택", "level", [["","전체 등급"], ...Object.entries(levelNames)], rosterFilters.level) +
      '</div><div class="cp-rows" data-rows></div></div>' +
      (state.phase === "ready" && state.players.length ? '<div class="cp-reset"><button type="button" data-clear class="cp-text-btn">' + api.icon("trash", 15) + '명단 비우기</button></div>' : '') + '</section>';
    const view = container.querySelector(".cs-panel");
    const rows = view.querySelector("[data-rows]");
    drawRosterRows(state, rows, api);
    view.querySelector("input[type=search]").oninput = e => {
      rosterFilters.query = e.target.value;
      drawRosterRows(state, rows, api);
    };
    view.querySelectorAll("[data-filter]").forEach(select => select.onchange = () => {
      rosterFilters[select.dataset.filter] = select.value;
      drawRosterRows(state, rows, api);
    });
    view.onchange = async event => {
      const select = event.target;
      const id = select.dataset.playerLevel;
      if (!id) return;
      const player = state.players.find(p => p.id === id);
      const level = select.value;
      select.disabled = true;
      const saved = await api.commit(s => CourtEngine.updatePlayer(s, id, { level }));
      if (saved) {
        api.notify(player.name + ' 선수의 등급을 ' + levelNames[level] + '로 변경했습니다.');
        const next = container.querySelector('[data-player-level="' + CSS.escape(id) + '"]') || container.querySelector('[data-filter="level"]');
        next?.focus({preventScroll: true});
      } else {
        select.value = player.level;
        select.disabled = false;
      }
    };
    view.onclick = e => {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.hasAttribute("data-clear-filters")) {
        Object.assign(rosterFilters, {query: "", team: "", level: ""});
        renderRoster(state, container, api);
        return;
      }
      if (btn.hasAttribute("data-backup")) return api.backups();
      if (btn.hasAttribute("data-add")) {
        editPlayers(state, null, api);
      } else if (btn.hasAttribute("data-clear")) {
        api.confirm({title: "선수 명단을 비울까요?", message: "등록된 선수 " + state.players.length + "명이 모두 삭제됩니다.", button: "명단 비우기",
          onConfirm: () => api.commit(s => {
            if (s.phase !== "ready") throw new Error("경기 시작 전에만 명단을 비울 수 있습니다.");
            const draft = JSON.parse(JSON.stringify(s));
            [...draft.players].forEach(p => CourtEngine.removePlayer(draft, p.id));
            Object.assign(s, draft);
            Object.assign(rosterFilters, {query: "", team: "", level: ""});
          })});
      } else if (btn.hasAttribute("data-edit") || btn.hasAttribute("data-delete")) {
        const id = btn.hasAttribute("data-edit") ? btn.dataset.edit : btn.dataset.delete;
        const p = state.players.find(item => textValue(item.id) === id);
        if (!p) return;
        if (btn.hasAttribute("data-edit")) editPlayers(state, p, api);
        else api.confirm({title: "선수를 삭제할까요?", message: teamNames[p.team] + " " + p.name + " 선수를 명단에서 삭제합니다.", button: "삭제하기",
          onConfirm: () => api.commit(s => CourtEngine.removePlayer(s, p.id))});
      }
    };
  }

  function localTime(value, options) {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? "—" : new Intl.DateTimeFormat("ko-KR", options).format(date);
  }

  function drawTeamWins(history) {
    const totals = { blue: 0, white: 0 };
    const byLevel = new Map(Object.keys(levelNames).map(level => [level, { blue: 0, white: 0 }]));
    let unscored = 0;
    let draws = 0;
    for (const { level, winner } of history) {
      if (winner === 'draw') { draws++; continue; }
      if (winner !== "blue" && winner !== "white") {
        unscored++;
        continue;
      }
      totals[winner]++;
      const group = byLevel.get(level);
      if (group) group[winner]++;
    }

    function row(label, wins) {
      return '<tr><th scope="row">' + label + '</th><td>' + wins.blue + '승</td><td>' + wins.white + '승</td></tr>';
    }
    const drawNote = draws ? '<p class="cp-wins-note">무승부 ' + draws + '경기</p>' : '';
    const note = unscored ? '<p class="cp-wins-note">승패 미기록 ' + unscored + '경기는 집계에서 제외했습니다.</p>' : '';
    return '<section class="cp-surface cp-wins" aria-labelledby="cp-wins-heading"><div class="cp-surface-head">' +
      '<h2 id="cp-wins-heading">팀별 승수</h2></div><table class="cp-table" aria-labelledby="cp-wins-heading">' +
      '<thead><tr><th scope="col">등급</th><th scope="col">' + teamPill("blue") + '</th><th scope="col">' + teamPill("white") + '</th></tr></thead>' +
      '<tbody>' + Array.from(byLevel, ([level, wins]) => row(levelLabel(level), wins)).join("") + '</tbody>' +
      '<tfoot>' + row("전체 합계", totals) + '</tfoot></table>' + drawNote + note + '</section>';
  }

  function drawHistoryMatches(state, api) {
    const matches = [...state.history]
      .filter(m => courtFilter === "" || m.courtIndex === Number(courtFilter))
      .sort((a, b) => b.endedAt - a.endedAt);
    if (!matches.length) {
      return emptyState(api.icon("list", 28), "완료된 경기가 없습니다",
        courtFilter === "" ? "코트에서 경기를 완료하면 대진과 종료 시간이 여기에 기록됩니다." : "이 코트에서 완료한 경기가 없습니다.");
    }
    return '<ul class="cp-matches">' + matches.map(m => {
      const names = m.names || m.playerIds.map(id => state.players.find(p => p.id === id)?.name || "선수");
      return '<li><div class="cp-match-meta"><span class="cp-court-no">코트 ' + (m.courtIndex + 1) + '</span>' + levelLabel(m.level) + '</div>' +
        '<div class="cp-match-pair"><span>' + teamPill("blue", m.winner) + '<b>' + api.escape(names.slice(0,2).join(" · ")) + '</b></span><small>VS</small><span>' +
        teamPill("white", m.winner) + '<b>' + api.escape(names.slice(2,4).join(" · ")) + '</b></span></div>' +
        '<div class="cp-match-time"><span>' + (m.winner === 'draw' ? '무승부 · ' : m.winner ? '' : '승패 미기록 · ') + localTime(m.endedAt, {month:"short", day:"numeric"}) + '</span><strong>' +
        localTime(m.startedAt, {hour:"2-digit", minute:"2-digit", hour12:false}) + ' – ' + localTime(m.endedAt, {hour:"2-digit", minute:"2-digit", hour12:false}) + '</strong></div></li>';
    }).join("") + '</ul>';
  }

  function drawCounts(state, api) {
    if (!state.players.length) return emptyState(api.icon("users", 28), "등록된 선수가 없습니다", "선수 명단에 선수를 추가하면 경기 횟수를 확인할 수 있습니다.");
    const max = Math.max(1, ...state.players.map(p => p.games));
    return '<table class="cp-table cp-count-table"><caption class="cp-vh">선수별 완료 경기 횟수</caption>' +
      '<thead><tr><th scope="col">선수 이름</th><th scope="col">소속 팀</th><th scope="col">등급</th><th scope="col">완료 경기</th></tr></thead><tbody>' +
      [...state.players].sort((a,b) => a.games - b.games || a.name.localeCompare(b.name, "ko")).map(p =>
        '<tr><th scope="row">' + api.escape(p.name) + '</th><td>' + teamPill(p.team) + '</td><td>' + levelLabel(p.level) + '</td>' +
        '<td><div class="cp-count-vis"><meter min="0" max="' + max + '" value="' + p.games + '" aria-hidden="true"></meter>' +
        '<span><b>' + p.games + '</b><span class="cp-unit">회</span></span></div></td></tr>'
      ).join("") + '</tbody></table>';
  }

  function renderHistory(current, container, api) {
    const past = current.pastSessions || [];
    const archived = sessionFilter === "" ? null : past[Number(sessionFilter)];
    if (!archived) sessionFilter = "";
    const state = archived ? { ...archived, courts: [] } : current;
    const sessions = past.map((day, index) => [String(index),
      (index + 1) + '회 · ' + localTime(day.startedAt, {year:"numeric", month:"numeric", day:"numeric"})]);
    const picker = past.length ? selector("경기 회차", "session", [["", "오늘 경기"], ...sessions.reverse()], sessionFilter) : "";
    const played = new Set([...state.history, ...state.courts.filter(Boolean)].flatMap(m => m.playerIds)).size;
    const active = state.courts.filter(Boolean).length;
    const stats = [
      ["check","완료 경기",state.history.length,"경기"],
      ["users","출전한 선수",played,"명"],
      ["activity","진행 중인 경기",active,"경기"]
    ];
    container.innerHTML = '<section class="cs-panel" aria-labelledby="cp-history-heading"><div class="cp-page-heading"><div><h1 id="cp-history-heading">경기 기록</h1>' +
      '<p>팀별 승수와 코트별 대진, 선수별 경기 횟수를 확인하세요.</p></div>' + picker + '</div><div class="cp-history-stats">' +
      stats.map(([icon,label,value,unit]) => '<div><span class="cp-stat-icon">' + api.icon(icon,20) +
        '</span><div><span>' + label + '</span><strong>' + value + '<small>' + unit + '</small></strong></div></div>').join("") +
      '</div>' + drawTeamWins(state.history) + '<div class="cp-surface"><div class="cp-surface-head cp-history-head"><div class="cp-tabs" role="group" aria-label="기록 보기">' +
      '<button type="button" data-history="matches" aria-pressed="' + (historyTab === "matches") + '">경기 목록</button>' +
      '<button type="button" data-history="counts" aria-pressed="' + (historyTab === "counts") + '">선수별 횟수</button></div>' +
      (historyTab === "matches" ? selector("코트 선택","court",[["","전체 코트"],["0","코트 1"],["1","코트 2"],["2","코트 3"]],courtFilter) : '') +
      '</div><div class="cp-rows">' + (historyTab === "matches" ? drawHistoryMatches(state, api) : drawCounts(state, api)) + '</div></div></section>';
    container.querySelectorAll("[data-history]").forEach(btn => btn.onclick = () => {
      historyTab = btn.dataset.history;
      renderHistory(current, container, api);
      container.querySelector('[data-history="' + historyTab + '"]').focus({preventScroll:true});
    });
    const session = container.querySelector("[data-filter=session]");
    if (session) session.onchange = () => {
      sessionFilter = session.value;
      courtFilter = "";
      renderHistory(current, container, api);
      container.querySelector("[data-filter=session]").focus({preventScroll:true});
    };
    const court = container.querySelector("[data-filter=court]");
    if (court) court.onchange = () => {
      courtFilter = court.value;
      renderHistory(current, container, api);
      container.querySelector("[data-filter=court]").focus({preventScroll:true});
    };
  }

  window.Panels = { renderRoster, renderHistory };
})();
