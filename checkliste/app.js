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

/* ===== Sidebar Toggle ===== */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

/* ===== Section Navigation ===== */
var currentSection = 'checkliste';

function setTopbarContext(ctx) {
  document.getElementById('ctxDashboard').style.display = ctx === 'dashboard' ? '' : 'none';
  document.getElementById('ctxDetail').style.display = ctx === 'detail' ? '' : 'none';
  document.getElementById('ctxFotodoku').style.display = ctx === 'fotodoku' ? '' : 'none';
  var burger = document.getElementById('btnBurger');
  if (ctx === 'dashboard') {
    burger.classList.remove('hide-mobile');
  } else {
    burger.classList.add('hide-mobile');
  }
}

function switchSection(section) {
  currentSection = section;
  closeSidebar();

  document.querySelectorAll('.nav-item[data-section]').forEach(function(el) {
    el.classList.toggle('active', el.dataset.section === section);
  });

  var viewDash = document.getElementById('viewDashboard');
  var viewDetail = document.getElementById('viewDetail');
  var viewFoto = document.getElementById('viewFotodoku');

  if (section === 'checkliste') {
    viewFoto.style.display = 'none';
    if (currentProjectId) {
      viewDash.style.display = 'none';
      viewDetail.style.display = '';
      setTopbarContext('detail');
    } else {
      viewDash.style.display = '';
      viewDetail.style.display = 'none';
      setTopbarContext('dashboard');
      loadDashboard();
    }
  } else if (section === 'fotodoku') {
    viewDash.style.display = 'none';
    viewDetail.style.display = 'none';
    viewFoto.style.display = '';
    setTopbarContext('fotodoku');
    var frame = document.getElementById('fotodokuFrame');
    if (frame.src === 'about:blank' || !frame.src.includes('fotodoku')) {
      frame.src = '../fotodoku/';
    }
  }
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
  document.getElementById('viewFotodoku').style.display = 'none';
  setTopbarContext('dashboard');
  document.querySelectorAll('.nav-item[data-section]').forEach(function(el) {
    el.classList.toggle('active', el.dataset.section === 'checkliste');
  });
  currentSection = 'checkliste';
  closeSidebar();
  loadDashboard();
}

