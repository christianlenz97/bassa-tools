/* ===== Auth State ===== */
var currentUser = null;
var currentProjectId = null;

function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appShell').style.display = '';
}

function showLogin() {
  document.getElementById('loginScreen').style.display = '';
  document.getElementById('appShell').style.display = 'none';
  currentUser = null;
  currentProjectId = null;
}

/* ===== Login ===== */
document.getElementById('btnLogin').addEventListener('click', doLogin);
document.getElementById('loginPassword').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('loginEmail').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('loginPassword').focus();
});

async function doLogin() {
  var email = document.getElementById('loginEmail').value.trim();
  var pw = document.getElementById('loginPassword').value;
  var errEl = document.getElementById('loginError');
  var btn = document.getElementById('btnLogin');

  if (!email || !pw) {
    errEl.textContent = 'Bitte E-Mail und Passwort eingeben.';
    errEl.style.display = '';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Wird angemeldet...';
  errEl.style.display = 'none';

  var res = await sbLogin(email, pw);

  if (res.error) {
    errEl.textContent = 'Anmeldung fehlgeschlagen. Bitte pruefen Sie Ihre Zugangsdaten.';
    errEl.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Anmelden';
    return;
  }

  currentUser = res.data.user;
  btn.disabled = false;
  btn.textContent = 'Anmelden';
  showApp();
  showDashboard();
}

/* ===== Logout ===== */
document.getElementById('btnLogout').addEventListener('click', async function() {
  await sbLogout();
  showLogin();
});

/* ===== Auth State Change ===== */
var initialAuthDone = false;

sbOnAuthChange(function(event, session) {
  if (event === 'SIGNED_OUT') {
    showLogin();
    return;
  }
  if (session && session.user) {
    currentUser = session.user;
    if (!initialAuthDone) {
      initialAuthDone = true;
      showApp();
      showDashboard();
    } else {
      showApp();
    }
  }
});

/* ===== Init: check existing session ===== */
(async function initAuth() {
  var res = await sbGetSession();
  if (res.data && res.data.session && res.data.session.user) {
    currentUser = res.data.session.user;
    initialAuthDone = true;
    showApp();
    showDashboard();
  } else {
    showLogin();
  }
})();

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

var FIELDS = ['projekt','kunde','adresse','ansprechperson','telefon','beginn',
  'geruest','pv','spenglereiFarbe','spenglereiMaterial','eindeckung','zubehoer','notiz'];

var DB_FIELD_MAP = {
  spenglereiFarbe: 'spenglerei_farbe',
  spenglereiMaterial: 'spenglerei_material'
};

function toDbField(f) { return DB_FIELD_MAP[f] || f; }
function toFormField(dbf) {
  for (var k in DB_FIELD_MAP) {
    if (DB_FIELD_MAP[k] === dbf) return k;
  }
  return dbf;
}

function setTopbarContext(ctx) {
  document.getElementById('ctxDashboard').style.display = ctx === 'dashboard' ? '' : 'none';
  document.getElementById('ctxDetail').style.display = ctx === 'detail' ? '' : 'none';
  document.getElementById('ctxFotodoku').style.display = ctx === 'fotodoku' ? '' : 'none';
  document.getElementById('ctxMitteilung').style.display = ctx === 'mitteilung' ? '' : 'none';
  var burger = document.getElementById('btnBurger');
  if (ctx === 'detail') {
    burger.classList.add('hide-mobile');
  } else {
    burger.classList.remove('hide-mobile');
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
  var viewMitt = document.getElementById('viewMitteilung');

  viewDash.style.display = 'none';
  viewDetail.style.display = 'none';
  viewFoto.style.display = 'none';
  viewMitt.style.display = 'none';

  if (section === 'checkliste') {
    if (currentProjectId) {
      viewDetail.style.display = '';
      setTopbarContext('detail');
    } else {
      viewDash.style.display = '';
      setTopbarContext('dashboard');
      loadDashboard();
    }
  } else if (section === 'fotodoku') {
    viewFoto.style.display = '';
    setTopbarContext('fotodoku');
    var frame = document.getElementById('fotodokuFrame');
    if (frame.src === 'about:blank' || !frame.src.includes('fotodoku')) {
      frame.src = './fotodoku/';
    }
  } else if (section === 'mitteilung') {
    viewMitt.style.display = '';
    setTopbarContext('mitteilung');
    var mFrame = document.getElementById('mitteilungFrame');
    if (mFrame.src === 'about:blank' || !mFrame.src.includes('mitteilung')) {
      mFrame.src = './mitteilung/';
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
  switchSection('fotodoku');
}

function showDetail(id) {
  currentProjectId = id;
  document.getElementById('viewDashboard').style.display = 'none';
  document.getElementById('viewDetail').style.display = '';
  document.getElementById('viewFotodoku').style.display = 'none';
  document.getElementById('viewMitteilung').style.display = 'none';
  setTopbarContext('detail');
  closeSidebar();
  loadProject(id);
}

/* ===== Dashboard ===== */
async function loadDashboard() {
  var res = await sbGetAllProjects();
  var projects = (res.data || []);

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
        '<h3>' + esc(p.projekt || 'Neues Projekt') + '</h3>' +
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
  var res = await sbGetProject(id);
  if (res.error || !res.data) { showDashboard(); return; }
  var p = res.data;

  FIELDS.forEach(function(f) {
    var el = document.getElementById(f);
    if (el) {
      el.value = p[toDbField(f)] || '';
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
  document.getElementById('detailTitle').textContent = p.projekt || 'Neues Projekt';
}

function collectProjectData() {
  var data = {
    updated_at: Date.now(),
    user_id: currentUser.id
  };
  if (currentProjectId) data.id = currentProjectId;

  FIELDS.forEach(function(f) {
    data[toDbField(f)] = document.getElementById(f).value;
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
  saveTimer = setTimeout(async function() {
    var data = collectProjectData();
    await sbUpsertProject(data);
    document.getElementById('detailTitle').textContent = data.projekt || 'Neues Projekt';
  }, 600);
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
    'Kundenname: ' + valueOrDash(d.projekt) + '\n' +
    'Bauvorhaben: ' + valueOrDash(d.kunde) + '\n' +
    'Adresse: ' + valueOrDash(d.adresse) + '\n\n' +
    'Ansprechperson: ' + valueOrDash(d.ansprechperson) + '\n' +
    'Telefon: ' + valueOrDash(d.telefon) + '\n' +
    'Beginn unserer Leistung: ' + valueOrDash(d.beginn) + '\n' +
    'Gerüst: ' + valueOrDash(d.geruest) + '\n' +
    'PV-Anlage: ' + valueOrDash(d.pv) + '\n\n' +
    'Farbe Spenglerei: ' + valueOrDash(d.spenglerei_farbe) + '\n' +
    'Material Spenglerei: ' + valueOrDash(d.spenglerei_material) + '\n' +
    'Dacheindeckung: ' + valueOrDash(d.eindeckung) + '\n' +
    'Zubehör / Zusatzteile: ' + valueOrDash(d.zubehoer) + '\n' +
    'Interne Notizen: ' + valueOrDash(d.notiz) + '\n\n' +
    'OFFENE PUNKTE:\n' +
    (offene.length ? offene.join('\n') : '  * Keine offenen Punkte – Material bestellbereit.');
  document.getElementById('summaryBox').textContent = txt;
  return txt;
}

/* ===== Actions ===== */
async function createNewProject() {
  if (!currentUser) return;
  var defaultChecklist = [
    {label:'Auftrag vorhanden',checked:false},{label:'Pläne vorhanden',checked:false},
    {label:'Farbe geklärt',checked:false},{label:'Material geklärt',checked:false},
    {label:'Eindeckung geklärt',checked:false},{label:'Zubehör geklärt',checked:false},
    {label:'PV abgeklärt',checked:false},{label:'Beginn geklärt',checked:false},
    {label:'Gerüst geklärt',checked:false},{label:'Ansprechperson geklärt',checked:false},
    {label:'Material bestellbereit',checked:false}
  ];

  var data = { user_id: currentUser.id, updated_at: Date.now(), checklist: defaultChecklist };
  FIELDS.forEach(function(f) { data[toDbField(f)] = ''; });

  var res = await sbInsertProject(data);
  if (res.error) {
    showToast('Fehler beim Erstellen');
    return;
  }
  showDetail(res.data.id);
}

async function deleteProject() {
  if (!currentProjectId) return;
  if (!confirm('Diese Baustelle wirklich löschen?')) return;
  await sbDeleteProject(currentProjectId);
  showToast('Baustelle gelöscht');
  showDashboard();
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
  var name = (data.projekt || 'projekt').replace(/[^\wäöüÄÖÜß\-]+/g, '_');
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ unit: 'mm', format: 'a4' });

  var W = 210, ML = 14, MR = 14, CW = W - ML - MR;
  var y = 0;

  doc.setFillColor(245, 246, 248);
  doc.rect(0, 0, W, 297, 'F');

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

  rr(doc, ML, y, CW, 3.5, 1.5, [230, 232, 236]);
  if (pct > 0) {
    rr(doc, ML, y, Math.max(CW * pct / 100, 3), 3.5, 1.5, COL.orange);
  }
  y += 7;

  var stamm = [
    ['Kundenname', data.projekt],
    ['Bauvorhaben', data.kunde],
    ['Adresse', data.adresse],
    ['Ansprechperson', data.ansprechperson],
    ['Telefon', data.telefon],
    ['Beginn uns. Leistung', data.beginn],
    ['Geruest', data.geruest],
    ['PV-Anlage', data.pv],
    ['Farbe Spenglerei', data.spenglerei_farbe],
    ['Material Spenglerei', data.spenglerei_material],
    ['Dacheindeckung', data.eindeckung],
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

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(105, 112, 122);
  doc.text('BASSA Dach GmbH  --  Baustellen-Checkliste', ML, 290);
  doc.text('Seite 1 / 1', W - MR, 290, { align: 'right' });

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
  reader.onload = async function(ev) {
    try {
      var raw = JSON.parse(ev.target.result);
      var data = { user_id: currentUser.id, updated_at: Date.now(), checklist: raw.checklist || [] };
      FIELDS.forEach(function(f) {
        var dbf = toDbField(f);
        data[dbf] = raw[f] || raw[dbf] || '';
      });
      var res = await sbInsertProject(data);
      if (res.error) throw res.error;
      showToast('Baustelle importiert');
      showDashboard();
    } catch (e) {
      showToast('Import fehlgeschlagen');
    }
  };
  reader.readAsText(file);
}

function importFromPdf(file) {
  var reader = new FileReader();
  reader.onload = async function(ev) {
    try {
      var bytes = new Uint8Array(ev.target.result);
      var text = new TextDecoder('latin1').decode(bytes);
      var match = text.match(/\/Subject\s*\(BASSA_B64:([\w+/=]+)\)/);
      if (!match) {
        showToast('Kein BASSA-Projekt in PDF gefunden');
        return;
      }
      var jsonStr = decodeURIComponent(escape(atob(match[1])));
      var raw = JSON.parse(jsonStr);
      var data = { user_id: currentUser.id, updated_at: Date.now(), checklist: raw.checklist || [] };
      FIELDS.forEach(function(f) {
        var dbf = toDbField(f);
        data[dbf] = raw[f] || raw[dbf] || '';
      });
      var res = await sbInsertProject(data);
      if (res.error) throw res.error;
      showToast('Baustelle aus PDF importiert');
      showDashboard();
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
document.getElementById('btnBackMitteilung').addEventListener('click', showDashboard);
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

/* ===== Mitteilung Topbar Buttons ===== */
document.getElementById('btnMitteilungPdf').addEventListener('click', function() {
  var frame = document.getElementById('mitteilungFrame');
  try {
    var win = frame.contentWindow;
    if (win && typeof win.doPrint === 'function') { win.doPrint(); return; }
  } catch(e) {}
  if (frame && frame.contentWindow) {
    frame.contentWindow.postMessage({ action: 'exportPdf' }, '*');
  }
});
document.getElementById('btnMitteilungReset').addEventListener('click', function() {
  var frame = document.getElementById('mitteilungFrame');
  try {
    var win = frame.contentWindow;
    if (win && typeof win.doReset === 'function') { win.doReset(); return; }
  } catch(e) {}
  if (frame && frame.contentWindow) {
    frame.contentWindow.postMessage({ action: 'reset' }, '*');
  }
});

/* ===== Datepicker ===== */
if (typeof BassaDatepicker !== 'undefined') {
  new BassaDatepicker(document.getElementById('beginn'));
}
