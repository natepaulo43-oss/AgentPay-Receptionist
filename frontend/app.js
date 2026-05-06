const STATUSES = [
  'REQUEST_RECEIVED',
  'PAYMENT_REQUIRED_402',
  'PAYMENT_SIGNATURE_RECEIVED',
  'PAYMENT_VERIFIED',
  'ACTION_COMPLETED',
  'LEAD_CREATED',
];

const demoPayload = {
  sessionId: 'agent-session-consensus-miami',
  customerName: 'Ava Chen',
  customerPhone: '(305) 555-0142',
  vehicle: 'black Tesla Model Y',
  service: 'Same-day ceramic detail',
  request: 'Hold a same-day ceramic detail appointment at 4:30 PM.',
  appointmentTime: '2026-05-05T16:30:00-04:00',
  transcriptSnippet: 'Autonomous agent requested a same-day ceramic detail and accepted the $5 x402 priority hold.',
};

const AGENT_BUYER_COMMAND = 'X402_BUYER_PRIVATE_KEY=0x... AGENTPAY_BASE_URL=http://127.0.0.1:8787 npm run agent:pay';

const state = {
  route: '/',
  chatMessages: [
    {
      role: 'assistant',
      text: 'Hi, I am the AI front desk for Miami Elite Auto Detail. I can answer questions free and help hold paid priority slots.',
    },
  ],
  pendingPaidAction: null,
  lastChatDecision: null,
  timeline: [],
  requestJson: null,
  responseJson: null,
  lastHttpStatus: null,
  buyerNotice: null,
  profile: null,
  leads: [],
  payments: [],
  events: [],
  busy: false,
};

const app = document.querySelector('#app');

