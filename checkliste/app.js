/* ===== IndexedDB ===== */
var DB_NAME = 'bassa-checkliste';
var DB_VERSION = 1;
var db = null;
var currentProjectId = null;

var FIELDS = ['projekt','kunde','adresse','ansprechperson','telefon','beginn',
  'geruest','pv','spenglereiFarbe','spenglereiMaterial','eindeckung','zubehoer','notiz'];

function openDB() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function(e) {
      var d = e.target.result;
      if (!d.objectStoreNames.contains('projects')) {
        d.createObjectStore('projects', { keyPath: 'id' });
      }
    };
    req.onsuccess = function(e) { db = e.target.result; resolve(db); };
    req.onerror = function(e) { reject(e); };
  });
}

function dbPut(data) {
  return new Promise(function(resolve, reject) {
    if (!db) { resolve(); return; }
    var tx = db.transaction('projects', 'readwrite');
    tx.objectStore('projects').put(data);
    tx.oncomplete = function() { resolve(); };
    tx.onerror = function(e) { reject(e); };
  });
}

function dbGetAll() {
  return new Promise(function(resolve, reject) {
    if (!db) { resolve([]); return; }
    var tx = db.transaction('projects', 'readonly');
    var req = tx.objectStore('projects').getAll();
    req.onsuccess = function() { resolve(req.result || []); };
    req.onerror = function(e) { reject(e); };
  });
}

function dbGet(id) {
  return new Promise(function(resolve, reject) {
    if (!db) { resolve(null); return; }
    var tx = db.transaction('projects', 'readonly');
    var req = tx.objectStore('projects').get(id);
    req.onsuccess = function() { resolve(req.result || null); };
    req.onerror = function(e) { reject(e); };
  });
}

function dbDelete(id) {
  return new Promise(function(resolve, reject) {
    if (!db) { resolve(); return; }
    var tx = db.transaction('projects', 'readwrite');
    tx.objectStore('projects').delete(id);
    tx.oncomplete = function() { resolve(); };
    tx.onerror = function(e) { reject(e); };
  });
}

/* ===== Toast ===== */
var toastTimer = null;
function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { t.classList.remove('show'); }, 2200);
}

/* ===== View switching ===== */
function showDashboard() {
  currentProjectId = null;
  document.getElementById('viewDashboard').style.display = '';
  document.getElementById('viewDetail').style.display = 'none';
  loadDashboard();
}

function showDetail(id) {
  currentProjectId = id;
  document.getElementById('viewDashboard').style.display = 'none';
  document.getElementById('viewDetail').style.display = '';
  loadProject(id);
}

/* ===== Dashboard ===== */
async function loadDashboard() {
  var projects = await dbGetAll();
  projects.sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });

  var total = projects.length;
  var open = 0, wip = 0, done = 0;
  projects.forEach(function(p) {
    var pct = calcProgress(p.checklist);
    if (pct === 100) done++;
    else if (pct >= 50) wip++;
    else open++;
  });

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statOpen').textContent = open;
  document.getElementById('statWip').textContent = wip;
  document.getElementById('statDone').textContent = done;

  var list = document.getElementById('projectList');
  var empty = document.getElementById('emptyState');

  if (total === 0) {
    list.style.display = 'none';
    empty.style.display = '';
    return;
  }

  list.style.display = '';
  empty.style.display = 'none';
  list.innerHTML = '';

  projects.forEach(function(p) {
    var pct = calcProgress(p.checklist);
    var statusClass, statusText;
    if (pct === 100) { statusClass = 'pill-done'; statusText = 'BEREIT'; }
    else if (pct >= 50) { statusClass = 'pill-wip'; statusText = 'IN ARBEIT'; }
    else { statusClass = 'pill-open'; statusText = 'OFFEN'; }

    var card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML =
      '<div class="project-card-info">' +
        '<h3>' + esc(p.projekt || 'Neue Baustelle') + '</h3>' +
        '<div class="pc-sub">' + esc(p.kunde || '-') + ' &middot; ' + esc(p.adresse || '-') + '</div>' +
      '</div>' +
      '<div class="project-card-progress">' +
        '<div class="pc-bar"><div class="pc-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="pc-pct">' + pct + ' %</div>' +
      '</div>' +
      '<span class="pill ' + statusClass + '">' + statusText + '</span>';
    card.addEventListener('click', function() { showDetail(p.id); });
    list.appendChild(card);
  });
}

