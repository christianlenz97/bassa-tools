/* Durchfuehrungsmitteilung – app.js */

var $ = function(s) { return document.querySelector(s); };

var elKunde     = $('#kunde');
var elBetreff   = $('#betreff');
var elObjekt    = $('#objekt');
var elNummer    = $('#nummer');
var elDatum     = $('#datum');
var dropzone    = $('#dropzone');
var statusBox   = $('#status');
var fileInput   = $('#fileInput');

var prevKunde   = $('#preview-kunde');
var prevBetreff = $('#preview-betreff');
var prevObjekt  = $('#preview-objekt');
var prevNummer  = $('#preview-nummer');
var prevDatum   = $('#preview-datum');
var prevDatumTop = $('#preview-datum-top');

/* ===== Default date (today) ===== */
(function setDefaults() {
  var d = new Date();
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  elDatum.value = dd + '.' + mm + '.' + d.getFullYear();
  updatePreview();
})();

/* ===== Live preview ===== */
function updatePreview() {
  prevKunde.textContent   = elKunde.value || '[Kunde]';
  prevBetreff.textContent = elBetreff.value || '[Betreff]';
  prevObjekt.textContent  = elObjekt.value || '[Bauvorhaben]';
  prevNummer.textContent  = elNummer.value || '[Nr]';
  prevDatum.textContent   = elDatum.value || '[Datum]';
  prevDatumTop.textContent = elDatum.value || '[Datum]';
}

[elKunde, elBetreff, elObjekt, elNummer, elDatum].forEach(function(el) {
  el.addEventListener('input', updatePreview);
});