function routeFromHash() {
  const hash = window.location.hash.replace(/^#/, '');
  return hash || '/';
}

function setBusy(value) {
  state.busy = value;
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function pretty(value) {
  if (value === null || value === undefined) return 'No request yet.';
  return JSON.stringify(value, null, 2);
}

function activeStatusSet() {
  return new Set(state.timeline);
}

function timelineMarkup() {
  const active = activeStatusSet();
  return `
    <div class="timeline">
      ${STATUSES.map((status) => `
        <div class="timeline-row ${active.has(status) ? 'active' : ''}">
          <div class="dot" aria-hidden="true"></div>
          <div>
            <strong>${status}</strong>
            <span>${timelineCopy(status)}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function timelineCopy(status) {
  const copy = {
    REQUEST_RECEIVED: 'The business-action request reaches the API path.',
    PAYMENT_REQUIRED_402: 'AWS edge gate returns HTTP 402 with x402 requirements.',
    PAYMENT_SIGNATURE_RECEIVED: 'The paying client retries with an x402 payment header.',
    PAYMENT_VERIFIED: 'Lambda@Edge verifies the payment through the facilitator.',
    ACTION_COMPLETED: 'The origin API reserves the 4:30 PM appointment hold.',
    LEAD_CREATED: 'A paid lead and payment event appear in the dashboard.',
  };
  return copy[status] || '';
}

async function api(path, options = {}) {
  const headers = {
    'content-type': 'application/json',
    ...(options.headers || {}),
  };
  const response = await fetch(path, { ...options, headers });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { status: response.status, ok: response.ok, body };
}

function requestPanelTitle() {
  if (!state.lastHttpStatus) return 'Request';
  return state.lastHttpStatus === 402 ? 'Request that triggered 402' : 'Confirmed request';
}

function responsePanelTitle() {
  if (!state.lastHttpStatus) return 'Response';
  return `HTTP ${state.lastHttpStatus} Response`;
}

function technicalPanels() {
  return `
    <div class="code-grid">
      <div class="code-card">
        <div class="code-title">
          <span>${requestPanelTitle()}</span>
          <span>${state.requestJson?.method || ''} ${state.requestJson?.path || ''}</span>
        </div>
        <pre>${escapeHtml(pretty(state.requestJson))}</pre>
      </div>
      <div class="code-card">
        <div class="code-title">
          <span>${responsePanelTitle()}</span>
          <span>${state.responseJson?.protocol || state.responseJson?.paymentStatus || ''}</span>
        </div>
        <pre>${escapeHtml(pretty(state.responseJson))}</pre>
      </div>
    </div>
  `;
}

function show402Moment() {
  return state.lastHttpStatus === 402
    ? '<div class="http-402">HTTP 402 Payment Required. $5 USDC required. Network: Base Sepolia. Protocol: x402.</div>'
    : '';
}

function showSuccessMoment() {
  return state.lastHttpStatus === 200 && state.responseJson?.success
    ? '<div class="success-callout">Payment verified. The 4:30 PM priority hold is booked and the paid lead is in the dashboard.</div>'
    : '';
}

function showBuyerNotice() {
  return state.buyerNotice
    ? `<div class="notice">${escapeHtml(state.buyerNotice)}</div>`
    : '';
}

function setTimelineFromResponse(result) {
  if (Array.isArray(result?.timeline)) {
    state.timeline = result.timeline.map((event) => event.status).filter(Boolean);
  } else {
    state.timeline = [...STATUSES];
  }
}

async function discoverProfile() {
  setBusy(true);
  try {
    const result = await api('/api/agent/business-profile');
    state.profile = result.body;
    state.requestJson = {
      actor: 'autonomous_agent',
      method: 'GET',
      path: '/api/agent/business-profile',
      headers: { accept: 'application/json' },
    };
    state.responseJson = result.body;
    state.lastHttpStatus = result.status;
  } catch (error) {
    state.responseJson = { error: String(error) };
  } finally {
    setBusy(false);
  }
}

async function attemptHoldSlot(withPayment) {
  setBusy(true);
  state.buyerNotice = null;
  const requestBase = {
    actor: 'autonomous_agent',
    method: 'POST',
    path: '/api/paid/hold-slot',
    body: demoPayload,
  };

  try {
    state.requestJson = {
      ...requestBase,
      headers: { 'content-type': 'application/json' },
    };
    const unpaidResult = await api('/api/paid/hold-slot', {
      method: 'POST',
      body: JSON.stringify(demoPayload),
    });
    state.lastHttpStatus = unpaidResult.status;
    state.responseJson = unpaidResult.body;
    if (unpaidResult.status === 402) {
      state.timeline = ['REQUEST_RECEIVED', 'PAYMENT_REQUIRED_402'];
    }

    if (!withPayment || unpaidResult.status !== 402) {
      return;
    }

    render();
    const paymentSignature = await createBrowserX402PaymentHeader(unpaidResult.body);
    state.requestJson = {
      ...requestBase,
      headers: {
        'content-type': 'application/json',
        'PAYMENT-SIGNATURE': '<browser-signed x402 payment payload>',
      },
    };
    const paidResult = await api('/api/paid/hold-slot', {
      method: 'POST',
      headers: { 'PAYMENT-SIGNATURE': paymentSignature },
      body: JSON.stringify(demoPayload),
    });
    state.lastHttpStatus = paidResult.status;
    state.responseJson = paidResult.body;
    if (paidResult.ok) {
      setTimelineFromResponse(paidResult.body);
      await loadDashboard(false);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.buyerNotice = `${message} Agent CLI buyer: ${AGENT_BUYER_COMMAND}`;
    state.responseJson = {
      error: message,
      agentBuyerCommand: AGENT_BUYER_COMMAND,
    };
  } finally {
    setBusy(false);
  }
}

async function createBrowserX402PaymentHeader(paymentRequired) {
  if (!paymentRequired || paymentRequired.x402Version !== 2 || !paymentRequired.accepts?.length) {
    throw new Error('The 402 response did not include v2 x402 payment requirements.');
  }
  if (!window.ethereum?.request) {
    throw new Error('Browser x402 payment needs an injected wallet. Connect a Base Sepolia wallet or run the agent buyer script.');
  }

  const accepted = paymentRequired.accepts[0];
  const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' });
  if (!account) throw new Error('No wallet account selected.');

  await ensureWalletNetwork(accepted.network);
  const authorization = createTransferAuthorization(account, accepted);
  const signature = await window.ethereum.request({
    method: 'eth_signTypedData_v4',
    params: [
      account,
      JSON.stringify({
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          TransferWithAuthorization: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' },
          ],
        },
        primaryType: 'TransferWithAuthorization',
        domain: {
          name: accepted.extra?.name || 'USDC',
          version: accepted.extra?.version || '2',
          chainId: chainIdFromNetwork(accepted.network),
          verifyingContract: accepted.asset,
        },
        message: authorization,
      }),
    ],
  });

  return encodeX402PaymentHeader({
    x402Version: 2,
    resource: paymentRequired.resource,
    accepted,
    payload: {
      authorization,
      signature,
    },
  });
}

function createTransferAuthorization(account, accepted) {
  const now = Math.floor(Date.now() / 1000);
  return {
    from: account,
    to: accepted.payTo,
    value: accepted.amount,
    validAfter: String(now - 600),
    validBefore: String(now + accepted.maxTimeoutSeconds),
    nonce: randomHex32(),
  };
}

async function ensureWalletNetwork(network) {
  const chainId = chainIdFromNetwork(network);
  const hexChainId = `0x${chainId.toString(16)}`;
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexChainId }] });
  } catch (error) {
    if (error && (error.code === 4902 || error.data?.originalError?.code === 4902) && chainId === 84532) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: hexChainId,
          chainName: 'Base Sepolia',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://sepolia.base.org'],
          blockExplorerUrls: ['https://sepolia.basescan.org'],
        }],
      });
      return;
    }
    throw error;
  }
}

