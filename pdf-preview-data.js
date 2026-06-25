// pdf-preview-data.js
// Bridges Wirtschaftlichkeitstool C object -> pdf-preview.html
// Reads from localStorage (key SUEDENERGIE_PDF_C) when triggered by exportPDF().
// Falls back to static demo data when opened standalone.

(function () {
  'use strict';

  /* ── Formatters (mirrors index.html recalc) ──────────────────────────────── */
  const fe = (v, dec) => {
    dec = dec === undefined ? 2 : dec;
    return isNaN(v) || !isFinite(v) ? '--'
      : v.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ' €';
  };
  const fk = function (v) { return Math.round(v).toLocaleString('de-DE') + ' kWh'; };
  const fn = function (v, dec) {
    dec = dec === undefined ? 2 : dec;
    return v.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  const pct = function (v, dec) {
    dec = dec === undefined ? 1 : dec;
    return fn(v, dec) + ' %';
  };
  const fDate = function () {
    return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  /* ── Try to load live C data from localStorage ───────────────────────────── */
  var C = null, customer = null;
  try {
    var raw = localStorage.getItem('SUEDENERGIE_PDF_C');
    if (raw) { var p = JSON.parse(raw); C = p.C; customer = p.customer || {}; }
  } catch (e) { /* ignore — fall through to demo */ }

  /* ── Build all data structures ───────────────────────────────────────────── */
  var flat, nested, tableRows20;

  if (C) {
    /* ──────────────────────────────────────────────────────────────────────────
       LIVE DATA PATH — from Wirtschaftlichkeitstool C object
    ────────────────────────────────────────────────────────────────────────── */
    var d = C;
    var loanOn = !!d.loanOn;
    var ps100 = (d.ps * 100).toFixed(1).replace('.', ',');
    var kName = ((customer.vorname || '') + ' ' + (customer.nachname || '')).trim() || '–';

    /* 20-year table rows (0-indexed, all 20 rows) */
    tableRows20 = [];
    // Amortisation: Start bei Gesamtkosten der Anlage (inkl. Zinsen), getilgt durch die Stromersparnis
    var startKap = -(d.ak + d.zinsenGes);
    var kum = startKap, beFound = false, beYear = -1;
    for (var y = 1; y <= 20; y++) {
      var spY = d.sp * Math.pow(1 + d.ps, y - 1);
      var ersEV_y = d.eigVerb * spY;
      var ersEi_y = d.einspm * d.esv;
      var ersY = ersEV_y + ersEi_y;
      var rJ = (loanOn && y <= d.lz) ? d.rate * 12 : 0;
      kum += ersY;
      if (!beFound && kum >= 0) { beFound = true; beYear = y; }
      tableRows20.push({
        year: y,
        selfUse: fe(ersEV_y),
        feedIn: fe(ersEi_y),
        totalSavings: fe(ersY),
        loanRate: rJ > 0 ? fe(rJ) : '–',
        balance: fe(kum),
        isBreakEven: false,
        isLoan: loanOn && y <= d.lz,
        kumVal: kum,
      });
    }
    if (beYear > 0) tableRows20[beYear - 1].isBreakEven = true;

    flat = {
      createdAt:        fDate(),
      customerName:     kName,
      customerAddress:  customer.adresse || '–',
      projectAddress:   customer.bauvorhaben || '–',
      systemSize:       fn(d.anlLei, 2) + ' kWp',
      modules:          d.manz + ' × ' + d.mlei + ' Wp',
      investment:       fe(d.ak),
      equity:           fe(d.ek),
      netMonthlyAvg:    fe(loanOn ? d.nettoMk : d.ersSum_m),
      annualConsumption:fk(d.jv),
      electricityPrice: fn(d.sp, 3) + ' €/kWh',
      priceIncrease:    d.ps > 0 ? ps100 + ' %' : '–',
      sunHours:         fn(d.lstu, 0) + ' h',
      annualProduction: fk(d.jahrProd),
      selfUseRate:      Math.round(d.enq * 100) + ' %',
      feedInTariff:     fn(d.esv, 3) + ' €/kWh',
      oldMonthlyAvg:    fe(d.alteMk),
      oldMonthlyJahr1:  'Stromkosten ohne PV',
      newMonthly:       fe(loanOn ? d.neuGesamt : d.neueMk),
      newMonthlyJahr:   loanOn ? 'inkl. Kreditrate ' + fe(d.rate) + ' / Mon.' : 'reine Stromkosten mit PV',
      orangeNetSub:     loanOn ? 'Ersparnis − Kreditrate / Monat' : 'monatlich verfügbar',
      growToday:        fe(d.ersM_J1),
      growY20:          fe(d.ersM_J20),
      growFoot:         d.ps > 0 ? 'bei ' + ps100 + ' % Strompreissteigerung p.a. · Brutto-Stromersparnis' : 'ohne Strompreissteigerung · Brutto-Stromersparnis',
      breakEvenLabel:   loanOn ? 'Break-even (inkl. Kredit)' : 'Break-even',
      creditLegend:     'Kreditlaufzeit (' + d.lz + ' J.)',
      selfConsumption:  fk(d.eigVerb),
      feedIn:           fk(d.einspm),
      costWithoutPv20y: fe(d.ohne20),
      costWithPv20y:    fe(d.mitGesamt20),
      breakEven:        beYear > 0 && beYear <= 30 ? fn(beYear, 0) + ' Jahre' : '>30 Jahre',
      totalBenefit:     fe(d.vorteil),
      loanAmount:       fe(d.darlehn),
      interestRate:     pct(d.zsRaw),
      loanYears:        d.lz + ' Jahre',
      monthlyRate:      fe(d.rate),
      totalInterest:    fe(d.zinsenGes),
      totalRepayment:   fe(d.rueckGes),
      ratePlusNewCost:  fe(loanOn ? d.neuGesamt : d.neueMk),
      monthlyDifference:(d.nettoMk >= 0 ? '+ ' : '') + fe(d.nettoMk),
    };

    nested = {
      meta:     { createdAt: flat.createdAt },
      customer: { name: flat.customerName, address: flat.customerAddress, project: flat.projectAddress },
      system: {
        consumption:     flat.annualConsumption,
        electricityPrice:flat.electricityPrice,
        priceIncrease:   flat.priceIncrease,
        modules:         flat.modules,
        power:           flat.systemSize,
        sunHours:        flat.sunHours,
        production:      flat.annualProduction,
        selfUseRate:     flat.selfUseRate,
        feedInTariff:    flat.feedInTariff,
        investment:      flat.investment,
      },
      results: {
        oldMonthly:   flat.oldMonthlyAvg,
        newMonthly:   flat.newMonthly,
        netMonthly:   flat.netMonthlyAvg,
        ownUseKwh:    flat.selfConsumption,
        feedInKwh:    flat.feedIn,
        costWithoutPv:flat.costWithoutPv20y,
        costWithPv:   flat.costWithPv20y,
        breakEven:    flat.breakEven,
        totalBenefit: flat.totalBenefit,
      },
      financing: { equity: flat.equity },
      savingsRows: [
        {
          kwh: Math.round(d.eigVerb).toLocaleString('de-DE'),
          rate: fn(d.sp, 3),
          monthly: fe(d.ersEV_m),
          year1: fe(d.ersEV_j),
          years20: fe(d.ersEV_20j),
        },
        {
          kwh: Math.round(d.einspm).toLocaleString('de-DE'),
          rate: fn(d.esv, 3),
          monthly: fe(d.ersEi_m),
          year1: fe(d.ersEi_j),
          years20: fe(d.ersEi_20j),
        },
        {
          kwh: '–',
          rate: '–',
          monthly: fe(d.ersSum_m),
          year1: fe(d.ersSum_j),
          years20: fe(d.ersSum_20j),
        },
      ],
    };

    /* hide page 3 when no loan, loan amount is zero (ek >= ak), or term is zero */
    if (!loanOn || d.darlehn === 0 || d.lz === 0) {
      var p3 = document.querySelector('.page.page-3');
      if (p3) p3.style.display = 'none';
      var loanLegendBox = document.querySelector('.page-4 .legend-item .legend-box.orange');
      if (loanLegendBox) loanLegendBox.closest('.legend-item').style.display = 'none';
    }

    /* negative Unterschied → rote Farbe + Pfeil runter */
    if (d.nettoMk < 0) {
      var ct = document.querySelector('.page-3 .compare-total');
      if (ct) ct.classList.add('negative');
    }

    /* negative Netto-Ersparnis → rot signalisieren (Seite 1 Cover, Seite 2 Box, Seite 3 Summary) */
    var netNeg = (loanOn ? d.nettoMk : d.ersSum_m) < 0;
    if (netNeg) {
      document.querySelectorAll('[data-field="netMonthlyAvg"]').forEach(function (el) { el.classList.add('neg'); });
      var orangeBox = document.querySelector('.page-2 .orange-result');
      if (orangeBox) orangeBox.classList.add('negative');
    }

    /* update "Kreditlaufzeit (X J.)" in page 4 legend */
    if (loanOn) {
      var orangeBox = document.querySelector('.page-4 .legend-item .legend-box.orange');
      if (orangeBox) {
        var lzSpan = orangeBox.nextElementSibling;
        if (lzSpan) lzSpan.textContent = 'Kreditlaufzeit (' + d.lz + ' J.)';
      }
    }

  } else {
    /* ──────────────────────────────────────────────────────────────────────────
       DEMO / STANDALONE FALLBACK
    ────────────────────────────────────────────────────────────────────────── */
    flat = {
      createdAt:        '21.06.2026',
      customerName:     'Max Mustermann',
      customerAddress:  'Musterstraße 1, 12345 Musterstadt',
      projectAddress:   'Einfamilienhaus, Neubau',
      systemSize:       '10,12 kWp',
      modules:          '22 × 460 W',
      investment:       '15.000,00 €',
      equity:           '0,00 €',
      netMonthlyAvg:    '86,17 €',
      annualConsumption:'4.000 kWh',
      electricityPrice: '0,320 €/kWh',
      priceIncrease:    '4,0 %',
      sunHours:         '950 h',
      annualProduction: '9.614 kWh',
      selfUseRate:      '75 %',
      feedInTariff:     '0,078 €/kWh',
      oldMonthlyAvg:    '158,82 €',
      oldMonthlyJahr1:  'aktuell: 106,67 € / Mon.',
      newMonthly:       '135,54 €',
      newMonthlyJahr:   'davon Kreditrate: 151,87 € / Mon.',
      orangeNetSub:     'monatlich verfügbar',
      growToday:        '122,99 €',
      growY20:          '211,54 €',
      growFoot:         'bei 4,0 % Strompreissteigerung p.a. · Brutto-Stromersparnis',
      breakEvenLabel:   'Break-even (inkl. Kredit)',
      creditLegend:     'Kreditlaufzeit (10 J.)',
      selfConsumption:  '3.000 kWh',
      feedIn:           '6.614 kWh',
      costWithoutPv20y: '38.115,94 €',
      costWithPv20y:    '14.211,15 €',
      breakEven:        '11 Jahre',
      totalBenefit:     '23.904,80 €',
      loanAmount:       '15.000,00 €',
      interestRate:     '4,0 %',
      loanYears:        '10 Jahre',
      monthlyRate:      '151,87 €',
      totalInterest:    '3.224,12 €',
      totalRepayment:   '18.224,12 €',
      ratePlusNewCost:  '135,54 €',
      monthlyDifference:'+ 23,27 €',
    };
    nested = {
      meta:     { createdAt: flat.createdAt },
      customer: { name: flat.customerName, address: flat.customerAddress, project: flat.projectAddress },
      system: {
        consumption: flat.annualConsumption, electricityPrice: flat.electricityPrice,
        priceIncrease: flat.priceIncrease, modules: flat.modules, power: flat.systemSize,
        sunHours: flat.sunHours, production: flat.annualProduction, selfUseRate: flat.selfUseRate,
        feedInTariff: flat.feedInTariff, investment: flat.investment,
      },
      results: {
        oldMonthly: flat.oldMonthlyAvg, newMonthly: flat.newMonthly, netMonthly: flat.netMonthlyAvg,
        ownUseKwh: flat.selfConsumption, feedInKwh: flat.feedIn,
        costWithoutPv: flat.costWithoutPv20y, costWithPv: flat.costWithPv20y,
        breakEven: flat.breakEven, totalBenefit: flat.totalBenefit,
      },
      financing: { equity: flat.equity },
      savingsRows: [
        { kwh: '3.000', rate: '0,320', monthly: '80,00 €', year1: '960,00 €', years20: '28.586,96 €' },
        { kwh: '6.614', rate: '0,078', monthly: '42,99 €', year1: '515,89 €', years20: '10.317,84 €' },
        { kwh: '–', rate: '–', monthly: '122,99 €', year1: '1.475,89 €', years20: '38.904,80 €' },
      ],
    };
    tableRows20 = null; /* leave HTML demo values as-is */
  }

  /* ══════════════════════════════════════════════════════════════════════════
     BINDING PASS 1 — data-field (flat)
  ══════════════════════════════════════════════════════════════════════════ */
  document.querySelectorAll('[data-field]').forEach(function (el) {
    var v = flat[el.dataset.field];
    if (v !== undefined) el.textContent = v;
  });

  /* ══════════════════════════════════════════════════════════════════════════
     BINDING PASS 2 — data-bind (nested dot/bracket path)
  ══════════════════════════════════════════════════════════════════════════ */
  function resolve(obj, path) {
    return path.replace(/\[(\d+)\]/g, '.$1').split('.').reduce(
      function (o, k) { return o != null ? o[k] : undefined; }, obj
    );
  }
  document.querySelectorAll('[data-bind]').forEach(function (el) {
    var v = resolve(nested, el.dataset.bind);
    if (v !== undefined && v !== null) el.textContent = String(v);
  });

  /* ══════════════════════════════════════════════════════════════════════════
     BINDING PASS 3 — page 2 savings table (cells have no data-bind)
  ══════════════════════════════════════════════════════════════════════════ */
  var savTbody = document.querySelector('.page-2 .table-wrap table tbody');
  if (savTbody) {
    var trs = savTbody.querySelectorAll('tr');
    nested.savingsRows.forEach(function (row, i) {
      if (!trs[i]) return;
      var tds = trs[i].querySelectorAll('td');
      if (tds[1]) tds[1].textContent = row.kwh;
      if (tds[2]) tds[2].textContent = row.rate;
      if (tds[3]) tds[3].textContent = row.monthly;
      if (tds[4]) tds[4].textContent = row.year1;
      if (tds[5]) tds[5].textContent = row.years20;
    });

    if (C) {
      var th20 = savTbody.closest('table').querySelector('thead th:last-child');
      if (th20) th20.textContent = C.ps > 0 ? '20 J. *' : '20 Jahre';
      var note = document.querySelector('.page-2 .note');
      if (note) {
        if (C.ps > 0) {
          note.innerHTML = '* 20-Jahres-Summe für Eigenverbrauch inkl. '
            + (C.ps * 100).toFixed(1)
            + ' % Strompreissteigerung p.a.<br>Einspeisung konstant.';
        } else {
          note.textContent = '20-Jahres-Gesamtwert ohne Strompreissteigerung.';
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     BINDING PASS 4 — page 4 year table (fully dynamic with live data)
  ══════════════════════════════════════════════════════════════════════════ */
  if (tableRows20) {
    var tbody4 = document.querySelector('.page-4 .year-table tbody');
    if (tbody4) {
      var tr4s = tbody4.querySelectorAll('tr');
      tableRows20.forEach(function (row, i) {
        var tr = tr4s[i];
        if (!tr) return;

        tr.className = '';
        if (row.isBreakEven)       tr.classList.add('break');
        else if (row.isLoan)       tr.classList.add('neg');
        else if (row.kumVal >= 0)  tr.classList.add('pos');
        else                       tr.classList.add('mixed');

        /* Gesamtstand nach Vorzeichen einfärben: rot bis Break-even, grün danach.
           Break-even-Zeile behält ihr durchgehendes Grün aus dem CSS. */
        if (!row.isBreakEven) {
          var GREEN = '#078743', RED = '#ef2d20';
          var balCell = tr.querySelector('.balance');
          if (balCell) balCell.style.color = row.kumVal >= 0 ? GREEN : RED;
        }

        var yearTd = tr.querySelector('.year') || tr.querySelector('td:first-child');
        if (yearTd) yearTd.textContent = row.isBreakEven ? row.year + ' ✓ Break-even' : String(row.year);

        var spans = tr.querySelectorAll('[data-bind]');
        if (spans.length > 0) {
          spans.forEach(function (sp) {
            var key = sp.dataset.bind.split('.').pop();
            if (row[key] !== undefined) sp.textContent = row[key];
          });
        } else {
          var tds4 = tr.querySelectorAll('td');
          var vals = [row.selfUse, row.feedIn, row.totalSavings, row.loanRate, row.cashFlow, row.balance];
          vals.forEach(function (v, j) { if (tds4[j + 1]) tds4[j + 1].textContent = v; });
        }
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     AUTO-PRINT when ?print=1
  ══════════════════════════════════════════════════════════════════════════ */
  if (new URLSearchParams(window.location.search).get('print') === '1') {
    window.addEventListener('load', function () {
      setTimeout(function () {
        window.print();
        window.addEventListener('afterprint', function () { window.history.back(); });
      }, 1200);
    });
  }

})();
