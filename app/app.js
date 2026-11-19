// Leonida Legend tracker: loads app/data/trophies.json, renders the checklist,
// roadmap and missables, saves earned ticks in localStorage, and exports/imports
// progress as JSON. Fully offline: the only fetch is the local data file.
const STORE_KEY = 'gta6-trophy-guide-progress-v1';
const SPOILER_KEY = 'gta6-trophy-guide-spoilers-v1';

const listEl = document.getElementById('list');
const detailEl = document.getElementById('detail');
const searchEl = document.getElementById('search');
const gradeEl = document.getElementById('grade');
const spoilerEl = document.getElementById('spoilers');
const statusEl = document.getElementById('status');
const resultCountEl = document.getElementById('resultCount');

let trophies = [];
let roadmap = [];
let earned = new Set(loadStored(STORE_KEY, []));
let kindFilter = 'all';
let selectedId = null;

function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function saveEarned() {
  localStorage.setItem(STORE_KEY, JSON.stringify([...earned].sort((a, b) => a - b)));
}

function saveSpoilers() {
  localStorage.setItem(SPOILER_KEY, JSON.stringify(spoilerEl.checked));
}

function isHidden(trophy) {
  return trophy.hidden === true;
}

function isSpoilered(trophy) {
  return spoilerEl.checked && isHidden(trophy) && !earned.has(trophy.id);
}

function displayName(trophy) {
  return isSpoilered(trophy) ? 'Hidden story trophy' : trophy.name;
}

function displayDescription(trophy) {
  return isSpoilered(trophy) ? 'Hidden story trophy — earn it to reveal.' : trophy.description;
}

function gradeLabel(trophy) {
  return trophy.grade.charAt(0).toUpperCase() + trophy.grade.slice(1);
}

function targetText(trophy) {
  if (trophy.target == null) return '';
  const unit = trophy.target >= 1000 ? '$' + trophy.target.toLocaleString('en-US') : String(trophy.target);
  return 'Target: ' + unit;
}

function matchesFilters(trophy) {
  if (gradeEl.value !== 'all' && trophy.grade !== gradeEl.value) return false;
  if (kindFilter === 'story' && trophy.kind !== 'story') return false;
  if (kindFilter === 'collectibles' && trophy.kind !== 'collectibles') return false;
  if (kindFilter === 'activities' && trophy.kind !== 'activities') return false;
  if (kindFilter === 'missable' && trophy.missable !== true) return false;
  const query = searchEl.value.trim().toLowerCase();
  if (!query) return true;
  const haystack = [trophy.name, trophy.description, trophy.guide, trophy.kind, trophy.grade]
    .join(' ').toLowerCase();
  return haystack.includes(query);
}

function renderProgress() {
  const total = trophies.length;
  const done = earned.size;
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('earnedCount').textContent = String(done);
  document.getElementById('barFill').style.width = pct + '%';
  document.getElementById('progressText').textContent =
    done + ' of ' + total + ' earned — ' + pct + '% to the platinum';
  const byGrade = {};
  for (const t of trophies) {
    byGrade[t.grade] = byGrade[t.grade] || [0, 0];
    byGrade[t.grade][1] += 1;
    if (earned.has(t.id)) byGrade[t.grade][0] += 1;
  }
  document.getElementById('gradeCounts').textContent = ['platinum', 'gold', 'silver', 'bronze']
    .map((g) => gradeLabel({ grade: g }) + ' ' + (byGrade[g] ? byGrade[g][0] + '/' + byGrade[g][1] : '0/0'))
    .join(' · ');
}