function chainIdFromNetwork(network) {
  const chainId = Number(String(network).split(':')[1]);
  if (!Number.isFinite(chainId)) throw new Error(`Unsupported x402 network: ${network}`);
  return chainId;
}

function randomHex32() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function encodeX402PaymentHeader(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function sendChatMessage(message) {
  const clean = message.trim();
  if (!clean) return;
  state.chatMessages.push({ role: 'user', text: clean });
  setBusy(true);
  try {
    const result = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: clean, conversationHistory: state.chatMessages }),
    });
    if (result.ok) {
      state.chatMessages.push({ role: 'assistant', text: result.body.reply });
      state.pendingPaidAction = result.body.requiresPayment ? result.body.paidAction : null;
      state.lastChatDecision = {
        intent: result.body.intent,
        actionBoundary: result.body.actionBoundary,
        requiresPayment: result.body.requiresPayment,
        confidence: result.body.confidence,
        suggestedNextStep: result.body.suggestedNextStep,
        leadFields: result.body.leadFields,
      };
    } else {
      state.chatMessages.push({ role: 'assistant', text: result.body.error || 'The receptionist API returned an error.' });
    }
  } catch (error) {
    state.chatMessages.push({ role: 'assistant', text: `Network error: ${String(error)}` });
  } finally {
    setBusy(false);
  }
}

async function loadDashboard(shouldRender = true) {
  try {
    const [leadsResult, paymentsResult] = await Promise.all([
      api('/api/dashboard/leads'),
      api('/api/dashboard/payments'),
    ]);
    state.leads = leadsResult.body?.leads || [];
    state.payments = paymentsResult.body?.payments || [];
    state.events = paymentsResult.body?.events || [];
  } catch {
    state.leads = [];
    state.payments = [];
    state.events = [];
  }
  if (shouldRender) render();
}

async function resetDashboard() {
  setBusy(true);
  try {
    const result = await api('/api/dashboard/reset', { method: 'POST' });
    state.leads = [];
    state.payments = [];
    state.events = [];
    state.timeline = [];
    state.lastHttpStatus = result.status;
    state.requestJson = {
      actor: 'business_operator',
      method: 'POST',
      path: '/api/dashboard/reset',
      headers: { 'content-type': 'application/json' },
    };
    state.responseJson = result.body;
  } catch (error) {
    state.responseJson = { error: String(error) };
  } finally {
    setBusy(false);
  }
}

function chatDecisionMarkup() {
  if (!state.lastChatDecision) {
    return '<div class="empty">Structured receptionist decisions will appear after the next message.</div>';
  }
  return `
    <div class="code-card compact-code">
      <div class="code-title">
        <span>Receptionist decision JSON</span>
        <span>${escapeHtml(state.lastChatDecision.actionBoundary || '')}</span>
      </div>
      <pre>${escapeHtml(pretty(state.lastChatDecision))}</pre>
    </div>
  `;
}