function showDetail(id) {
  currentProjectId = id;
  document.getElementById('viewDashboard').style.display = 'none';
  document.getElementById('viewDetail').style.display = '';
  document.getElementById('viewFotodoku').style.display = 'none';
  setTopbarContext('detail');
  closeSidebar();
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
    if (el) {
      el.value = p[f] || '';
    }
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

/* ===== PDF Export ===== */
var COL = {
  dark: [47,52,58], orange: [232,93,12], ok: [23,138,69],
  mid: [105,112,122], light: [245,246,248], line: [217,221,227],
  white: [255,255,255], card: [255,255,255],
  warnBg: [255,243,236], okBg: [232,246,238], openBg: [238,241,245]
};

function rr(d, x, y, w, h, r, c) {
  d.setFillColor(c[0], c[1], c[2]);
  d.roundedRect(x, y, w, h, r, r, 'F');
}

function drawCheckbox(d, x, y, size, checked) {
  var s = size;
  if (checked) {
    d.setFillColor(23, 138, 69);
    d.roundedRect(x, y, s, s, 1, 1, 'F');
    d.setDrawColor(255, 255, 255);
    d.setLineWidth(0.5);
    d.line(x + s * 0.2, y + s * 0.52, x + s * 0.42, y + s * 0.75);
    d.line(x + s * 0.42, y + s * 0.75, x + s * 0.8, y + s * 0.25);
  } else {
    d.setDrawColor(180, 180, 180);
    d.setLineWidth(0.35);
    d.roundedRect(x, y, s, s, 1, 1, 'S');
  }
}

function exportProject() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('PDF-Bibliothek laedt noch, bitte nochmal versuchen');
    return;
  }
  var data = collectProjectData();
  var name = (data.projekt || 'baustelle').replace(/[^\wäöüÄÖÜß\-]+/g, '_');
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ unit: 'mm', format: 'a4' });

  var W = 210, ML = 14, MR = 14, CW = W - ML - MR;
  var y = 0;

  /* ---- Page background ---- */
  doc.setFillColor(245, 246, 248);
  doc.rect(0, 0, W, 297, 'F');

  /* ---- Dark header ---- */
  doc.setFillColor(47, 52, 58);
  doc.rect(0, 0, W, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('BAUSTELLEN-CHECKLISTE', ML, 13);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);
  doc.text('BASSA Dach', ML, 20);
  var today = new Date();
  doc.setFontSize(7);
  doc.text(today.getDate() + '.' + (today.getMonth() + 1) + '.' + today.getFullYear(), ML, 26);

  /* ---- Status pill top-right ---- */
  var pct = calcProgress(data.checklist);
  var statusTxt, pillBg, pillCol;
  if (pct === 100) { statusTxt = 'BESTELLBEREIT'; pillBg = COL.okBg; pillCol = COL.ok; }
  else if (pct >= 50) { statusTxt = 'IN ARBEIT'; pillBg = COL.warnBg; pillCol = COL.orange; }
  else { statusTxt = 'OFFEN'; pillBg = COL.openBg; pillCol = COL.dark; }

  var pw = doc.getTextWidth(statusTxt) + 8;
  rr(doc, W - MR - pw, 9, pw, 7, 3, pillBg);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(pillCol[0], pillCol[1], pillCol[2]);
  doc.text(statusTxt, W - MR - pw / 2, 14, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(pct + ' %', W - MR - pw / 2, 24, { align: 'center' });

  y = 34;

  /* ---- Progress bar ---- */
  rr(doc, ML, y, CW, 3.5, 1.5, [230, 232, 236]);
  if (pct > 0) {
    rr(doc, ML, y, Math.max(CW * pct / 100, 3), 3.5, 1.5, COL.orange);
  }
  y += 7;

  /* ---- Stammdaten Card ---- */
  var stamm = [
    ['Baustelle / Projekt', data.projekt],
    ['Kunde / Bauherr', data.kunde],
    ['Adresse', data.adresse],
    ['Ansprechperson', data.ansprechperson],
    ['Telefon', data.telefon],
    ['Beginn Dachdecker', data.beginn],
    ['Geruest', data.geruest],
    ['PV-Anlage', data.pv],
    ['Farbe Spenglerei', data.spenglereiFarbe],
    ['Material Spenglerei', data.spenglereiMaterial],
    ['Eindeckung', data.eindeckung],
    ['Zubehoer', data.zubehoer],
    ['Notizen', data.notiz]
  ];

  var cardX = ML, cardPad = 5;
  var innerX = cardX + cardPad;
  var innerW = CW - cardPad * 2;
  var labelCol = 42;

  var stammH = 8 + stamm.length * 5.2 + 3;
  rr(doc, cardX, y, CW, stammH, 3, COL.card);
  doc.setDrawColor(217, 221, 227);
  doc.roundedRect(cardX, y, CW, stammH, 3, 3, 'S');

  var cy = y + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(47, 52, 58);
  doc.text('Stammdaten', innerX, cy);

  rr(doc, innerX + innerW - 22, cy - 4, 22, 6, 2, COL.warnBg);
  doc.setFontSize(5.5);
  doc.setTextColor(232, 93, 12);
  doc.text('CHEF-CHECK', innerX + innerW - 11, cy - 0.5, { align: 'center' });

  cy += 4;
  doc.setDrawColor(217, 221, 227);
  doc.line(innerX, cy, innerX + innerW, cy);
  cy += 4;

  stamm.forEach(function(row) {
    var val = String(row[1] || '-').trim() || '-';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(105, 112, 122);
    doc.text(row[0].toUpperCase(), innerX, cy);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(47, 52, 58);
    var lines = doc.splitTextToSize(val, innerW - labelCol);
    doc.text(lines, innerX + labelCol, cy);
    cy += Math.max(lines.length * 3.8, 5.2);
  });

  y += stammH + 5;

  /* ---- Checkliste Card (two columns) ---- */
  var items = data.checklist || [];
  var half = Math.ceil(items.length / 2);
  var colW = (CW - cardPad * 2 - 6) / 2;
  var rowH = 7.5;
  var checkRows = Math.max(half, items.length - half);
  var checkCardH = 8 + checkRows * rowH + 5;

  rr(doc, cardX, y, CW, checkCardH, 3, COL.card);
  doc.setDrawColor(217, 221, 227);
  doc.roundedRect(cardX, y, CW, checkCardH, 3, 3, 'S');

  cy = y + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(47, 52, 58);
  doc.text('Pflicht-Checkliste', innerX, cy);
  cy += 4;
  doc.setDrawColor(217, 221, 227);
  doc.line(innerX, cy, innerX + innerW, cy);
  cy += 4;

  var startCy = cy;
  var cbSize = 3.5;

  for (var col = 0; col < 2; col++) {
    var colX = innerX + col * (colW + 6);
    var ry = startCy;
    var startIdx = col * half;
    var endIdx = Math.min(startIdx + half, items.length);

    for (var i = startIdx; i < endIdx; i++) {
      var item = items[i];
      var rowBg = item.checked ? COL.okBg : COL.light;
      rr(doc, colX, ry - 1.5, colW, rowH - 1.5, 2, rowBg);

      drawCheckbox(doc, colX + 2, ry - 0.2, cbSize, item.checked);

      doc.setFont('helvetica', item.checked ? 'normal' : 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(item.checked ? 23 : 47, item.checked ? 138 : 52, item.checked ? 69 : 58);
      doc.text(item.label, colX + 2 + cbSize + 2.5, ry + 2.5);

      ry += rowH;
    }
  }

  /* ---- Footer ---- */
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(105, 112, 122);
  doc.text('BASSA Dach GmbH  --  Baustellen-Checkliste', ML, 290);
  doc.text('Seite 1 / 1', W - MR, 290, { align: 'right' });

  /* ---- Embed data for re-import ---- */
  var jsonStr = JSON.stringify(data);
  var b64 = btoa(unescape(encodeURIComponent(jsonStr)));
  doc.setProperties({ subject: 'BASSA_B64:' + b64 });

  var blob = doc.output('blob');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'BASSA_Checkliste_' + name + '.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  showToast('PDF heruntergeladen');
}

/* ===== Import (JSON or PDF) ===== */
function importProject(file) {
  if (file.name.toLowerCase().endsWith('.pdf')) {
    importFromPdf(file);
  } else {
    importFromJson(file);
  }
}

function importFromJson(file) {
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

function importFromPdf(file) {
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var bytes = new Uint8Array(ev.target.result);
      var text = new TextDecoder('latin1').decode(bytes);
      var match = text.match(/\/Subject\s*\(BASSA_B64:([\w+/=]+)\)/);
      if (!match) {
        showToast('Kein BASSA-Projekt in PDF gefunden');
        return;
      }
      var jsonStr = decodeURIComponent(escape(atob(match[1])));
      var data = JSON.parse(jsonStr);
      data.id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      data.updatedAt = Date.now();
      dbPut(data).then(function() {
        showToast('Baustelle aus PDF importiert');
        showDashboard();
      });
    } catch (e) {
      showToast('PDF-Import fehlgeschlagen');
    }
  };
  reader.readAsArrayBuffer(file);
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
document.getElementById('btnBurger').addEventListener('click', openSidebar);
document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

document.querySelectorAll('.nav-item[data-section]').forEach(function(el) {
  el.addEventListener('click', function(e) {
    e.preventDefault();
    switchSection(el.dataset.section);
  });
});

document.getElementById('btnNewProject').addEventListener('click', createNewProject);
document.getElementById('btnNewEmpty').addEventListener('click', createNewProject);
document.getElementById('btnBack').addEventListener('click', showDashboard);
document.getElementById('btnBackFoto').addEventListener('click', showDashboard);
document.getElementById('btnDelete').addEventListener('click', deleteProject);
document.getElementById('btnExport').addEventListener('click', exportProject);
document.getElementById('btnCopy').addEventListener('click', copySummary);

document.getElementById('btnImportDash').addEventListener('click', function() {
  document.getElementById('importFile').click();
});

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

document.getElementById('btnFotoPick').addEventListener('click', function() {
  var frame = document.getElementById('fotodokuFrame');
  try {
    var fi = frame.contentDocument.getElementById('fileInput');
    if (fi) { fi.click(); return; }
  } catch(e) {}
  if (frame && frame.contentWindow) {
    frame.contentWindow.postMessage({ action: 'pickImages' }, '*');
  }
});
document.getElementById('btnFotoExport').addEventListener('click', function() {
  var frame = document.getElementById('fotodokuFrame');
  try {
    var win = frame.contentWindow;
    if (win && typeof win.saveAsPdf === 'function') { win.saveAsPdf(); return; }
  } catch(e) {}
  if (frame && frame.contentWindow) {
    frame.contentWindow.postMessage({ action: 'exportPdf' }, '*');
  }
});

/* ===== Datepicker ===== */
if (typeof BassaDatepicker !== 'undefined') {
  new BassaDatepicker(document.getElementById('beginn'));
}

/* ===== Init ===== */
openDB().then(function() {
  showDashboard();
}).catch(function() {
  showDashboard();
});