function trophyRow(trophy) {
  const li = document.createElement('li');
  li.className = 'row' + (earned.has(trophy.id) ? ' earned' : '') + (selectedId === trophy.id ? ' selected' : '');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = earned.has(trophy.id);
  box.setAttribute('aria-label', 'Earned: ' + displayName(trophy));
  box.addEventListener('change', (event) => {
    event.stopPropagation();
    if (box.checked) earned.add(trophy.id);
    else earned.delete(trophy.id);
    saveEarned();
    renderAll();
  });
  const body = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = displayName(trophy);
  const desc = document.createElement('div');
  desc.className = 'desc';
  desc.textContent = displayDescription(trophy);
  const meta = document.createElement('div');
  meta.className = 'meta';
  const grade = document.createElement('span');
  grade.className = 'pill grade-' + trophy.grade;
  grade.textContent = gradeLabel(trophy);
  meta.append(grade);
  const kind = document.createElement('span');
  kind.className = 'pill';
  kind.textContent = trophy.kind;
  meta.append(kind);
  if (trophy.missable) {
    const miss = document.createElement('span');
    miss.className = 'pill miss';
    miss.textContent = 'Missable · stage ' + trophy.stage;
    meta.append(miss);
  }
  const target = targetText(trophy);
  if (target) {
    const targetEl = document.createElement('span');
    targetEl.className = 'pill';
    targetEl.textContent = target;
    meta.append(targetEl);
  }
  if (isSpoilered(trophy)) {
    const sp = document.createElement('span');
    sp.className = 'pill spoilered';
    sp.textContent = 'Spoiler hidden';
    meta.append(sp);
  }
  body.append(name, desc, meta);
  li.append(box, body);
  li.addEventListener('click', () => {
    selectedId = trophy.id;
    renderList();
    renderDetail();
  });
  return li;
}

function renderList() {
  listEl.replaceChildren();
  const shown = trophies.filter(matchesFilters);
  for (const trophy of shown) listEl.append(trophyRow(trophy));
  resultCountEl.textContent = shown.length === trophies.length
    ? 'Showing all ' + trophies.length + ' trophies.'
    : 'Showing ' + shown.length + ' of ' + trophies.length + ' trophies.';
}

function renderDetail() {
  const trophy = trophies.find((t) => t.id === selectedId);
  if (!trophy) {
    detailEl.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Select a trophy on the left to read its official description, its guide and its sources here.';
    detailEl.append(p);
    return;
  }
  detailEl.innerHTML = '';
  const title = document.createElement('h2');
  title.textContent = displayName(trophy);
  const gradeLine = document.createElement('p');
  gradeLine.className = 'grade-line';
  gradeLine.textContent = gradeLabel(trophy) + ' · ' + trophy.kind +
    (trophy.missable ? ' · Missable, roadmap stage ' + trophy.stage : ' · Roadmap stage ' + trophy.stage) +
    (targetText(trophy) ? ' · ' + targetText(trophy) : '');
  detailEl.append(title, gradeLine);
  if (isSpoilered(trophy)) {
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = 'This is a hidden story trophy. Tick it as earned to reveal its name, description and guide, or turn off “Hide story spoilers”.';
    detailEl.append(note);
    return;
  }
  const descHeading = document.createElement('h3');
  descHeading.textContent = 'Official description';
  const quote = document.createElement('blockquote');
  quote.textContent = trophy.description;
  const guideHeading = document.createElement('h3');
  guideHeading.textContent = 'Guide';
  const guide = document.createElement('p');
  guide.textContent = trophy.guide;
  const sourcesHeading = document.createElement('h3');
  sourcesHeading.textContent = 'Sources';
  const sources = document.createElement('ul');
  sources.className = 'sources';
  for (const source of trophy.sources || []) {
    const item = document.createElement('li');
    item.textContent = source;
    sources.append(item);
  }
  detailEl.append(descHeading, quote, guideHeading, guide, sourcesHeading, sources);
}