function landingPage() {
  return `
    <section class="hero">
      <div class="hero-inner">
        <p class="eyebrow">EasyA Consensus Miami 2026 · Agentic Track</p>
        <h1>AgentPay Receptionist</h1>
        <p class="hero-copy">The AI receptionist that agents can pay. Miami Elite Auto Detail becomes a machine-readable, payment-enabled endpoint where humans and autonomous agents can ask free questions and pay USDC over HTTP for real business actions.</p>
        <div class="hero-actions">
          <a class="primary" href="#/simulator">Open Agent API Simulator</a>
          <a class="secondary" href="#/chat">Try Customer Chat</a>
        </div>
      </div>
    </section>
    <section class="page">
      <div class="grid three">
        <div class="card">
          <div class="metric">402</div>
          <h3>Paid HTTP actions</h3>
          <p>Free endpoints handle discovery and conversation. Premium endpoints under <strong>/api/paid/**</strong> require x402 payment before capacity is reserved.</p>
        </div>
        <div class="card">
          <div class="metric">$5</div>
          <h3>Priority slot deposit</h3>
          <p>The judged flow gates <strong>POST /api/paid/hold-slot</strong> with a fixed-price Base Sepolia USDC payment.</p>
        </div>
        <div class="card">
          <div class="metric">AWS</div>
          <h3>Visible production layer</h3>
          <p>CloudFront, WAF Bot Control, Lambda@Edge, API Gateway, Lambda, DynamoDB, SSM, Secrets Manager, and CloudWatch are wired into the architecture.</p>
        </div>
      </div>
      <div class="section-title" style="margin-top: 34px;">
        <div>
          <h2>Business-action monetization</h2>
          <p>Instead of monetizing articles, AgentPay monetizes useful local-business actions that autonomous agents can discover and transact with.</p>
        </div>
      </div>
      <div class="architecture">
        <div class="node"><strong>React-style static UI</strong><span>Four-page demo served through CloudFront.</span></div>
        <div class="node"><strong>CloudFront + WAF</strong><span>Routes /api/paid/** through the x402 edge gate.</span></div>
        <div class="node"><strong>Lambda@Edge</strong><span>Verifies and settles exact USDC payments.</span></div>
        <div class="node"><strong>Origin API</strong><span>Receptionist logic and paid action handlers.</span></div>
        <div class="node"><strong>DynamoDB</strong><span>Leads, paid actions, and event timeline.</span></div>
      </div>
      <div class="card" style="margin-top: 16px;">
        <h3>Final pitch</h3>
        <p>In the old internet, businesses needed websites. In the agentic internet, businesses need payable endpoints. AgentPay Receptionist gives every local business an AI front desk that humans and autonomous agents can pay over HTTP using x402.</p>
      </div>
    </section>
  `;
}