/* ===== Drag-and-drop ===== */
['dragenter', 'dragover'].forEach(function(evt) {
  dropzone.addEventListener(evt, function(e) {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach(function(evt) {
  dropzone.addEventListener(evt, function(e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});
dropzone.addEventListener('drop', function(e) {
  var file = e.dataTransfer.files[0];
  if (file) processFile(file);
});
fileInput.addEventListener('change', function() {
  if (fileInput.files[0]) processFile(fileInput.files[0]);
});

function showStatus(text, type) {
  statusBox.textContent = text;
  statusBox.className = 'status show ' + (type || 'ok');
}

/* ===== File processing ===== */
function processFile(file) {
  var name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    showStatus('📄 PDF wird analysiert …', 'warn');
    extractPdf(file);
  } else if (/\.(jpg|jpeg|png|webp|tiff?)$/i.test(name)) {
    showStatus('🔍 OCR läuft – Bild wird gelesen …', 'warn');
    extractImage(file);
  } else {
    showStatus('⚠ Nicht unterstütztes Format. Bitte PDF oder Bild hochladen.', 'warn');
  }
}

/* ===== PDF extraction via pdf.js ===== */
function extractPdf(file) {
  var reader = new FileReader();
  reader.onload = function() {
    var typedArray = new Uint8Array(reader.result);
    pdfjsLib.getDocument({data: typedArray}).promise.then(function(pdf) {
      var pages = [];
      var totalPages = pdf.numPages;

      function getPage(i) {
        if (i > totalPages) {
          var allText = pages.join('\n');
          fillFieldsFromText(allText);
          return;
        }
        pdf.getPage(i).then(function(page) {
          page.getTextContent().then(function(tc) {
            var str = tc.items.map(function(item) { return item.str; }).join(' ');
            pages.push(str);
            getPage(i + 1);
          });
        });
      }
      getPage(1);
    }).catch(function() {
      showStatus('⚠ PDF konnte nicht gelesen werden. Versuchen Sie es mit einem Bild.', 'warn');
    });
  };
  reader.readAsArrayBuffer(file);
}

/* ===== OCR via Tesseract.js ===== */
function extractImage(file) {
  var reader = new FileReader();
  reader.onload = function() {
    Tesseract.recognize(reader.result, 'deu', {
      logger: function(m) {
        if (m.status === 'recognizing text') {
          showStatus('🔍 OCR: ' + Math.round(m.progress * 100) + '%', 'warn');
        }
      }
    }).then(function(result) {
      fillFieldsFromText(result.data.text);
    }).catch(function() {
      showStatus('⚠ OCR fehlgeschlagen. Bitte Felder manuell ausfüllen.', 'warn');
    });
  };
  reader.readAsDataURL(file);
}

/* ===== Regex fallback extraction ===== */
function extractFieldsRegex(text) {
  var fields = {};
  var lines = text.split(/\n/);
  var fullText = text;

  for (var i = 0; i < lines.length; i++) {
    var trimmed = lines[i].trim();
    if (trimmed.length > 3 && !/^(angebot|auftrag|rechnung|bestell|datum|betreff|objekt|bauvorhaben|nr|pos)/i.test(trimmed)) {
      fields.kunde = trimmed;
      break;
    }
  }

  var betreffMatch = fullText.match(/Betreff[:\s]*([^\n]+)/i);
  if (betreffMatch) fields.betreff = betreffMatch[1].trim();

  var bvMatch = fullText.match(/(?:Bauvorhaben|Objekt|Baustelle)[:\s]*([^\n]+)/i);
  if (bvMatch) fields.bauvorhaben = bvMatch[1].trim();

  var nrMatch = fullText.match(/(?:Angebot|Auftrag|Bestell)(?:s)?(?:nummer|[-\s]?(?:Nr|No)\.?)[:\s]*(\S+)/i);
  if (nrMatch) fields.nummer = nrMatch[1].trim();
  if (!fields.nummer) {
    var nrFallback = fullText.match(/(?:Nr|Nummer)[.:\s]*(\d[\d\-\/]+)/i);
    if (nrFallback) fields.nummer = nrFallback[1].trim();
  }

  var datumMatch = fullText.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/);
  if (datumMatch) fields.datum = datumMatch[1];

  return fields;
}

/* ===== AI-based extraction via Supabase Edge Function ===== */
function extractFieldsAI(text) {
  return new Promise(function(resolve, reject) {
    var tokenSources = [];

    // Source 1: own supabase client (same localStorage on same origin)
    if (typeof supabase !== 'undefined') {
      tokenSources.push(
        supabase.auth.getSession().then(function(res) {
          return (res.data && res.data.session) ? res.data.session.access_token : null;
        }).catch(function() { return null; })
      );
    }

    // Source 2: parent window supabase client (iframe scenario)
    tokenSources.push(new Promise(function(res) {
      try {
        var parentSb = window.parent && window.parent !== window && window.parent.supabase;
        if (parentSb) {
          parentSb.auth.getSession().then(function(r) {
            res((r.data && r.data.session) ? r.data.session.access_token : null);
          }).catch(function() { res(null); });
          return;
        }
      } catch(e) {}
      res(null);
    }));

    Promise.all(tokenSources).then(function(tokens) {
      var token = tokens.find(function(t) { return !!t; }) || '';

      // Use anon key as fallback - Edge Function still gets called
      var headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      };
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      } else {
        headers['Authorization'] = 'Bearer ' + SUPABASE_ANON_KEY;
      }

      console.log('[Mitteilung] AI extraction: token=' + (token ? 'yes' : 'anon') + ', textLen=' + text.length);

      fetch(SUPABASE_URL + '/functions/v1/extract-fields', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ text: text.substring(0, 8000) })
      })
      .then(function(resp) {
        console.log('[Mitteilung] AI response status:', resp.status);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      })
      .then(function(data) {
        console.log('[Mitteilung] AI result:', data);
        if (data.error) throw new Error(data.error);
        resolve(data);
      })
      .catch(function(err) {
        console.error('[Mitteilung] AI error:', err);
        reject(err);
      });
    });
  });
}

/* ===== Fill fields: AI first, regex fallback ===== */
function fillFieldsFromText(text) {
  console.log('[Mitteilung] fillFieldsFromText called, length=' + text.length);
  console.log('[Mitteilung] SUPABASE_URL=' + (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : 'UNDEFINED'));
  showStatus('🤖 AI analysiert den Text …', 'warn');

  extractFieldsAI(text).then(function(f) {
    console.log('[Mitteilung] AI success:', JSON.stringify(f));
    applyFields(f, 'AI');
  }).catch(function(err) {
    console.warn('[Mitteilung] AI failed:', err.message, '- using regex fallback');
    var f = extractFieldsRegex(text);
    applyFields(f, 'Regex');
  });
}

