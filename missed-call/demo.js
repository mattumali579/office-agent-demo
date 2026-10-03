(function () {
  const engine = window.MctbEngine;
  const params = new URLSearchParams(window.location.search);

  function cleanParam(name, max) {
    const raw = params.get(name);
    if (raw == null) return '';
    return raw.replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  const TRADE_SCRIPTS = {
    plumber: { need: 'Water heater is leaking', job: 'water heater replacement', amount: '2400' },
    plumbing: { need: 'Water heater is leaking', job: 'water heater replacement', amount: '2400' },
    hvac: { need: 'Furnace will not start', job: 'furnace replacement', amount: '4500' },
    heating: { need: 'Furnace will not start', job: 'furnace replacement', amount: '4500' },
    air: { need: 'Furnace will not start', job: 'furnace replacement', amount: '4500' },
    electrician: { need: 'Half the house has no power', job: 'electrical repair', amount: '1800' },
    electrical: { need: 'Half the house has no power', job: 'electrical repair', amount: '1800' },
    roofer: { need: 'Water is coming through the ceiling', job: 'roof leak repair', amount: '3200' },
    roofing: { need: 'Water is coming through the ceiling', job: 'roof leak repair', amount: '3200' },
  };

  const TRADE_INFO = {
    plumber: { plural: 'plumbers', scene: 'You were on a job.', cost: 129, costName: 'plumbing' },
    plumbing: { plural: 'plumbers', scene: 'You were on a job.', cost: 129, costName: 'plumbing' },
    hvac: { plural: 'heating and air shops', scene: 'You were on a job.', cost: 128, costName: 'A/C' },
    heating: { plural: 'heating and air shops', scene: 'You were on a job.', cost: 128, costName: 'A/C' },
    air: { plural: 'heating and air shops', scene: 'You were on a job.', cost: 128, costName: 'A/C' },
    electrician: { plural: 'electricians', scene: 'You were on a job.', cost: null, costName: '' },
    electrical: { plural: 'electricians', scene: 'You were on a job.', cost: null, costName: '' },
    roofer: { plural: 'roofers', scene: 'You were on the roof.', cost: 228, costName: 'roofing' },
    roofing: { plural: 'roofers', scene: 'You were on the roof.', cost: 228, costName: 'roofing' },
  };

  const DEFAULT_BUSINESS = 'Northline Heating & Air';
  const DEFAULT_SCRIPT = TRADE_SCRIPTS.hvac;
  const biz = cleanParam('biz', 80);
  const tradeKey = cleanParam('trade', 40).toLowerCase().replace(/[^a-z0-9 _-]/g, '').replace(/[\s_]+/g, ' ').trim();

  function inferTrade(name) {
    const text = name.toLowerCase();
    if (/\bplumb/.test(text)) return 'plumber';
    if (/\b(hvac|heating|furnace|air)\b/.test(text)) return 'hvac';
    if (/\broof/.test(text)) return 'roofing';
    if (/\belectric/.test(text)) return 'electrician';
    return '';
  }

  function scriptFor(trade) {
    if (!trade) return DEFAULT_SCRIPT;
    if (TRADE_SCRIPTS[trade]) return TRADE_SCRIPTS[trade];
    const label = trade.replace(/[-]+/g, ' ');
    return { need: 'Need a ' + label + ' to come out', job: label + ' job', amount: '1500' };
  }

  const city = cleanParam('city', 60);
  const businessName = biz || DEFAULT_BUSINESS;
  const displayTrade = tradeKey || inferTrade(biz) || (biz ? '' : 'hvac');
  const script = scriptFor(tradeKey || inferTrade(biz));
  const amountCents = Number(script.amount) * 100;
  const samplePlace = city || 'Downtown';
  const customerName = 'Pat Keller';
  const shortName = businessName.split(' ')[0] || 'Shop';

  const tenantOverrides = {};
  if (biz) {
    tenantOverrides.business_name = businessName;
    tenantOverrides.slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'shop';
    tenantOverrides.booking_link = 'https://book.example';
  }
  const tenant = engine.exampleTenant(tenantOverrides);

  const caller = '+15555550123';
  const daytime = '2026-10-03T15:00:00.000Z';
  let state = engine.freshState();
  let started = false;

  const callScreen = document.getElementById('call-screen');
  const callStatus = document.getElementById('call-status');
  const thread = document.getElementById('thread');
  const composer = document.getElementById('composer');
  const draft = document.getElementById('draft');
  const chips = document.getElementById('chips');
  const ownerFeed = document.getElementById('owner-feed');
  const followups = document.getElementById('followups');
  const followupList = document.getElementById('followup-list');
  const stats = document.getElementById('stats');

  function dollarsLabel(cents) {
    return engine.formatMoney(cents).replace(/\.00$/, '');
  }

  function infoFor(key) {
    if (TRADE_INFO[key]) return TRADE_INFO[key];
    if (!key) return { plural: 'shops in one trade', scene: 'You were on a job.', cost: null, costName: '' };
    const label = key.replace(/[-]+/g, ' ');
    return {
      plural: /s$/i.test(label) ? label : label + 's',
      scene: 'You were on a job.',
      cost: null,
      costName: '',
    };
  }

  function scarcityLine(info, known) {
    const who = known ? info.plural : 'shops per trade';
    return "I set up 3 " + who + " per area, so you're not competing with the shop down the road.";
  }

  function buildMailto(mailBiz) {
    const subject = 'YES - Missed-Call Rescue for ' + mailBiz;
    const lines = [
      'Hi Matt,',
      '',
      'Yes. I want Missed-Call Rescue for ' + mailBiz + '.',
      '',
    ];
    const tradeLine = tradeKey || inferTrade(biz);
    if (tradeLine) lines.push('Trade: ' + tradeLine);
    if (city) lines.push('City: ' + city);
    if (tradeLine || city) lines.push('');
    lines.push('Best number to reach me:', '', 'Thanks');
    return 'mailto:matt@fitnesshubb.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
  }

  function paintLeak() {
    const input = document.getElementById('missed-count');
    const out = document.getElementById('leak-result');
    if (!input || !out) return;
    let count = parseInt(input.value, 10);
    if (!isFinite(count) || count < 0) count = 0;
    if (count > 500) count = 500;
    const info = infoFor(displayTrade);
    if (!info.cost) {
      out.textContent = count + ' missed call' + (count === 1 ? '' : 's') + ' last week. Published lead costs I use are plumbing about $129, A/C about $128, and roofing about $228 (LocaliQ 2025). I will not invent a figure for this trade.';
      return;
    }
    const total = count * info.cost;
    const dollars = '$' + String(total).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    out.textContent = count + ' missed call' + (count === 1 ? '' : 's') + ' × about $' + info.cost + ' (' + info.costName + ') = ' + dollars + ' in leads you already paid for.';
  }

  function applyNames() {
    const info = infoFor(displayTrade);
    const knownTrade = Boolean(displayTrade);
    const headlineWho = biz ? businessName : 'Your shop';
    const mailBiz = biz || 'my shop';
    document.getElementById('call-name').textContent = businessName;
    document.getElementById('ticket-name').textContent = businessName;
    document.getElementById('headline').textContent = headlineWho + ': 30-day Missed-Call Rescue for ' + info.plural + '. 5 missed callers brought back, or you pay nothing.';
    document.getElementById('lede').textContent = info.scene + ' Your caller still got an answer. Every missed call gets a text from ' + businessName + ' within seconds. It asks what they need, and the lead lands on your phone. Quiet estimates get three follow-ups.';
    document.getElementById('step-1-copy').textContent = "When you don't pick up, the caller gets a text from " + businessName + ' within seconds. It asks what they need, their ZIP, and how soon.';
    document.getElementById('lock-place').textContent = city ? 'On a job · ' + city : 'On a job';
    document.getElementById('slots-line').textContent = knownTrade ? '3 ' + info.plural + ' per area' : '3 shops per trade per area';
    document.getElementById('try-line').textContent = biz
      ? 'Try it as ' + businessName + '. Miss the call, then answer the three questions.'
      : 'Try it. Miss the call, then answer the three questions.';
    document.querySelectorAll('.scarcity').forEach(function (node) {
      node.textContent = scarcityLine(info, knownTrade);
    });
    const sample = document.getElementById('sample-note');
    if (biz) sample.classList.add('hidden');
    else sample.classList.remove('hidden');
    document.title = (biz ? businessName + ' · ' : '') + "Missed-Call Rescue: 5 Leads or It's Free · BrightReach Media";
    document.getElementById('page-foot').textContent = biz
      ? 'This is a simulation. Nothing is sent and nothing is charged. ' + businessName + ' is filled in from this link.'
      : 'This is a simulation. Nothing is sent and nothing is charged. ' + businessName + ' is not a real company.';
    document.getElementById('ticket-foot').textContent = biz
      ? 'Sample for this link. This page sends nothing.'
      : 'Fictional shop. This page sends nothing.';
    const href = buildMailto(mailBiz);
    document.querySelectorAll('[data-cta]').forEach(function (link) {
      link.href = href;
    });
    document.querySelectorAll('[data-cta-label]').forEach(function (link) {
      link.textContent = 'Yes - Missed-Call Rescue for ' + mailBiz;
    });
    paintLeak();
  }

  function showThread() {
    callScreen.classList.add('hidden');
    thread.classList.remove('hidden');
    composer.classList.remove('hidden');
  }

  function addBubble(who, text) {
    const node = document.createElement('div');
    node.className = 'bubble ' + who;
    node.textContent = text;
    thread.appendChild(node);
    thread.scrollTop = thread.scrollHeight;
  }

  function addOwner(text) {
    if (ownerFeed.querySelector('.empty-note')) ownerFeed.textContent = '';
    const node = document.createElement('div');
    node.className = 'note';
    const label = document.createElement('strong');
    label.textContent = shortName;
    node.appendChild(label);
    node.appendChild(document.createTextNode(text));
    ownerFeed.appendChild(node);
  }

  function paintTicket() {
    const conversation = state.conversation || {};
    document.getElementById('t-phone').textContent = started ? caller : '—';
    document.getElementById('t-need').textContent = conversation.need || '—';
    document.getElementById('t-place').textContent = conversation.location || '—';
    document.getElementById('t-urgency').textContent = conversation.urgency || '—';
    const open = state.estimates.filter(function (estimate) { return estimate.status === 'open' || estimate.status === 'won'; });
    const latest = open[open.length - 1] || state.estimates[state.estimates.length - 1];
    document.getElementById('t-estimate').textContent = latest
      ? latest.customer_name + ' · ' + latest.job + ' · ' + engine.formatMoney(latest.amount_cents) + ' · ' + latest.status
      : 'Not logged';
  }

  function paintStats() {
    const missed = state.calls.filter(function (call) { return call.missed; }).length;
    const recovered = state.messages.some(function (message) { return message.direction === 'in' && message.from === caller; }) ? Math.min(missed, 1) : 0;
    const won = state.estimates.filter(function (estimate) { return estimate.status === 'won'; })
      .reduce(function (sum, estimate) { return sum + estimate.amount_cents; }, 0);
    const rows = [
      [String(missed), 'Missed calls'],
      [String(recovered), 'Callers who replied'],
      [engine.formatMoney(won), 'Marked won'],
    ];
    stats.textContent = '';
    rows.forEach(function (row) {
      const card = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = row[0];
      const span = document.createElement('span');
      span.textContent = row[1];
      card.appendChild(strong);
      card.appendChild(span);
      stats.appendChild(card);
    });
  }

  function chip(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    chips.appendChild(button);
  }

  function paintChips() {
    chips.textContent = '';
    if (!started) return;
    const conversation = state.conversation;
    if (state.suppressed) {
      chip('START', function () { incoming('START'); });
      return;
    }
    if (!conversation || conversation.state === 'awaiting_need') {
      chip(script.need, function () { incoming(script.need); });
    } else if (conversation.state === 'awaiting_location') {
      chip(samplePlace, function () { incoming(samplePlace); });
    } else if (conversation.state === 'awaiting_urgency') {
      chip('Today', function () { incoming('today please'); });
    } else if (conversation.state === 'handed_off') {
      chip('Log the ' + dollarsLabel(amountCents) + ' estimate', logEstimate);
      chip('STOP', function () { incoming('STOP'); });
    }
  }

  function apply(decision) {
    (decision.record && decision.record.outbound || []).forEach(function (item) {
      if (item.delivery !== 'twiml' && item.delivery !== 'mock') return;
      if (item.to === caller) addBubble('them', item.body);
    });
    if (decision.record && decision.record.owner_notification) addOwner(decision.record.owner_notification.body);
    state = engine.project(state, decision.record);
    paintTicket();
    paintStats();
    paintChips();
  }

  function incoming(text) {
    addBubble('me', text);
    const decision = engine.handleInboundSms(engine.smsContext(state, tenant, {
      now: daytime,
      from: caller,
      to: tenant.twilio_number,
      body: text,
    }));
    apply(decision);
  }

  function missCall() {
    if (started) return;
    started = true;
    callStatus.textContent = 'Calling…';
    document.getElementById('miss-call').disabled = true;
    window.setTimeout(function () {
      callStatus.textContent = 'No answer';
      window.setTimeout(function () {
        const decision = engine.handleVoice(engine.voiceContext(state, tenant, {
          now: daytime,
          from: caller,
          to: tenant.twilio_number,
          callSid: 'CA-DEMO',
          publicBaseUrl: 'https://text.example',
        }));
        showThread();
        apply(decision);
      }, 700);
    }, 700);
  }

  function logEstimate() {
    const decision = engine.handleAction({
      now: daytime,
      token: 'demo',
      action: 'estimate',
      customer_name: customerName,
      phone: caller,
      job: script.job,
      amount: script.amount,
      tenant: tenant,
      estimates: state.estimates,
      sentToday: state.sentToday,
    }, { TWILIO_MODE: 'mock' });
    state = engine.project(state, decision.record);
    const sequence = engine.previewFollowupSequence(tenant, {
      customer_name: customerName,
      phone: caller,
      job: script.job,
      amount_cents: amountCents,
    }, daytime);
    followupList.textContent = '';
    sequence.forEach(function (step) {
      const item = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = step.label + ' · ' + step.when;
      item.appendChild(label);
      item.appendChild(document.createTextNode(step.body));
      followupList.appendChild(item);
    });
    followups.classList.remove('hidden');
    addOwner('Estimate logged for ' + customerName + ', ' + script.job + ', ' + engine.formatMoney(amountCents) + '.');
    paintTicket();
    paintStats();
    paintChips();
  }

  document.getElementById('missed-count').addEventListener('input', paintLeak);
  document.getElementById('miss-call').addEventListener('click', missCall);
  composer.addEventListener('submit', function (event) {
    event.preventDefault();
    const text = draft.value.trim();
    if (!text || !started) return;
    draft.value = '';
    incoming(text);
  });
  applyNames();
  paintStats();
})();
