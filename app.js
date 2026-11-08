'use strict';

/* ---------- Données ---------- */

const KEY = 'jessy-sport-v1';

// Types d'exercices et champs saisis pour chaque série
const TYPES = {
  force:  { label: 'Musculation', fields: [['reps', 'Reps'], ['kg', 'Kg']] },
  duree:  { label: 'Durée',       fields: [['sec', 'Secondes']] },
  cardio: { label: 'Cardio',      fields: [['min', 'Minutes'], ['km', 'Km']] },
};

const uid = () => Math.random().toString(36).slice(2, 10);

function seed() {
  return {
    programs: [{
      id: uid(),
      name: 'Full body (exemple)',
      exercises: [
        { id: uid(), name: 'Squat', type: 'force', sets: 3 },
        { id: uid(), name: 'Développé couché', type: 'force', sets: 3 },
        { id: uid(), name: 'Tractions', type: 'force', sets: 3 },
        { id: uid(), name: 'Gainage', type: 'duree', sets: 2 },
        { id: uid(), name: 'Tapis de course', type: 'cardio', sets: 1 },
      ],
    }],
    sessions: [],
    active: null,
  };
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data && Array.isArray(data.programs) && Array.isArray(data.sessions)) return data;
  } catch (e) { /* stockage indisponible */ }
  return seed();
}

let S = load();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* stockage plein ou bloqué */ }
}

/* ---------- Utilitaires ---------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const fmtNum = (n) => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));

function fmtDuration(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Texte court pour une série terminée
function setLabel(type, s) {
  if (type === 'force') {
    const kg = num(s.kg);
    return kg ? `${fmtNum(num(s.reps))} × ${fmtNum(kg)} kg` : `${fmtNum(num(s.reps))} reps`;
  }
  if (type === 'duree') return `${fmtNum(num(s.sec))} s`;
  const parts = [];
  if (num(s.min) != null) parts.push(`${fmtNum(num(s.min))} min`);
  if (num(s.km) != null) parts.push(`${fmtNum(num(s.km))} km`);
  return parts.join(' · ');
}

// Dernière performance enregistrée pour un exercice (recherche par nom)
function lastPerf(name) {
  const key = name.trim().toLowerCase();
  for (const sess of S.sessions) {
    const ex = sess.exercises.find((e) => e.name.trim().toLowerCase() === key);
    if (ex && ex.sets.length) return { date: sess.start, type: ex.type, sets: ex.sets };
  }
  return null;
}

function volume(sess) {
  let v = 0;
  for (const ex of sess.exercises) {
    if (ex.type !== 'force') continue;
    for (const s of ex.sets) v += (num(s.reps) || 0) * (num(s.kg) || 0);
  }
  return v;
}

const countSets = (sess) => sess.exercises.reduce((n, e) => n + e.sets.length, 0);

/* ---------- Fenêtres de confirmation intégrées ---------- */