function applyFields(f, method) {
  var count = 0;
  if (f.kunde)       { elKunde.value = f.kunde;       count++; }
  if (f.betreff)     { elBetreff.value = f.betreff;   count++; }
  if (f.bauvorhaben) { elObjekt.value = f.bauvorhaben; count++; }
  if (f.nummer)      { elNummer.value = f.nummer;      count++; }
  if (f.datum)       { elDatum.value = f.datum;        count++; }

  updatePreview();

  if (count > 0) {
    showStatus('✅ ' + count + ' Feld(er) erkannt (' + method + ').\nBitte überprüfen und ggf. korrigieren.', 'ok');
  } else {
    showStatus('⚠ Keine Felder erkannt.\nBitte manuell ausfüllen.', 'warn');
  }
}

/* ===== Stationery image preload for PDF ===== */
var stationeryDataUrl = null;
(function preloadStationery() {
  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function() {
    var c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    stationeryDataUrl = c.toDataURL('image/png');
  };
  img.src = 'assets/stationery.png';
})();

/* ===== Actions ===== */
function doPrint() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF-Bibliothek lädt noch, bitte nochmal versuchen.');
    return;
  }

  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ unit: 'mm', format: 'a4' });
  var W = 210, H = 297;
  var ML = 22, MR = 22;
  var contentW = W - ML - MR;

  if (stationeryDataUrl) {
    doc.addImage(stationeryDataUrl, 'PNG', 0, 0, W, H);
  }

  var y = 58;

  var kunde = elKunde.value || '[Kunde]';
  var betreff = elBetreff.value || 'Durchführung der beauftragten Arbeiten';
  var objekt = elObjekt.value || '[Bauvorhaben]';
  var nummer = elNummer.value || '[Nr]';
  var datum = elDatum.value || '[Datum]';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12.5);
  doc.setTextColor(0, 0, 0);
  var kundeLines = doc.splitTextToSize(kunde, 92);
  doc.text(kundeLines, ML, y);

  doc.setFontSize(11);
  doc.text('Datum: ' + datum, W - MR, y, { align: 'right' });

  y += kundeLines.length * 5.5 + 12;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Betreff:', ML, y);
  y += 6;
  doc.setFontSize(12);
  var betreffLines = doc.splitTextToSize(betreff, contentW);
  doc.text(betreffLines, ML, y);
  y += betreffLines.length * 5.5 + 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);

  doc.text('Sehr geehrte Damen und Herren,', ML, y);
  y += 10;

  var bodyText = 'Ihre Arbeiten wie beauftragt werden am ' + datum +
    ' laut Angebot/Auftrag ' + nummer +
    ' beim Bauvorhaben ' + objekt + ' durchgeführt.';
  var bodyLines = doc.splitTextToSize(bodyText, contentW);
  doc.text(bodyLines, ML, y);
  y += bodyLines.length * 5.5 + 8;

  var line2 = 'Wir bitten um Zugang zur Baustelle ab 7:00 Uhr und freien Zugang zu den relevanten Arbeitsbereichen.';
  var line2Lines = doc.splitTextToSize(line2, contentW);
  doc.text(line2Lines, ML, y);
  y += line2Lines.length * 5.5 + 8;

  doc.text('Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.', ML, y);
  y += 16;

  doc.text('Mit freundlichen Grüßen', ML, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('BASSA Dach GmbH', ML, y);

  var filename = 'Durchfuehrungsmitteilung';
  if (objekt && objekt !== '[Bauvorhaben]') {
    filename += '_' + objekt.replace(/[^\wäöüÄÖÜß\-]+/g, '_').substring(0, 40);
  }
  filename += '.pdf';

  doc.save(filename);
}

function doReset() {
  elKunde.value = '';
  elBetreff.value = '';
  elObjekt.value = '';
  elNummer.value = '';
  var d = new Date();
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  elDatum.value = dd + '.' + mm + '.' + d.getFullYear();
  statusBox.className = 'status';
  updatePreview();
}

function doDemo() {
  elKunde.value = 'Mustermann GmbH\nMusterstraße 1\n1234 Musterstadt';
  elBetreff.value = 'Durchführung der beauftragten Arbeiten\nPreisvorteil Dachsanierung';
  elObjekt.value = 'Neubau Musterstraße 1, 1234 Musterstadt';
  elNummer.value = 'ANG-2025-0042';
  var d = new Date();
  d.setDate(d.getDate() + 7);
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  elDatum.value = dd + '.' + mm + '.' + d.getFullYear();
  updatePreview();
  showStatus('✅ Demo-Daten eingefüllt – so sieht der Brief aus.', 'ok');
}