function calcProgress(checklist) {
  if (!checklist || !checklist.length) return 0;
  var done = checklist.filter(function(c) { return c.checked; }).length;
  return Math.round((done / checklist.length) * 100);
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, function(m) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
}

/* ===== Detail: Load / Save ===== */
async function loadProject(id) {
  var p = await dbGet(id);
  if (!p) { showDashboard(); return; }

  FIELDS.forEach(function(f) {
    var el = document.getElementById(f);
    if (el) el.value = p[f] || '';
  });

  if (Array.isArray(p.checklist)) {
    var boxes = document.querySelectorAll('#checklist input[type="checkbox"]');
    boxes.forEach(function(box) {
      var found = p.checklist.find(function(x) { return x.label === box.dataset.label; });
      box.checked = !!(found && found.checked);
    });
  } else {
    document.querySelectorAll('#checklist input[type="checkbox"]').forEach(function(b) { b.checked = false; });
  }

  updateDetailUI();
  document.getElementById('detailTitle').textContent = p.projekt || 'Neue Baustelle';
}

function collectProjectData() {
  var data = { id: currentProjectId, updatedAt: Date.now() };
  FIELDS.forEach(function(f) {
    data[f] = document.getElementById(f).value;
  });
  data.checklist = Array.from(document.querySelectorAll('#checklist input[type="checkbox"]')).map(function(cb) {
    return { label: cb.dataset.label, checked: cb.checked };
  });
  return data;
}

var saveTimer = null;
function autoSave() {
  if (!currentProjectId) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(function() {
    var data = collectProjectData();
    dbPut(data);
    document.getElementById('detailTitle').textContent = data.projekt || 'Neue Baustelle';
  }, 400);
}

function updateDetailUI() {
  updateProgress();
  generateSummary();
}

function updateProgress() {
  var boxes = document.querySelectorAll('#checklist input[type="checkbox"]');
  var total = boxes.length;
  var done = Array.from(boxes).filter(function(b) { return b.checked; }).length;
  var pct = total ? Math.round((done / total) * 100) : 0;

  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressText').textContent = pct + ' % erledigt';

  var pill = document.getElementById('statusPill');
  if (pct === 100) {
    pill.textContent = 'BESTELLBEREIT'; pill.className = 'pill pill-done';
  } else if (pct >= 50) {
    pill.textContent = 'IN ARBEIT'; pill.className = 'pill pill-wip';
  } else {
    pill.textContent = 'OFFEN'; pill.className = 'pill pill-open';
  }
}

function valueOrDash(v) { return v && String(v).trim() ? String(v).trim() : '-'; }

function generateSummary() {
  var d = collectProjectData();
  var offene = d.checklist.filter(function(x) { return !x.checked; }).map(function(x) { return '  * ' + x.label; });
  var txt =
    'BAUSTELLEN-CHECKLISTE\n\n' +
    'Baustelle: ' + valueOrDash(d.projekt) + '\n' +
    'Kunde / Bauherr: ' + valueOrDash(d.kunde) + '\n' +
    'Adresse: ' + valueOrDash(d.adresse) + '\n\n' +
    'Ansprechperson: ' + valueOrDash(d.ansprechperson) + '\n' +
    'Telefon: ' + valueOrDash(d.telefon) + '\n' +
    'Beginn Dachdecker: ' + valueOrDash(d.beginn) + '\n' +
    'Gerüst: ' + valueOrDash(d.geruest) + '\n' +
    'PV-Anlage: ' + valueOrDash(d.pv) + '\n\n' +
    'Farbe Spenglerei: ' + valueOrDash(d.spenglereiFarbe) + '\n' +
    'Material Spenglerei: ' + valueOrDash(d.spenglereiMaterial) + '\n' +
    'Eindeckung / Dachaufbau: ' + valueOrDash(d.eindeckung) + '\n' +
    'Zubehör / Zusatzteile: ' + valueOrDash(d.zubehoer) + '\n' +
    'Interne Notizen: ' + valueOrDash(d.notiz) + '\n\n' +
    'OFFENE PUNKTE:\n' +
    (offene.length ? offene.join('\n') : '  * Keine offenen Punkte – Material bestellbereit.');
  document.getElementById('summaryBox').textContent = txt;
  return txt;
}