function chatPage() {
  return `
    <section class="page">
      <div class="page-title">
        <h1>Customer Chat Demo</h1>
        <p>A human asks the AI receptionist about a same-day ceramic detail. Normal questions stay free. Holding the 4:30 PM slot triggers the paid x402 action.</p>
      </div>
      <div class="chat-layout">
        <div class="panel chat-shell">
          <div class="panel-header">
            <h2>Miami Elite Auto Detail</h2>
            <span class="chip green">Free chat</span>
          </div>
          <div class="chat-stream" id="chatStream">
            ${state.chatMessages.map((message) => `
              <div class="message ${message.role}">
                ${escapeHtml(message.text)}
              </div>
            `).join('')}
          </div>
          <form class="composer" id="chatForm">
            <input id="chatInput" autocomplete="off" placeholder="Ask about a same-day ceramic detail">
            <button class="primary" type="submit" ${state.busy ? 'disabled' : ''}>Send</button>
          </form>
          <div class="quick-prompts">
            <button class="ghost" type="button" data-chat-prompt="I need a same-day ceramic detail appointment in Miami.">Same-day request</button>
            <button class="ghost" type="button" data-chat-prompt="It is a black Tesla Model Y. Please hold the 4:30 slot.">Hold 4:30 PM</button>
          </div>
        </div>
        <div class="stack">
          <div class="panel">
            <div class="panel-header">
              <h3>Paid action trigger</h3>
              ${state.pendingPaidAction ? '<span class="chip amber">Payment required</span>' : '<span class="chip blue">No charge yet</span>'}
            </div>
            <div class="panel-body stack">
              <p class="small">The receptionist only charges when the customer asks for a value-creating action such as reserving appointment capacity.</p>
              ${chatDecisionMarkup()}
              ${state.pendingPaidAction ? `
                <div class="capability">
                  <strong>${state.pendingPaidAction.endpoint}</strong>
                  <small>${state.pendingPaidAction.price} · ${state.pendingPaidAction.network} · ${state.pendingPaidAction.protocol}</small>
                  <small>${state.pendingPaidAction.reason}</small>
                </div>
                <div class="actions" style="margin-top: 0;">
                  <button class="danger" type="button" data-unpaid-hold ${state.busy ? 'disabled' : ''}>Attempt without payment</button>
                  <button class="primary" type="button" data-paid-hold ${state.busy ? 'disabled' : ''}>Sign x402 payment</button>
                </div>
              ` : '<div class="empty">No paid action selected.</div>'}
              ${show402Moment()}
              ${showSuccessMoment()}
              ${showBuyerNotice()}
            </div>
          </div>
          <div class="panel">
            <div class="panel-header"><h3>x402 timeline</h3></div>
            <div class="panel-body">${timelineMarkup()}</div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function capabilityMarkup(profile) {
  if (!profile) return '<div class="empty">Run discovery to load the machine-readable profile.</div>';
  return `
    <div class="capability-list">
      ${profile.paidCapabilities.map((capability) => `
        <div class="capability">
          <strong>${escapeHtml(capability.action)} · ${escapeHtml(capability.price)}</strong>
          <small>${escapeHtml(capability.method)} ${escapeHtml(capability.endpoint)}</small>
          <small>${escapeHtml(capability.networkName)} · ${escapeHtml(capability.protocol)}</small>
        </div>
      `).join('')}
    </div>
  `;
}

function simulatorPage() {
  return `
    <section class="page">
      <div class="page-title">
        <h1>Agent API Simulator</h1>
        <p>An autonomous agent discovers Miami Elite Auto Detail, reads paid capabilities, attempts a paid action, receives HTTP 402, pays over x402, and receives booking JSON.</p>
      </div>
      <div class="sim-layout">
        <div class="stack">
          <div class="panel api-shell">
            <div class="panel-header">
              <h2>Agent runbook</h2>
              <span class="chip blue">Base Sepolia · x402</span>
            </div>
            <div class="panel-body stack">
              <div class="actions" style="margin-top: 0;">
                <button class="ghost" type="button" data-discover ${state.busy ? 'disabled' : ''}>1. Discover profile</button>
                <button class="danger" type="button" data-unpaid-hold ${state.busy ? 'disabled' : ''}>2. Attempt hold</button>
                <button class="primary" type="button" data-paid-hold ${state.busy ? 'disabled' : ''}>3. Sign x402 and book</button>
              </div>
              ${show402Moment()}
              ${showSuccessMoment()}
              ${showBuyerNotice()}
              <div class="agent-cli">
                <strong>Agent buyer</strong>
                <code>${escapeHtml(AGENT_BUYER_COMMAND)}</code>
              </div>
              ${technicalPanels()}
            </div>
          </div>
        </div>
        <div class="stack">
          <div class="panel">
            <div class="panel-header"><h3>Paid capabilities</h3></div>
            <div class="panel-body">${capabilityMarkup(state.profile)}</div>
          </div>
          <div class="panel">
            <div class="panel-header"><h3>Payment flow timeline</h3></div>
            <div class="panel-body">${timelineMarkup()}</div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function dashboardPage() {
  const leadsRows = state.leads.length
    ? state.leads.map((lead) => `
        <tr>
          <td><strong>${escapeHtml(lead.customerName)}</strong><br><span class="small">${escapeHtml(lead.customerPhone)}</span></td>
          <td>${escapeHtml(lead.service)}<br><span class="small">${escapeHtml(lead.vehicle || '')}</span></td>
          <td>${escapeHtml(lead.appointmentTime)}</td>
          <td><span class="chip green">${escapeHtml(lead.status)}</span></td>
          <td>${escapeHtml(lead.transcriptSnippet)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="5"><div class="empty">No paid leads yet. Run the simulator payment flow.</div></td></tr>';

  const paymentRows = state.payments.length
    ? state.payments.map((payment) => `
        <tr>
          <td><strong>${escapeHtml(payment.actionId)}</strong><br><span class="small">${escapeHtml(payment.type)}</span></td>
          <td>${escapeHtml(payment.amount)} ${escapeHtml(payment.currency)}</td>
          <td>${escapeHtml(payment.network)}</td>
          <td><span class="chip green">${escapeHtml(payment.paymentStatus)}</span></td>
          <td>${escapeHtml(payment.createdAt)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="5"><div class="empty">No payments recorded yet.</div></td></tr>';

  const eventRows = state.events.length
    ? state.events.slice(0, 14).map((event) => `
        <tr>
          <td><span class="chip ${event.status === 'PAYMENT_REQUIRED_402' ? 'red' : 'blue'}">${escapeHtml(event.status)}</span></td>
          <td>${escapeHtml(event.detail)}</td>
          <td>${escapeHtml(event.network)}</td>
          <td>${escapeHtml(event.timestamp)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4"><div class="empty">Payment event logs will appear after a hold attempt.</div></td></tr>';

  return `
    <section class="page">
      <div class="section-title">
        <div>
          <h1>Business Dashboard</h1>
          <p>Paid leads, payment status, transcript snippets, booking details, and x402 event logs for Miami Elite Auto Detail.</p>
        </div>
        <div class="actions compact">
          <button class="secondary" type="button" data-reset-dashboard ${state.busy ? 'disabled' : ''}>Reset demo data</button>
          <button class="secondary" type="button" data-refresh-dashboard ${state.busy ? 'disabled' : ''}>Refresh</button>
        </div>
      </div>
      <div class="grid three">
        <div class="card"><div class="metric">${state.leads.length}</div><h3>Paid leads</h3><p>Booked holds created after verified x402 payment.</p></div>
        <div class="card"><div class="metric">${state.payments.length}</div><h3>Paid actions</h3><p>Action records linked to leads and payment events.</p></div>
        <div class="card"><div class="metric">${state.events.length}</div><h3>x402 events</h3><p>Timeline logs visible to business operators and judges.</p></div>
      </div>
      <div class="stack" style="margin-top: 16px;">
        <div class="panel dashboard-shell">
          <div class="panel-header"><h2>Leads</h2></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Customer</th><th>Service</th><th>Appointment</th><th>Status</th><th>Transcript</th></tr></thead>
              <tbody>${leadsRows}</tbody>
            </table>
          </div>
        </div>
        <div class="grid two">
          <div class="panel dashboard-shell">
            <div class="panel-header"><h2>Payments</h2></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Action</th><th>Amount</th><th>Network</th><th>Status</th><th>Created</th></tr></thead>
                <tbody>${paymentRows}</tbody>
              </table>
            </div>
          </div>
          <div class="panel dashboard-shell">
            <div class="panel-header"><h2>Event logs</h2></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Status</th><th>Detail</th><th>Network</th><th>Time</th></tr></thead>
                <tbody>${eventRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function render() {
  state.route = routeFromHash();
  document.querySelectorAll('.nav a').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('data-route') === state.route);
  });

  if (state.route === '/chat') app.innerHTML = chatPage();
  else if (state.route === '/simulator') app.innerHTML = simulatorPage();
  else if (state.route === '/dashboard') app.innerHTML = dashboardPage();
  else app.innerHTML = landingPage();

  bindEvents();
  if (state.route === '/chat') {
    const stream = document.querySelector('#chatStream');
    if (stream) stream.scrollTop = stream.scrollHeight;
  }
}

function bindEvents() {
  document.querySelectorAll('[data-discover]').forEach((button) => {
    button.addEventListener('click', discoverProfile);
  });
  document.querySelectorAll('[data-unpaid-hold]').forEach((button) => {
    button.addEventListener('click', () => attemptHoldSlot(false));
  });
  document.querySelectorAll('[data-paid-hold]').forEach((button) => {
    button.addEventListener('click', () => attemptHoldSlot(true));
  });
  document.querySelectorAll('[data-refresh-dashboard]').forEach((button) => {
    button.addEventListener('click', () => loadDashboard(true));
  });
  document.querySelectorAll('[data-reset-dashboard]').forEach((button) => {
    button.addEventListener('click', resetDashboard);
  });
  document.querySelectorAll('[data-chat-prompt]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.querySelector('#chatInput');
      if (input) {
        input.value = button.getAttribute('data-chat-prompt');
        input.focus();
      }
    });
  });

  const form = document.querySelector('#chatForm');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = document.querySelector('#chatInput');
      if (!input) return;
      const value = input.value;
      input.value = '';
      await sendChatMessage(value);
    });
  }
}

window.addEventListener('hashchange', async () => {
  state.route = routeFromHash();
  if (state.route === '/dashboard') await loadDashboard(false);
  render();
});

async function boot() {
  state.route = routeFromHash();
  if (state.route === '/dashboard') await loadDashboard(false);
  render();
}

boot();