function renderRoadmap() {
  const list = document.getElementById('roadmapList');
  list.replaceChildren();
  for (const stage of roadmap) {
    const item = document.createElement('li');
    const heading = document.createElement('h3');
    const num = document.createElement('span');
    num.className = 'n';
    num.textContent = 'Stage ' + stage.stage + ' — ';
    heading.append(num, document.createTextNode(stage.title));
    const text = document.createElement('p');
    text.textContent = stage.text;
    const members = trophies.filter((t) => t.stage === stage.stage);
    const done = members.filter((t) => earned.has(t.id)).length;
    const names = document.createElement('p');
    names.className = 'trophies';
    names.textContent = done + '/' + members.length + ' earned in this stage: ' +
      members.map((t) => displayName(t)).join(' · ');
    item.append(heading, text, names);
    list.append(item);
  }
}

function renderMissables() {
  const list = document.getElementById('missableList');
  list.replaceChildren();
  const missables = trophies.filter((t) => t.missable).sort((a, b) => a.stage - b.stage || a.id - b.id);
  for (const trophy of missables) list.append(trophyRow(trophy));
}

function renderAll() {
  renderProgress();
  renderList();
  renderDetail();
  renderRoadmap();
  renderMissables();
}

function switchView(view) {
  for (const button of document.querySelectorAll('.tab')) {
    button.classList.toggle('active', button.dataset.view === view);
  }
  document.getElementById('view-checklist').classList.toggle('hidden', view !== 'checklist');
  document.getElementById('view-roadmap').classList.toggle('hidden', view !== 'roadmap');
  document.getElementById('view-missables').classList.toggle('hidden', view !== 'missables');
}

function showStatus(message) {
  statusEl.textContent = message;
  window.setTimeout(() => { statusEl.textContent = ''; }, 4000);
}

async function init() {
  const storedSpoilers = loadStored(SPOILER_KEY, true);
  spoilerEl.checked = storedSpoilers !== false;
  const response = await fetch('data/trophies.json');
  const data = await response.json();
  trophies = data.trophies || [];
  roadmap = data.roadmap || [];
  if (trophies.length > 0) selectedId = trophies[0].id;

  for (const button of document.querySelectorAll('.tab')) {
    button.addEventListener('click', () => switchView(button.dataset.view));
  }
  for (const chip of document.querySelectorAll('.chip')) {
    chip.addEventListener('click', () => {
      kindFilter = chip.dataset.kind;
      for (const other of document.querySelectorAll('.chip')) {
        other.classList.toggle('active', other === chip);
      }
      renderList();
    });
  }
  searchEl.addEventListener('input', renderList);
  gradeEl.addEventListener('change', renderList);
  // Keyboard shortcut: press / anywhere to jump to search, Escape to clear it.
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== searchEl) {
      event.preventDefault();
      searchEl.focus();
    } else if (event.key === 'Escape' && document.activeElement === searchEl) {
      searchEl.value = '';
      renderList();
      searchEl.blur();
    }
  });
  spoilerEl.addEventListener('change', () => {
    saveSpoilers();
    renderAll();
  });
  document.getElementById('export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ earned: [...earned].sort((a, b) => a - b) }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'gta6-trophy-progress.json';
    link.click();
    URL.revokeObjectURL(link.href);
    showStatus('Progress exported.');
  });
  document.getElementById('import').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const ids = Array.isArray(parsed) ? parsed : parsed.earned;
      if (!Array.isArray(ids)) throw new Error('no earned list');
      const valid = new Set(trophies.map((t) => t.id));
      earned = new Set(ids.filter((id) => valid.has(Number(id))).map((id) => Number(id)));
      saveEarned();
      renderAll();
      showStatus('Progress imported: ' + earned.size + ' trophies earned.');
    } catch {
      showStatus('That file could not be imported.');
    }
    event.target.value = '';
  });
  document.getElementById('reset').addEventListener('click', () => {
    if (!window.confirm('Clear all earned ticks?')) return;
    earned = new Set();
    saveEarned();
    renderAll();
    showStatus('Progress cleared.');
  });
  renderAll();
}

init();