/* ===== Actions ===== */
function createNewProject() {
  var id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  var data = { id: id, updatedAt: Date.now() };
  FIELDS.forEach(function(f) { data[f] = ''; });
  data.checklist = [
    {label:'Auftrag vorhanden',checked:false},{label:'Pläne vorhanden',checked:false},
    {label:'Farbe geklärt',checked:false},{label:'Material geklärt',checked:false},
    {label:'Eindeckung geklärt',checked:false},{label:'Zubehör geklärt',checked:false},
    {label:'PV abgeklärt',checked:false},{label:'Beginn geklärt',checked:false},
    {label:'Gerüst geklärt',checked:false},{label:'Ansprechperson geklärt',checked:false},
    {label:'Material bestellbereit',checked:false}
  ];
  dbPut(data).then(function() { showDetail(id); });
}

function deleteProject() {
  if (!currentProjectId) return;
  if (!confirm('Diese Baustelle wirklich löschen?')) return;
  dbDelete(currentProjectId).then(function() {
    showToast('Baustelle gelöscht');
    showDashboard();
  });
}

function exportProject() {
  var data = collectProjectData();
  var name = (data.projekt || 'baustelle').replace(/[^\wäöüÄÖÜß\-]+/g, '_');
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'BASSA_Checkliste_' + name + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Export heruntergeladen');
}

function importProject(file) {
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var data = JSON.parse(ev.target.result);
      data.id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      data.updatedAt = Date.now();
      dbPut(data).then(function() {
        showToast('Baustelle importiert');
        showDashboard();
      });
    } catch (e) {
      showToast('Import fehlgeschlagen');
    }
  };
  reader.readAsText(file);
}

function copySummary() {
  var txt = generateSummary();
  navigator.clipboard.writeText(txt).then(function() {
    showToast('Zusammenfassung kopiert');
  }).catch(function() {
    showToast('Kopieren nicht möglich');
  });
}

/* ===== Event Listeners ===== */
document.getElementById('btnNewProject').addEventListener('click', createNewProject);
document.getElementById('btnNewEmpty').addEventListener('click', createNewProject);
document.getElementById('btnBack').addEventListener('click', showDashboard);
document.getElementById('btnDelete').addEventListener('click', deleteProject);
document.getElementById('btnExport').addEventListener('click', exportProject);
document.getElementById('btnCopy').addEventListener('click', copySummary);

document.getElementById('btnCheckAll').addEventListener('click', function() {
  document.querySelectorAll('#checklist input[type="checkbox"]').forEach(function(cb) { cb.checked = true; });
  updateDetailUI();
  autoSave();
});
document.getElementById('btnUncheckAll').addEventListener('click', function() {
  document.querySelectorAll('#checklist input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });
  updateDetailUI();
  autoSave();
});

document.querySelectorAll('#viewDetail input, #viewDetail select, #viewDetail textarea').forEach(function(el) {
  var evt = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
  el.addEventListener(evt, function() { updateDetailUI(); autoSave(); });
});

document.getElementById('importFile').addEventListener('change', function(e) {
  if (e.target.files[0]) importProject(e.target.files[0]);
  e.target.value = '';
});

/* ===== Init ===== */
openDB().then(function() {
  showDashboard();
}).catch(function() {
  showDashboard();
});
