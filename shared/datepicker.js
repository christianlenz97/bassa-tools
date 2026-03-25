/* HeroUI-inspired Datepicker - Vanilla JS, German locale, Year Picker */
(function() {
  var MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  var DAYS = ['Mo','Di','Mi','Do','Fr','Sa','So'];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function firstDayOfMonth(y, m) { var d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }
  function formatDE(y, m, d) { return pad(d) + '.' + pad(m + 1) + '.' + y; }

  function parseDE(str) {
    if (!str) return null;
    var p = str.split('.');
    if (p.length !== 3) return null;
    var d = parseInt(p[0], 10), m = parseInt(p[1], 10) - 1, y = parseInt(p[2], 10);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
    return { day: d, month: m, year: y };
  }

  function BassaDatepicker(inputEl, opts) {
    opts = opts || {};
    var self = this;
    self.input = inputEl;
    self.onChange = opts.onChange || null;
    self.popup = null;
    self.isOpen = false;
    self.yearPickerOpen = false;
    self.viewYear = new Date().getFullYear();
    self.viewMonth = new Date().getMonth();
    self.selectedDate = null;

    var existing = parseDE(inputEl.value);
    if (existing) {
      self.selectedDate = existing;
      self.viewYear = existing.year;
      self.viewMonth = existing.month;
    } else if (opts.defaultToday) {
      var now = new Date();
      self.selectedDate = { day: now.getDate(), month: now.getMonth(), year: now.getFullYear() };
      self.viewYear = now.getFullYear();
      self.viewMonth = now.getMonth();
      inputEl.value = formatDE(self.selectedDate.year, self.selectedDate.month, self.selectedDate.day);
    }

    inputEl.readOnly = true;
    inputEl.style.cursor = 'pointer';

    inputEl.addEventListener('click', function(e) {
      e.stopPropagation();
      if (self.isOpen) self.close(); else self.open();
    });

    document.addEventListener('click', function(e) {
      if (self.isOpen && self.popup && !self.popup.contains(e.target) && e.target !== inputEl) {
        self.close();
      }
    });
  }

  BassaDatepicker.prototype.open = function() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.yearPickerOpen = false;
    if (!this.popup) {
      this.popup = document.createElement('div');
      this.popup.className = 'bp-popup';
      document.body.appendChild(this.popup);
    }
    this.render();
    this.position();
    this.popup.classList.add('bp-show');
  };

  BassaDatepicker.prototype.close = function() {
    this.isOpen = false;
    this.yearPickerOpen = false;
    if (this.popup) this.popup.classList.remove('bp-show');
  };

  BassaDatepicker.prototype.position = function() {
    var rect = this.input.getBoundingClientRect();
    var st = window.scrollY || document.documentElement.scrollTop;
    var sl = window.scrollX || document.documentElement.scrollLeft;
    this.popup.style.top = (rect.bottom + st + 6) + 'px';
    this.popup.style.left = (rect.left + sl) + 'px';
  };

  BassaDatepicker.prototype.select = function(y, m, d) {
    this.selectedDate = { year: y, month: m, day: d };
    this.input.value = formatDE(y, m, d);
    if (this.onChange) this.onChange(this.input.value);
    this.input.dispatchEvent(new Event('input', { bubbles: true }));
    this.close();
  };

  BassaDatepicker.prototype.render = function() {
    if (this.yearPickerOpen) { this.renderYearPicker(); return; }
    this.renderCalendar();
  };

  BassaDatepicker.prototype.renderCalendar = function() {
    var self = this;
    var y = self.viewYear, m = self.viewMonth;
    var today = new Date();
    var todayY = today.getFullYear(), todayM = today.getMonth(), todayD = today.getDate();
    var days = daysInMonth(y, m);
    var firstDay = firstDayOfMonth(y, m);
    var prevDays = daysInMonth(y, m === 0 ? 11 : m - 1);

    var html = '<div class="bp-header">' +
      '<button class="bp-nav" data-dir="prev"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 2L4 7l5 5"/></svg></button>' +
      '<button class="bp-heading" data-action="year">' + MONTHS[m] + ' ' + y + ' <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4l3 3 3-3"/></svg></button>' +
      '<button class="bp-nav" data-dir="next"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 2l5 5-5 5"/></svg></button>' +
      '</div>';

    html += '<div class="bp-weekdays">' + DAYS.map(function(d) { return '<span>' + d + '</span>'; }).join('') + '</div>';

    html += '<div class="bp-grid">';
    for (var i = 0; i < firstDay; i++) {
      var pd = prevDays - firstDay + 1 + i;
      html += '<button class="bp-day bp-other" disabled>' + pd + '</button>';
    }
    for (var d = 1; d <= days; d++) {
      var cls = 'bp-day';
      if (d === todayD && m === todayM && y === todayY) cls += ' bp-today';
      if (self.selectedDate && d === self.selectedDate.day && m === self.selectedDate.month && y === self.selectedDate.year) cls += ' bp-selected';
      html += '<button class="' + cls + '" data-day="' + d + '">' + d + '</button>';
    }
    var totalCells = firstDay + days;
    var remaining = (7 - (totalCells % 7)) % 7;
    for (var r = 1; r <= remaining; r++) {
      html += '<button class="bp-day bp-other" disabled>' + r + '</button>';
    }
    html += '</div>';

    self.popup.innerHTML = html;

    self.popup.querySelector('[data-dir="prev"]').addEventListener('click', function(e) {
      e.stopPropagation();
      self.viewMonth--;
      if (self.viewMonth < 0) { self.viewMonth = 11; self.viewYear--; }
      self.render();
    });
    self.popup.querySelector('[data-dir="next"]').addEventListener('click', function(e) {
      e.stopPropagation();
      self.viewMonth++;
      if (self.viewMonth > 11) { self.viewMonth = 0; self.viewYear++; }
      self.render();
    });
    self.popup.querySelector('[data-action="year"]').addEventListener('click', function(e) {
      e.stopPropagation();
      self.yearPickerOpen = true;
      self.render();
    });
    self.popup.querySelectorAll('.bp-day[data-day]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        self.select(y, m, parseInt(btn.dataset.day, 10));
      });
    });
  };

  BassaDatepicker.prototype.renderYearPicker = function() {
    var self = this;
    var currentYear = new Date().getFullYear();
    var startYear = currentYear - 10;
    var endYear = currentYear + 10;

    var html = '<div class="bp-header">' +
      '<button class="bp-nav" data-dir="prev-decade"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 2L4 7l5 5"/></svg></button>' +
      '<button class="bp-heading" data-action="back">' + MONTHS[self.viewMonth] + ' ' + self.viewYear + ' <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" style="transform:rotate(180deg)"><path d="M2 4l3 3 3-3"/></svg></button>' +
      '<button class="bp-nav" data-dir="next-decade"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 2l5 5-5 5"/></svg></button>' +
      '</div>';

    html += '<div class="bp-year-grid">';
    for (var yr = startYear; yr <= endYear; yr++) {
      var cls = 'bp-year';
      if (yr === self.viewYear) cls += ' bp-year-active';
      if (yr === currentYear) cls += ' bp-year-current';
      html += '<button class="' + cls + '" data-year="' + yr + '">' + yr + '</button>';
    }
    html += '</div>';

    self.popup.innerHTML = html;

    self.popup.querySelector('[data-action="back"]').addEventListener('click', function(e) {
      e.stopPropagation();
      self.yearPickerOpen = false;
      self.render();
    });
    self.popup.querySelector('[data-dir="prev-decade"]').addEventListener('click', function(e) {
      e.stopPropagation();
      self.viewYear -= 10;
      self.yearPickerOpen = true;
      self.render();
    });
    self.popup.querySelector('[data-dir="next-decade"]').addEventListener('click', function(e) {
      e.stopPropagation();
      self.viewYear += 10;
      self.yearPickerOpen = true;
      self.render();
    });
    self.popup.querySelectorAll('.bp-year[data-year]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        self.viewYear = parseInt(btn.dataset.year, 10);
        self.yearPickerOpen = false;
        self.render();
      });
    });
  };

  window.BassaDatepicker = BassaDatepicker;
})();