function dialog(msg, { ok = 'OK', cancel = null, danger = false } = {}) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true">
        <p>${esc(msg)}</p>
        <div class="row">
          ${cancel ? `<button data-m="0">${esc(cancel)}</button>` : ''}
          <button data-m="1" class="${danger ? 'danger-fill' : 'primary'}">${esc(ok)}</button>
        </div>
      </div>`;
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      e.stopPropagation();
      wrap.remove();
      resolve(b.dataset.m === '1');
    });
    document.body.appendChild(wrap);
    wrap.querySelector('[data-m="1"]').focus();
  });
}
const ask = (msg) => dialog(msg, { ok: 'Confirmer', cancel: 'Annuler', danger: true });
const notify = (msg) => dialog(msg);

/* ---------- Navigation ---------- */

const $app = document.getElementById('app');
const $tabs = document.getElementById('tabs');

let ui = { view: S.active ? 'session' : 'programs', draft: null, detailId: null };

function go(view, extra = {}) {
  ui = { ...ui, ...extra, view };
  render();
  window.scrollTo(0, 0);
}

function render() {
  const views = { programs: viewPrograms, edit: viewEdit, session: viewSession, history: viewHistory, detail: viewDetail };
  if (ui.view === 'session' && !S.active) ui.view = 'programs';
  $app.innerHTML = (views[ui.view] || viewPrograms)();
  renderTabs();
  tick();
}

function renderTabs() {
  const tab = (id, ico, label, cls = '') => {
    const on = ui.view === id || (id === 'programs' && ui.view === 'edit') || (id === 'history' && ui.view === 'detail');
    return `<button data-act="tab" data-v="${id}" class="${on ? 'on' : ''} ${cls}"><span class="ico">${ico}</span>${label}</button>`;
  };
  $tabs.innerHTML =
    tab('programs', '☰', 'Programmes') +
    (S.active ? tab('session', '●', 'Séance', 'live') : '') +
    tab('history', '↺', 'Historique');
}

/* ---------- Vue : programmes ---------- */

function viewPrograms() {
  const list = S.programs.map((p) => `
    <div class="card">
      <div class="row">
        <div>
          <h3>${esc(p.name)}</h3>
          <div class="muted">${p.exercises.length} exercice${p.exercises.length > 1 ? 's' : ''} · ${esc(p.exercises.map((e) => e.name).join(', '))}</div>
        </div>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="primary" style="flex:1" data-act="start" data-id="${p.id}">Démarrer</button>
        <button data-act="edit" data-id="${p.id}">Modifier</button>
      </div>
    </div>`).join('');

  return `
    <h1>Programmes</h1>
    ${S.active ? `<div class="card tap" data-act="tab" data-v="session"><b>Séance en cours :</b> ${esc(S.active.programName)} <span class="timer" data-timer></span></div>` : ''}
    ${list || '<div class="empty">Aucun programme. Crée ton premier programme.</div>'}
    <button class="block" data-act="new">+ Nouveau programme</button>
    <button class="block" data-act="quick">Séance libre (sans programme)</button>`;
}

/* ---------- Vue : édition d'un programme ---------- */

function viewEdit() {
  const d = ui.draft;
  const isNew = !S.programs.some((p) => p.id === d.id);
  const exs = d.exercises.map((e, i) => `
    <div class="card ex-edit">
      <label>Exercice ${i + 1}</label>
      <input data-x="${i}" data-f="name" value="${esc(e.name)}" placeholder="Nom (ex : Squat)">
      <div class="grid">
        <select data-x="${i}" data-f="type">
          ${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${e.type === k ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
        <input data-x="${i}" data-f="sets" type="number" inputmode="numeric" min="1" max="20" value="${e.sets}" aria-label="Séries">
      </div>
      <div class="actions">
        <span class="muted" style="align-self:center">séries</span>
        <span class="spacer"></span>
        <button class="icon small" data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon small" data-act="down" data-i="${i}" ${i === d.exercises.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="icon small danger" data-act="rmex" data-i="${i}">Suppr.</button>
      </div>
    </div>`).join('');

  return `
    <div class="row"><button class="link" data-act="tab" data-v="programs">‹ Retour</button></div>
    <h1>${isNew ? 'Nouveau programme' : 'Modifier'}</h1>
    <label>Nom du programme</label>
    <input data-d="name" value="${esc(d.name)}" placeholder="Ex : Push, Jambes, Cardio…">
    <h2>Exercices</h2>
    ${exs || '<div class="muted">Aucun exercice pour l\'instant.</div>'}
    <button class="block" data-act="addex">+ Ajouter un exercice</button>
    <button class="block primary" data-act="saveprog">Enregistrer</button>
    ${isNew ? '' : '<button class="block danger" data-act="delprog">Supprimer ce programme</button>'}`;
}

/* ---------- Vue : séance en cours ---------- */

function viewSession() {
  const a = S.active;
  const exs = a.exercises.map((ex, ei) => {
    const t = TYPES[ex.type];
    const one = t.fields.length === 1;
    const last = lastPerf(ex.name);
    const head = `<div class="set set-head ${one ? 'one' : ''}"><span>#</span>${t.fields.map(([, l]) => `<span>${l}</span>`).join('')}<span></span></div>`;
    const rows = ex.sets.map((s, si) => `
      <div class="set ${one ? 'one' : ''} ${s.done ? 'done' : ''}">
        <span class="n">${si + 1}</span>
        ${t.fields.map(([f]) => `<input data-e="${ei}" data-s="${si}" data-f="${f}" value="${esc(s[f])}" inputmode="decimal" autocomplete="off">`).join('')}
        <button class="check ${s.done ? 'done' : ''}" data-act="toggle" data-e="${ei}" data-s="${si}" aria-label="Série faite">✓</button>
      </div>`).join('');
    return `
      <div class="card">
        <div class="row">
          <h3>${esc(ex.name)}</h3>
          <span class="spacer"></span>
          <button class="icon small danger" data-act="rmsessex" data-e="${ei}" aria-label="Retirer l'exercice">✕</button>
        </div>
        <div class="last">${t.label}${last ? ` · Dernière fois (${fmtDate(last.date)}) : ${esc(last.sets.map((s) => setLabel(last.type, s)).join(', '))}` : ''}</div>
        ${head}${rows}
        <div class="set-btns">
          <button class="small" data-act="addset" data-e="${ei}">+ Série</button>
          <button class="small" data-act="delset" data-e="${ei}" ${ex.sets.length ? '' : 'disabled'}>− Série</button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="session-head">
      <div class="row">
        <div>
          <div class="muted">Séance en cours</div>
          <h3>${esc(a.programName)}</h3>
        </div>
        <span class="spacer"></span>
        <span class="timer" data-timer style="font-size:22px"></span>
      </div>
    </div>
    ${exs || '<div class="empty">Ajoute un exercice pour commencer.</div>'}
    <div class="card">
      <label>Ajouter un exercice à cette séance</label>
      <div class="row">
        <input id="newExName" placeholder="Nom" style="flex:2">
        <select id="newExType" style="flex:1">
          ${Object.entries(TYPES).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('')}
        </select>
      </div>
      <button class="block small" data-act="addsessex">+ Ajouter</button>
    </div>
    <button class="block primary" data-act="finish">Terminer la séance</button>
    <button class="block danger" data-act="abandon">Abandonner</button>`;
}

// Prépare une série en reprenant les valeurs de la dernière séance
function prefill(name, type, i) {
  const last = lastPerf(name);
  const src = last && last.type === type ? (last.sets[i] || last.sets[last.sets.length - 1]) : null;
  const s = { done: false };
  for (const [f] of TYPES[type].fields) s[f] = src && src[f] != null ? fmtNum(num(src[f])) : '';
  return s;
}

function startSession(program) {
  S.active = {
    id: uid(),
    programId: program ? program.id : null,
    programName: program ? program.name : 'Séance libre',
    start: Date.now(),
    exercises: (program ? program.exercises : []).map((e) => ({
      name: e.name,
      type: e.type,
      sets: Array.from({ length: Math.max(1, e.sets | 0) }, (_, i) => prefill(e.name, e.type, i)),
    })),
  };
  save();
  go('session');
}

async function finishSession() {
  const a = S.active;
  const exercises = a.exercises
    .map((ex) => ({
      name: ex.name,
      type: ex.type,
      sets: ex.sets.filter((s) => s.done).map((s) => {
        const o = {};
        for (const [f] of TYPES[ex.type].fields) o[f] = num(s[f]);
        return o;
      }),
    }))
    .filter((ex) => ex.sets.length);

  if (!exercises.length) {
    if (!(await ask('Aucune série cochée. Abandonner la séance sans l\'enregistrer ?'))) return;
    S.active = null;
    save();
    return go('programs');
  }
  const undone = a.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
  if (undone && !(await ask(`${undone} série${undone > 1 ? 's' : ''} non cochée${undone > 1 ? 's' : ''} ne ser${undone > 1 ? 'ont' : 'a'} pas enregistrée${undone > 1 ? 's' : ''}. Terminer quand même ?`))) return;

  const sess = { id: a.id, programId: a.programId, programName: a.programName, start: a.start, end: Date.now(), exercises };
  S.sessions.unshift(sess);
  S.active = null;
  save();
  go('detail', { detailId: sess.id });
}

/* ---------- Vue : historique ---------- */

function viewHistory() {
  const list = S.sessions.map((s) => {
    const vol = volume(s);
    return `
      <div class="card tap" data-act="detail" data-id="${s.id}">
        <div class="row"><h3>${esc(s.programName)}</h3><span class="spacer"></span><span class="muted">${fmtDate(s.start)}</span></div>
        <div class="stats">
          <span><b>${fmtDuration(s.end - s.start)}</b> durée</span>
          <span><b>${countSets(s)}</b> séries</span>
          ${vol ? `<span><b>${fmtNum(Math.round(vol))}</b> kg soulevés</span>` : ''}
        </div>
      </div>`;
  }).join('');

  return `
    <h1>Historique</h1>
    ${list || '<div class="empty">Aucune séance enregistrée.</div>'}
    <h2>Sauvegarde</h2>
    <div class="muted">Les données sont stockées sur ce téléphone uniquement. Exporte-les régulièrement pour ne rien perdre.</div>
    <button class="block" data-act="export">Exporter mes données</button>
    <button class="block" data-act="import">Importer une sauvegarde</button>
    <input type="file" id="importFile" accept="application/json,.json" hidden>`;
}

function viewDetail() {
  const s = S.sessions.find((x) => x.id === ui.detailId);
  if (!s) { ui.view = 'history'; return viewHistory(); }
  const vol = volume(s);
  const exs = s.exercises.map((ex) => `
    <div class="card">
      <h3>${esc(ex.name)}</h3>
      <div class="muted">${TYPES[ex.type].label}</div>
      ${ex.sets.map((st, i) => `<div class="row" style="margin-top:6px"><span class="muted" style="width:24px">${i + 1}</span>${esc(setLabel(ex.type, st))}</div>`).join('')}
    </div>`).join('');

  return `
    <div class="row"><button class="link" data-act="tab" data-v="history">‹ Historique</button></div>
    <h1>${esc(s.programName)}</h1>
    <div class="muted">${new Date(s.start).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}</div>
    <div class="stats" style="margin-bottom:16px">
      <span><b>${fmtDuration(s.end - s.start)}</b> durée</span>
      <span><b>${countSets(s)}</b> séries</span>
      ${vol ? `<span><b>${fmtNum(Math.round(vol))}</b> kg soulevés</span>` : ''}
    </div>
    ${exs}
    <button class="block danger" data-act="delsess" data-id="${s.id}">Supprimer cette séance</button>`;
}

/* ---------- Sauvegarde / restauration ---------- */

async function exportData() {
  const json = JSON.stringify({ app: 'jessy-sport', version: 1, exportedAt: new Date().toISOString(), ...S }, null, 2);
  const name = `jessy-sport-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Sauvegarde Jessy Sport' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const d = JSON.parse(reader.result);
      if (!Array.isArray(d.programs) || !Array.isArray(d.sessions)) throw new Error('format');
      if (!(await ask(`Remplacer les données actuelles par cette sauvegarde (${d.programs.length} programmes, ${d.sessions.length} séances) ?`))) return;
      S = { programs: d.programs, sessions: d.sessions, active: d.active || null };
      save();
      go('history');
    } catch (e) {
      notify('Fichier invalide. Choisis un fichier exporté depuis Jessy Sport.');
    }
  };
  reader.readAsText(file);
}

/* ---------- Événements ---------- */

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  const i = +el.dataset.i;
  const e = +el.dataset.e;
  const s = +el.dataset.s;
  const d = ui.draft;

  switch (act) {
    case 'tab': return go(el.dataset.v);

    case 'new':
      return go('edit', { draft: { id: uid(), name: '', exercises: [{ id: uid(), name: '', type: 'force', sets: 3 }] } });
    case 'edit':
      return go('edit', { draft: structuredClone(S.programs.find((p) => p.id === id)) });
    case 'addex':
      d.exercises.push({ id: uid(), name: '', type: 'force', sets: 3 });
      render();
      $app.querySelector(`[data-x="${d.exercises.length - 1}"][data-f="name"]`)?.focus();
      return;
    case 'rmex': d.exercises.splice(i, 1); return render();
    case 'up': [d.exercises[i - 1], d.exercises[i]] = [d.exercises[i], d.exercises[i - 1]]; return render();
    case 'down': [d.exercises[i + 1], d.exercises[i]] = [d.exercises[i], d.exercises[i + 1]]; return render();
    case 'saveprog': {
      d.name = d.name.trim();
      d.exercises = d.exercises
        .map((x) => ({ ...x, name: x.name.trim(), sets: Math.min(20, Math.max(1, parseInt(x.sets, 10) || 1)) }))
        .filter((x) => x.name);
      if (!d.name) return notify('Donne un nom au programme.');
      if (!d.exercises.length) return notify('Ajoute au moins un exercice avec un nom.');
      const idx = S.programs.findIndex((p) => p.id === d.id);
      if (idx >= 0) S.programs[idx] = d; else S.programs.push(d);
      save();
      return go('programs');
    }
    case 'delprog':
      if (!(await ask(`Supprimer le programme « ${d.name} » ? L'historique des séances est conservé.`))) return;
      S.programs = S.programs.filter((p) => p.id !== d.id);
      save();
      return go('programs');

    case 'start':
    case 'quick': {
      if (S.active && !(await ask('Une séance est déjà en cours. La remplacer ? (elle ne sera pas enregistrée)'))) return;
      return startSession(act === 'start' ? S.programs.find((p) => p.id === id) : null);
    }
    case 'toggle': {
      const ex = S.active.exercises[e];
      const cur = ex.sets[s];
      cur.done = !cur.done;
      if (cur.done) {
        // Recopie les valeurs dans les séries suivantes encore vides
        const fields = TYPES[ex.type].fields.map(([f]) => f);
        for (const next of ex.sets.slice(s + 1)) {
          if (!next.done && fields.every((f) => !String(next[f] ?? '').trim())) {
            for (const f of fields) next[f] = cur[f];
          }
        }
        if (navigator.vibrate) navigator.vibrate(30);
      }
      save();
      return render();
    }
    case 'addset': {
      const ex = S.active.exercises[e];
      const prev = ex.sets[ex.sets.length - 1];
      const ns = prev ? { ...prev, done: false } : prefill(ex.name, ex.type, 0);
      ex.sets.push(ns);
      save();
      return render();
    }
    case 'delset': S.active.exercises[e].sets.pop(); save(); return render();
    case 'rmsessex':
      if (!(await ask(`Retirer « ${S.active.exercises[e].name} » de cette séance ?`))) return;
      S.active.exercises.splice(e, 1); save(); return render();
    case 'addsessex': {
      const name = document.getElementById('newExName').value.trim();
      const type = document.getElementById('newExType').value;
      if (!name) return notify('Indique le nom de l\'exercice.');
      S.active.exercises.push({ name, type, sets: [prefill(name, type, 0)] });
      save();
      return render();
    }
    case 'finish': return finishSession();
    case 'abandon':
      if (!(await ask('Abandonner la séance ? Rien ne sera enregistré.'))) return;
      S.active = null; save(); return go('programs');

    case 'detail': return go('detail', { detailId: id });
    case 'delsess':
      if (!(await ask('Supprimer définitivement cette séance ?'))) return;
      S.sessions = S.sessions.filter((x) => x.id !== id); save(); return go('history');
    case 'export': return exportData();
    case 'import': return document.getElementById('importFile').click();
  }
});

// Saisie : mise à jour des données sans redessiner (garde le clavier ouvert)
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.dataset.d && ui.draft) ui.draft[t.dataset.d] = t.value;
  else if (t.dataset.x != null && ui.draft) ui.draft.exercises[+t.dataset.x][t.dataset.f] = t.value;
  else if (t.dataset.e != null && S.active) {
    S.active.exercises[+t.dataset.e].sets[+t.dataset.s][t.dataset.f] = t.value;
    save();
  }
});

document.addEventListener('change', (ev) => {
  if (ev.target.id === 'importFile' && ev.target.files[0]) importData(ev.target.files[0]);
});

/* ---------- Chrono ---------- */

function tick() {
  if (!S.active) return;
  const txt = fmtDuration(Date.now() - S.active.start);
  document.querySelectorAll('[data-timer]').forEach((el) => { el.textContent = txt; });
}
setInterval(tick, 1000);

/* ---------- Démarrage ---------- */

render();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
