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
  transcriptSnippet: 'Autonomous agent requested a same-day ceramic detail and accepted the $0.50 x402 priority hold.',
};

const AGENT_BUYER_COMMAND = `AGENTPAY_BASE_URL=${window.location.origin} npm run agent:pay`;

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
  lastPaymentRequirement: null,
  requestJson: null,
  responseJson: null,
  lastHttpStatus: null,
  buyerNotice: null,
  profile: null,
  leads: [],
  payments: [],
  events: [],
  busy: false,
  simStep: 0,
  simRunning: false,
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
    LEAD_CREATED: 'Booking hold confirmed. Payment receipt and structured booking JSON recorded in the business dashboard.',
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
  const method = state.requestJson?.method || '';
  const methodClass = method === 'GET' ? 'get' : method === 'POST' ? 'post' : '';
  const status = state.lastHttpStatus;
  const statusClass = status === 200 ? 'ok' : status === 402 ? 'err' : '';
  const statusLabel = status ? `HTTP ${status}` : '';

  return `
    <div class="code-grid">
      <div class="code-card">
        <div class="code-title">
          <span class="code-title-left">
            ${method ? `<span class="method-badge ${methodClass}">${escapeHtml(method)}</span>` : ''}
            <span>${requestPanelTitle()}</span>
          </span>
          <span>${escapeHtml(state.requestJson?.path || '')}</span>
        </div>
        <pre>${escapeHtml(pretty(state.requestJson))}</pre>
      </div>
      <div class="code-card">
        <div class="code-title">
          <span class="code-title-left">
            ${statusLabel ? `<span class="method-badge ${statusClass}">${statusLabel}</span>` : ''}
            <span>${responsePanelTitle()}</span>
          </span>
          <span>${escapeHtml(state.responseJson?.protocol || state.responseJson?.paymentStatus || '')}</span>
        </div>
        <pre>${escapeHtml(pretty(state.responseJson))}</pre>
      </div>
    </div>
  `;
}

function show402Moment() {
  return state.lastHttpStatus === 402
    ? '<div class="http-402">HTTP 402 Payment Required. $0.50 USDC required. Network: Base Sepolia. Protocol: x402.</div>'
    : '';
}

function showSuccessMoment() {
  return state.lastHttpStatus === 200 && state.responseJson?.success
    ? '<div class="success-callout">Payment verified. The 4:30 PM booking hold is confirmed — structured booking JSON and payment receipt are recorded in the dashboard.</div>'
    : '';
}

function showBuyerNotice() {
  return state.buyerNotice
    ? `<div class="notice">${escapeHtml(state.buyerNotice)}</div>`
    : '';
}

function latestLead() {
  return state.leads[0] || state.responseJson?.lead || null;
}

function latestPayment() {
  return state.payments[0] || (
    state.responseJson?.paidActionId
      ? {
          actionId: state.responseJson.paidActionId,
          amount: state.responseJson.amountPaid,
          currency: state.responseJson.currency,
          network: state.responseJson.network,
          paymentStatus: state.responseJson.paymentStatus,
        }
      : null
  );
}

function latestPaymentRequirement() {
  return state.lastPaymentRequirement || (state.lastHttpStatus === 402 ? state.responseJson : null);
}

function shortId(value) {
  if (!value) return 'pending';
  const text = String(value);
  return text.length > 22 ? `${text.slice(0, 10)}…${text.slice(-6)}` : text;
}

function compactTime(value) {
  if (!value) return 'pending';
  try {
    return new Date(value).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return value;
  }
}

function proofCard(label, value, detail, variant = 'pending') {
  return `
    <div class="proof-card ${variant}">
      <span class="proof-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(detail)}</p>
    </div>
  `;
}

function proofEvidenceMarkup() {
  const requirement = latestPaymentRequirement();
  const accepted = requirement?.accepts?.[0];
  const payment = latestPayment();
  const lead = latestLead();
  const bookingId = lead?.leadId || state.responseJson?.bookingId;
  const proofJson = {
    discoveredBusiness: state.profile?.name || null,
    last402AmountAtomic: accepted?.amount || null,
    paidActionId: payment?.actionId || state.responseJson?.paidActionId || null,
    latestBookingId: bookingId || null,
    latestLeadCreatedAt: lead?.createdAt || null,
    dashboardLeadCount: state.leads.length,
    dashboardPaymentCount: state.payments.length,
  };

  return `
    <div class="proof-board">
      <div class="proof-header">
        <div>
          <p class="eyebrow">Live proof</p>
          <h3>Evidence that the demo is not hardcoded</h3>
        </div>
        <span class="status-pill ${lead || payment ? 'live' : 'inactive'}">${lead || payment ? 'State changed' : 'Awaiting live action'}</span>
      </div>
      <div class="proof-grid">
        ${proofCard(
          'Free discovery',
          state.profile ? 'HTTP 200' : 'Not run yet',
          state.profile
            ? `${state.profile.name} returned ${state.profile.paidCapabilities?.length || 0} paid capabilities.`
            : 'Run discovery or open the buyer CLI to fetch the machine readable profile.',
          state.profile ? 'ok' : 'pending',
        )}
        ${proofCard(
          'AWS edge gate',
          accepted ? 'HTTP 402' : 'No 402 yet',
          accepted
            ? `CloudFront returned x402 amount ${accepted.amount} atomic USDC for ${accepted.network}.`
            : 'Attempt the paid hold without payment to capture the live 402 requirement.',
          accepted ? 'warn' : 'pending',
        )}
        ${proofCard(
          'x402 payment',
          payment ? `${payment.amount || '0.50'} ${payment.currency || 'USDC'}` : 'No payment yet',
          payment
            ? `${payment.paymentStatus || 'verified'} on ${payment.network || 'eip155:84532'} · action ${shortId(payment.actionId)}.`
            : 'Run the buyer flow to attach a signed x402 payment and retry the request.',
          payment ? 'ok' : 'pending',
        )}
        ${proofCard(
          'Dashboard lead',
          lead ? shortId(lead.leadId) : 'No live lead yet',
          lead
            ? `${lead.customerName || 'Agent'} · ${lead.status || 'created'} · ${compactTime(lead.createdAt)}.`
            : 'After verification, the origin API creates a lead that appears here and in DynamoDB.',
          lead ? 'ok' : 'pending',
        )}
      </div>
      <div class="proof-receipt">
        <div>
          <span class="proof-label">Run-specific receipt</span>
          <p>These values update when the live buyer creates a new booking.</p>
        </div>
        <pre>${escapeHtml(pretty(proofJson))}</pre>
      </div>
    </div>
  `;
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
  state.lastPaymentRequirement = null;
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
      state.lastPaymentRequirement = unpaidResult.body;
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

async function runServerDemoBuyer() {
  setBusy(true);
  state.buyerNotice = null;
  state.lastPaymentRequirement = null;
  state.timeline = ['REQUEST_RECEIVED'];
  state.requestJson = {
    actor: 'server_side_autonomous_agent',
    method: 'POST',
    path: '/api/demo/agent-buyer',
    headers: { 'content-type': 'application/json' },
    body: {
      baseUrl: window.location.origin,
      action: 'hold_priority_slot',
      note: 'Server uses the configured throwaway Base Sepolia buyer key; no key is sent from the browser.',
    },
  };

  try {
    const result = await api('/api/demo/agent-buyer', {
      method: 'POST',
      body: JSON.stringify({ baseUrl: window.location.origin, action: 'hold_priority_slot' }),
    });
    state.lastHttpStatus = result.status;
    state.responseJson = result.body;
    state.profile = result.body?.profile || state.profile;
    state.lastPaymentRequirement = result.body?.unpaidPaymentRequirement || null;

    if (result.ok && result.body?.success) {
      setTimelineFromResponse(result.body.booking || result.body);
      state.buyerNotice = 'One-click agent buyer completed: 402 captured, x402 payment verified, booking lead created.';
      await loadDashboard(false);
      return;
    }

    if (result.body?.configured === false) {
      state.buyerNotice = 'The one-click buyer endpoint is deployed, but DEMO_BUYER_PRIVATE_KEY is not configured yet.';
    } else {
      state.timeline = result.body?.unpaidStatus === 402
        ? ['REQUEST_RECEIVED', 'PAYMENT_REQUIRED_402']
        : ['REQUEST_RECEIVED'];
      state.buyerNotice = result.body?.error || 'The server-side demo buyer returned an error.';
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.buyerNotice = message;
    state.responseJson = { error: message };
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
    state.lastPaymentRequirement = null;
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

/* ── Simulation helpers ─────────────────────────────────── */

function simDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSimulation() {
  if (state.simRunning) return;
  state.simRunning = true;
  state.simStep = 0;
  render();
  const stepDelays = [900, 800, 1300, 950, 850, 950];
  for (let i = 0; i < stepDelays.length; i++) {
    await simDelay(stepDelays[i]);
    state.simStep = i + 1;
    render();
    const consoleEl = document.querySelector('#simConsole');
    if (consoleEl) consoleEl.scrollTo({ top: consoleEl.scrollHeight, behavior: 'smooth' });
  }
  state.simRunning = false;
  render();
}

function simBlock(label, type, code) {
  const badge = { get: 'GET', post: 'POST', err: '402', pay: 'PAY', ok: '200' }[type] || type;
  return `
    <div class="sim-api-block">
      <div class="sim-api-block-header">
        <span class="method-badge ${type}">${badge}</span>
        <span class="sim-api-block-label">${label}</span>
      </div>
      <pre class="sim-api-pre">${escapeHtml(code)}</pre>
    </div>`;
}

function simCodeContent(step) {
  if (step === 0) {
    return `<div class="sim-idle">
      <div class="sim-idle-icon">◈</div>
      <p class="sim-idle-text">The storyboard previews the agent journey. Use Live proof mode below for real API calls, fresh IDs, and dashboard state changes.</p>
    </div>`;
  }
  const blocks = [];

  if (step >= 1) blocks.push(simBlock('01 · DISCOVER', 'get',
`GET /api/agent/business-profile HTTP/1.1
Host: d2pc20oig2383p.cloudfront.net
Accept: application/json

──── Response ────────────────────────────────

HTTP/1.1 200 OK
Content-Type: application/json

{
  "business_id":   "miami-elite-auto-detail",
  "business_name": "Miami Elite Auto Detail",
  "description":   "Premium ceramic coating & detailing · Miami, FL",
  "capabilities": {
    "free": [
      "GET /api/chat",
      "GET /api/agent/business-profile"
    ],
    "paid": [
      {
        "action":   "hold_slot",
        "endpoint": "/api/paid/hold-slot",
        "price":    "$0.50",
        "network":  "eip155:84532",
        "protocol": "x402"
      }
    ]
  }
}`));

  if (step >= 2) blocks.push(simBlock('02 · REQUEST ACTION', 'post',
`POST /api/paid/hold-slot HTTP/1.1
Host: d2pc20oig2383p.cloudfront.net
Content-Type: application/json
Accept: application/json

{
  "service":        "Same-day ceramic detail",
  "vehicle":        "Tesla Model Y (Black)",
  "requested_time": "2026-05-06T16:30:00-04:00",
  "customer_name":  "Ava Chen"
}`));

  if (step >= 3) blocks.push(simBlock('03 · PAYMENT REQUIRED', 'err',
`HTTP/1.1 402 Payment Required
Content-Type: application/json
X-402-Version: 2

{
  "x402Version": 2,
  "error":       "Payment required to complete this action",
  "resource":    "POST /api/paid/hold-slot",
  "accepts": [
    {
      "protocol":          "x402",
      "network":           "eip155:84532",
      "asset":             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "payTo":             "0xBusiness...Wallet",
      "amount":            "500000",
      "decimals":          6,
      "symbol":            "USDC",
      "maxTimeoutSeconds": 300
    }
  ]
}`));

  if (step >= 4) blocks.push(simBlock('04 · PAY — Agent signs x402 and retries', 'pay',
`POST /api/paid/hold-slot HTTP/1.1
Host: d2pc20oig2383p.cloudfront.net
Content-Type: application/json
X-PAYMENT: eyJ4NDAyVmVyc2lvbiI6MiwicmVzb3VyY2Ui...

{
  "service":        "Same-day ceramic detail",
  "vehicle":        "Tesla Model Y (Black)",
  "requested_time": "2026-05-06T16:30:00-04:00",
  "customer_name":  "Ava Chen"
}

// X-PAYMENT header (decoded):
{
  "x402Version": 2,
  "protocol":    "x402",
  "network":     "eip155:84532",
  "payload": {
    "authorization": {
      "from":        "0xAgent...Wallet",
      "to":          "0xBusiness...Wallet",
      "value":       "500000",
      "validAfter":  "1746547200",
      "validBefore": "1746547500",
      "nonce":       "0xa3f9b2c1d4e5f6..."
    },
    "signature": "0x4a8f3d2e1b9c..."
  }
}`));

  if (step >= 5) blocks.push(simBlock('05 · VERIFY — Lambda@Edge verifies on-chain', 'ok',
`POST https://x402.org/facilitate HTTP/1.1
Content-Type: application/json

{ "network": "eip155:84532", "payload": { ... } }

──── Facilitator response ────────────────────

HTTP/1.1 200 OK
{
  "isValid":   true,
  "txHash":    "0x7b3c4d5e6f7a8b9c...",
  "network":   "eip155:84532",
  "amount":    "500000",
  "settledAt": "2026-05-06T20:30:01.443Z"
}`));

  if (step >= 6) blocks.push(simBlock('06 · ACT — Booking confirmed', 'ok',
`HTTP/1.1 200 OK
Content-Type: application/json

{
  "business_id":       "miami-elite-auto-detail",
  "business_name":     "Miami Elite Auto Detail",
  "service":           "Same-day ceramic detail",
  "requested_time":    "2026-05-06T16:30:00-04:00",
  "amount":            "0.50",
  "currency":          "USDC",
  "network":           "eip155:84532",
  "payment_status":    "settled",
  "booking_status":    "confirmed",
  "confirmation_id":   "booking_a3f9b2c1",
  "payment_reference": "0x7b3c4d5e6f7a8b9c..."
}`));

  return blocks.join('');
}

/* ── Chat state helpers ─────────────────────────────────── */

function chatStateTag() {
  if (state.lastHttpStatus === 200 && state.responseJson?.success) return 'confirmed';
  if (state.pendingPaidAction) return 'payment';
  if (state.lastChatDecision && state.lastChatDecision.requiresPayment === false && state.lastChatDecision.intent) return 'intent';
  return 'free';
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
    <section class="hero hero-split">
      <div class="grid-texture" aria-hidden="true"></div>
      <div class="hero-inner hero-inner-split">

        <div>
          <p class="eyebrow">EasyA Consensus Miami 2026 · Agentic Track</p>
          <h1>Turn any SME into a payable API endpoint.</h1>
          <p class="hero-copy">In the old internet, businesses needed websites. In the agentic internet, businesses need payable endpoints. AgentPay turns Miami Elite Auto Detail into a machine-readable service endpoint where questions are free and real appointment holds require x402 payment.</p>
          <div class="hero-actions">
            <a class="primary" href="#/simulator">Open API Simulator</a>
            <a class="secondary" href="#/chat">Try Customer Chat</a>
          </div>
        </div>

        <div class="flow-panel">
          <div class="flow-rail">
            <span class="flow-badge discovered">DISCOVERED</span>
            <span class="flow-arrow">→</span>
            <span class="flow-badge error">402 REQUIRED</span>
            <span class="flow-arrow">→</span>
            <span class="flow-badge paid">USDC PAID</span>
            <span class="flow-arrow">→</span>
            <span class="flow-badge verified">VERIFIED</span>
            <span class="flow-arrow">→</span>
            <span class="flow-badge booked">BOOKING CREATED</span>
          </div>
          <div class="flow-terminal">
            <div class="flow-terminal-header">
              <span class="flow-terminal-dot"></span>
              <span class="flow-terminal-dot"></span>
              <span class="flow-terminal-dot"></span>
              <span class="flow-terminal-title">agent · Miami Elite Auto Detail</span>
            </div>
            <div class="flow-terminal-body">
              <div class="flow-line cmd">
                <span class="flow-line-prompt">›</span>
                <span class="flow-line-text">GET /api/agent/business-profile</span>
              </div>
              <div class="flow-line ok">
                <span class="flow-line-prompt">✓</span>
                <span class="flow-line-text">DISCOVERED — Miami Elite Auto Detail</span>
              </div>
              <div class="flow-line spacer"></div>
              <div class="flow-line cmd">
                <span class="flow-line-prompt">›</span>
                <span class="flow-line-text">POST /api/paid/hold-slot</span>
              </div>
              <div class="flow-line err">
                <span class="flow-line-prompt">←</span>
                <span class="flow-line-text">HTTP 402 Payment Required</span>
              </div>
              <div class="flow-line data">
                <span class="flow-line-text">amount: "500000" (0.50 USDC)</span>
              </div>
              <div class="flow-line data">
                <span class="flow-line-text">network: "eip155:84532"</span>
              </div>
              <div class="flow-line data">
                <span class="flow-line-text">protocol: x402 v2</span>
              </div>
              <div class="flow-line spacer"></div>
              <div class="flow-line pay">
                <span class="flow-line-prompt">→</span>
                <span class="flow-line-text">X-PAYMENT header signed and sent</span>
              </div>
              <div class="flow-line ok">
                <span class="flow-line-prompt">✓</span>
                <span class="flow-line-text">VERIFIED — settled on Base Sepolia</span>
              </div>
              <div class="flow-line spacer"></div>
              <div class="flow-line ok">
                <span class="flow-line-prompt">←</span>
                <span class="flow-line-text">200 OK — Booking Confirmed</span>
              </div>
              <div class="flow-line json">
                <pre>{
  "bookingId":     "lead_a3f9b2c1",
  "service":       "Same-day ceramic detail",
  "amountPaid":    "0.50",
  "currency":      "USDC",
  "paymentStatus": "settled"
}</pre>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>

    <section class="page">
      <div class="tech-strip">
        <span class="tech-badge">x402</span>
        <span class="tech-badge">Base Sepolia</span>
        <span class="tech-badge">USDC</span>
        <span class="tech-badge">HTTP 402</span>
        <span class="tech-badge">Agent Discovery</span>
        <span class="tech-badge">Structured Booking JSON</span>
        <span class="tech-badge">AWS Verification</span>
        <span class="tech-badge">Lambda@Edge</span>
        <span class="tech-badge">CloudFront + WAF</span>
      </div>

      <div class="grid three">
        <div class="card">
          <div class="metric">0</div>
          <h3>Agent sign-ups required</h3>
          <p>Autonomous agents discover, qualify, and pay in a single request cycle — no registration, no OAuth, no session management required.</p>
        </div>
        <div class="card">
          <div class="metric">$0.50</div>
          <h3>Demo payment amount</h3>
          <p>A $0.50 USDC deposit gates the priority appointment hold on <span class="mono" style="font-size:0.85em">POST /api/paid/hold-slot</span>, paid, verified, and confirmed in the same round trip.</p>
        </div>
        <div class="card">
          <div class="metric">1</div>
          <h3>API call to trigger an action</h3>
          <p>One POST request turns free conversation into a paid, structured booking with an on-chain payment receipt and a verified lead in the dashboard.</p>
        </div>
      </div>

      <div class="section-header" style="margin-top: 64px;">
        <p class="eyebrow">How it works</p>
        <h2>Four steps from discovery to booked lead</h2>
        <p>Humans and agents both start from the same endpoint. The experience diverges only when a real, scarce business action is needed.</p>
      </div>
      <div class="how-steps">
        <div class="how-step">
          <div class="step-num">01 · Discover</div>
          <h3>Read the machine-readable profile</h3>
          <p>Agents fetch <span class="mono" style="font-size:0.82em">GET /api/agent/business-profile</span> and receive a JSON catalog of free and paid capabilities, pricing, and network details.</p>
        </div>
        <div class="how-step">
          <div class="step-num">02 · Ask</div>
          <h3>Questions are always free</h3>
          <p>Humans and agents can ask the AI receptionist anything. Vehicle info, availability, pricing — all handled conversationally at zero cost.</p>
        </div>
        <div class="how-step">
          <div class="step-num">03 · Pay</div>
          <h3>Actions return HTTP 402</h3>
          <p>When a booking or hold is requested, the edge gate returns HTTP 402 Payment Required with x402 payment requirements embedded in the response body.</p>
        </div>
        <div class="how-step">
          <div class="step-num">04 · Act</div>
          <h3>Verified and booked</h3>
          <p>The paying client retries with an x402 payment header. Lambda@Edge verifies on-chain, the origin creates a lead, and structured booking JSON is returned.</p>
        </div>
      </div>

      <div class="section-header" style="margin-top: 64px;">
        <p class="eyebrow">Architecture</p>
        <h2>Production-grade AWS infrastructure</h2>
        <p>Every request passes through CloudFront, WAF, Lambda@Edge, API Gateway, and DynamoDB — not a mock backend.</p>
      </div>
      <div class="architecture">
        <div class="node">
          <strong>Static UI</strong>
          <span>Five-page demo served from CloudFront CDN with S3 origin.</span>
        </div>
        <div class="node">
          <strong>CloudFront + WAF</strong>
          <span>Routes <span class="mono" style="font-size:0.82em">/api/paid/**</span> through the x402 edge gate. Free routes pass directly.</span>
        </div>
        <div class="node">
          <strong>Lambda@Edge</strong>
          <span>Verifies and settles exact USDC payments before the origin sees the request.</span>
        </div>
        <div class="node">
          <strong>Origin API</strong>
          <span>Receptionist logic, paid action handlers, and DynamoDB lead storage.</span>
        </div>
        <div class="node">
          <strong>DynamoDB</strong>
          <span>Leads, paid actions, and the x402 event timeline — live in the dashboard.</span>
        </div>
      </div>

      <div class="thesis-quote">
        <blockquote>
          In the old internet, businesses needed <em>websites.</em><br>
          In the agentic internet, businesses need <em>payable endpoints.</em>
        </blockquote>
        <p>This is not just a chatbot. Miami Elite Auto Detail is now a local business with a machine-readable, payment-enabled API.</p>
      </div>
    </section>
  `;
}

function chatPage() {
  const chatState = chatStateTag();
  const leadFields = state.lastChatDecision?.leadFields || {};

  const STEPS = [
    { id: 'free',      label: 'Free question' },
    { id: 'intent',    label: 'Booking intent' },
    { id: 'payment',   label: 'Payment required' },
    { id: 'confirmed', label: 'Agent-ready' },
  ];
  const ORDER = STEPS.map((s) => s.id);
  const currentIdx = ORDER.indexOf(chatState);

  function dotClass(id) {
    const i = ORDER.indexOf(id);
    if (i < currentIdx) return 'done';
    if (i === currentIdx) return 'active';
    return '';
  }

  const intakePaymentState =
    chatState === 'confirmed' ? 'Settled' :
    chatState === 'payment'   ? 'Required' : 'Not required';
  const intakeLeadState =
    chatState === 'confirmed' ? 'Confirmed' :
    chatState === 'payment'   ? 'Pending payment' :
    chatState === 'intent'    ? 'Qualifying' : 'New visitor';

  return `
    <section class="page chat-page-section">

      <div class="chat-page-hero">
        <div>
          <p class="eyebrow" style="margin:0 0 6px;">Chat Demo &middot; Miami Elite Auto Detail</p>
          <h1>Human-facing AI Receptionist</h1>
        </div>
        <div class="chat-hero-badges">
          <span class="protocol-badge x402">x402</span>
          <span class="protocol-badge usdc">$0.50 USDC</span>
          <span class="protocol-badge network">Base Sepolia</span>
        </div>
      </div>

      <div class="chat-step-strip">
        ${STEPS.map((step, i) => `
          <div class="chat-step-item">
            <span class="chat-step-dot ${dotClass(step.id)}"></span>
            <span class="chat-step-label ${dotClass(step.id)}">${step.label}</span>
          </div>
          ${i < STEPS.length - 1 ? '<span class="chat-step-arrow">›</span>' : ''}
        `).join('')}
      </div>

      <div class="chat-split">

        <!-- Chat window -->
        <div class="chat-window">
          <div class="chat-window-header">
            <div class="chat-window-logo">ME</div>
            <div class="chat-window-info">
              <strong>Miami Elite Auto Detail</strong>
              <small>AI Receptionist · Free questions · Priority holds from $0.50 USDC</small>
            </div>
            <span class="status-pill live">Live</span>
          </div>

          <div class="chat-stream-wrap" id="chatStream">
            ${state.chatMessages.map((msg) => `
              <div class="chat-msg ${msg.role}">
                <div class="chat-msg-avatar">${msg.role === 'assistant' ? 'ME' : 'U'}</div>
                <div class="chat-msg-bubble">${escapeHtml(msg.text)}</div>
              </div>
            `).join('')}
            ${chatState === 'intent' ? `
              <div class="chat-state-banner intent">Booking intent detected — qualifying customer details</div>
            ` : ''}
            ${chatState === 'payment' ? `
              <div class="chat-state-banner payment">Paid action ready — priority hold requires $0.50 USDC via x402</div>
            ` : ''}
          </div>

          <div class="chat-composer">
            <div class="chat-quick-prompts">
              <button class="chat-quick-btn" type="button" data-chat-prompt="What ceramic detailing services do you offer?">Services</button>
              <button class="chat-quick-btn" type="button" data-chat-prompt="I need a same-day ceramic detail for a black Tesla Model Y in Miami.">Same-day request</button>
              <button class="chat-quick-btn" type="button" data-chat-prompt="Can you hold the 4:30 PM slot for me today?">Hold 4:30 PM</button>
            </div>
            <form class="chat-composer-row" id="chatForm">
              <input id="chatInput" class="chat-input" autocomplete="off" placeholder="Ask about services, availability, pricing…">
              <button class="primary" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? '…' : 'Send'}</button>
            </form>
          </div>
        </div>

        <!-- Intake panel -->
        <div class="intake-panel">

          <!-- Live intake fields -->
          <div class="intake-card">
            <div class="intake-card-header">
              <span class="intake-card-title">Live intake fields</span>
              <span class="status-pill ${chatState === 'confirmed' ? 'live' : chatState === 'payment' ? 'pending' : 'inactive'}">${chatState === 'confirmed' ? 'Booked' : chatState === 'payment' ? 'Payment' : 'Qualifying'}</span>
            </div>
            <div class="intake-fields">
              <div class="intake-row">
                <span class="intake-label">Business</span>
                <span class="intake-value">Miami Elite Auto Detail</span>
              </div>
              <div class="intake-row">
                <span class="intake-label">Service</span>
                <span class="intake-value ${leadFields.service ? 'highlight' : 'empty'}">${escapeHtml(leadFields.service || '—')}</span>
              </div>
              <div class="intake-row">
                <span class="intake-label">Vehicle</span>
                <span class="intake-value ${leadFields.vehicle ? '' : 'empty'}">${escapeHtml(leadFields.vehicle || '—')}</span>
              </div>
              <div class="intake-row">
                <span class="intake-label">Requested time</span>
                <span class="intake-value ${leadFields.appointmentTime ? 'highlight' : 'empty'}">${escapeHtml(leadFields.appointmentTime || '—')}</span>
              </div>
              <div class="intake-row">
                <span class="intake-label">Customer intent</span>
                <span class="intake-value ${state.lastChatDecision?.intent ? '' : 'empty'}">${escapeHtml(state.lastChatDecision?.intent || 'Qualifying')}</span>
              </div>
              <div class="intake-row">
                <span class="intake-label">Payment state</span>
                <span class="intake-value ${chatState === 'payment' ? 'warning' : chatState === 'confirmed' ? 'success' : 'empty'}">${intakePaymentState}</span>
              </div>
              <div class="intake-row">
                <span class="intake-label">Lead state</span>
                <span class="intake-value ${chatState === 'confirmed' ? 'success' : ''}">${intakeLeadState}</span>
              </div>
            </div>
          </div>

          <!-- Paid action card -->
          <div class="intake-card">
            <div class="intake-card-header">
              <span class="intake-card-title">Paid action</span>
              ${state.pendingPaidAction ? '<span class="chip amber">Payment required</span>' : '<span class="chip blue">Listening</span>'}
            </div>
            <div class="intake-scroll-body paid-action-scroll stack">
              ${state.pendingPaidAction ? `
                <div class="paid-action-card-v2">
                  <div class="pac-header">
                    <span class="method-badge post">POST</span>
                    <code class="pac-endpoint">${escapeHtml(state.pendingPaidAction.endpoint)}</code>
                  </div>
                  <div class="pac-badges">
                    <span class="protocol-badge http-402">HTTP 402</span>
                    <span class="protocol-badge http-402">${escapeHtml(state.pendingPaidAction.price)}</span>
                    <span class="protocol-badge usdc">USDC</span>
                    <span class="protocol-badge network">${escapeHtml(state.pendingPaidAction.network || 'eip155:84532')}</span>
                    <span class="protocol-badge x402">${escapeHtml(state.pendingPaidAction.protocol || 'x402')}</span>
                  </div>
                  <p class="pac-reason">reason: ${escapeHtml(state.pendingPaidAction.reason || 'Booking hold requires payment commitment.')}</p>
                  <div class="pac-actions">
                    <button class="danger" type="button" data-unpaid-hold ${state.busy ? 'disabled' : ''}>Without payment</button>
                    <button class="primary" type="button" data-paid-hold ${state.busy ? 'disabled' : ''}>Sign x402</button>
                  </div>
                </div>
              ` : `
                <div class="empty" style="font-size:0.80rem; padding:20px;">
                  Appears when booking intent is detected and a real appointment hold is requested.
                </div>
              `}
              ${show402Moment()}
              ${showSuccessMoment()}
              ${showBuyerNotice()}
            </div>
          </div>

          <!-- Receptionist decision JSON -->
          <div class="intake-card">
            <div class="intake-card-header">
              <span class="intake-card-title">Receptionist decision</span>
            </div>
            <div class="decision-scroll-shell">
              ${state.lastChatDecision
                ? `<pre class="decision-pre">${escapeHtml(pretty(state.lastChatDecision))}</pre>`
                : `<pre class="decision-pre empty-decision">// Structured decision appears after the next message</pre>`
              }
            </div>
          </div>

          <!-- x402 timeline -->
          <div class="intake-card">
            <div class="intake-card-header">
              <span class="intake-card-title">x402 protocol timeline</span>
            </div>
            <div class="intake-scroll-body timeline-scroll">
              ${timelineMarkup()}
            </div>
          </div>

        </div>
      </div>

      <div class="cta-section">
        <h2>The human and agent paths meet at the same endpoint.</h2>
        <p>Watch an autonomous agent skip the chat window entirely — discover the business, trigger HTTP 402, pay $0.50 USDC via x402, and receive structured booking JSON.</p>
        <div class="hero-actions" style="justify-content:center; margin-top:0;">
          <a class="primary" href="#/simulator">Open API Simulator</a>
          <a class="secondary" href="#/dashboard">View Dashboard</a>
        </div>
      </div>
    </section>
  `;
}

function capabilityMarkup(profile) {
  if (!profile) return '<div class="empty">Run Step 1 to load the machine-readable business profile.</div>';
  return `
    <div class="capability-list">
      ${profile.paidCapabilities.map((cap) => `
        <div class="capability">
          <div class="capability-header">
            <span class="method-badge post">${escapeHtml(cap.method)}</span>
            <strong>${escapeHtml(cap.action)}</strong>
          </div>
          <div class="capability-badges">
            <span class="protocol-badge http-402">${escapeHtml(cap.price)}</span>
            <span class="protocol-badge network">${escapeHtml(cap.networkName)}</span>
            <span class="protocol-badge usdc">${escapeHtml(cap.protocol)}</span>
          </div>
          <code class="capability-path">${escapeHtml(cap.endpoint)}</code>
        </div>
      `).join('')}
    </div>
  `;
}

function simulatorPage() {
  const disabled = state.busy ? 'disabled' : '';

  const SIM_STEPS = [
    { num: '01', label: 'Discover',          desc: 'Fetch business profile — /api/agent/business-profile' },
    { num: '02', label: 'Request action',    desc: 'POST /api/paid/hold-slot — no payment header' },
    { num: '03', label: 'Payment required',  desc: 'HTTP/1.1 402 · x402 payment spec returned' },
    { num: '04', label: 'Pay',               desc: 'Agent signs X-PAYMENT header and retries' },
    { num: '05', label: 'Verify',            desc: 'Lambda@Edge verifies USDC on Base Sepolia' },
    { num: '06', label: 'Act',               desc: 'Booking JSON returned · booking hold confirmed' },
  ];

  function stepClass(i) {
    const n = i + 1;
    if (state.simStep >= n) return 'done';
    if (state.simRunning && state.simStep === n - 1) return 'active';
    return '';
  }

  const btnLabel = state.simRunning ? '⬤ Running…' : state.simStep === 6 ? '↺ Run storyboard' : '▶  Run storyboard';
  const statusPill = state.simStep === 6
    ? '<span class="status-pill live">Booking confirmed</span>'
    : state.simStep === 3
    ? '<span class="status-pill pending">402 · Payment required</span>'
    : state.simStep > 0
    ? '<span class="status-pill inactive">In progress</span>'
    : '<span class="status-pill inactive">Ready</span>';

  const connLineColor = (i) => state.simStep > i + 1 ? 'var(--green)' : 'var(--line-dark)';

  return `
    <!-- Hero -->
    <div class="sim-hero-section">
      <div style="width: min(860px, calc(100% - 36px)); margin: 0 auto;">
        <p class="eyebrow">API Simulator · Autonomous Agent · Base Sepolia · x402 v2</p>
        <h1 class="sim-hero-title">Watch an agent pay for a real-world action.</h1>
        <p class="sim-hero-copy">This is Miami Elite Auto Detail. An AI agent discovers what the business offers for free. When it tries to hold a real appointment slot, AWS CloudFront returns HTTP 402. The agent pays $0.50 USDC over x402 on Base Sepolia, then the backend creates a booking lead and the dashboard updates.</p>
        <div style="display:flex; align-items:center; gap:14px; justify-content:center; flex-wrap:wrap; margin-bottom:16px;">
          <button class="run-sim-btn" type="button" data-run-sim ${state.simRunning ? 'disabled' : ''}>${btnLabel}</button>
          ${state.simStep > 0 && !state.simRunning ? `<button class="secondary" type="button" data-reset-sim style="height:54px; padding:0 22px;">Reset</button>` : ''}
        </div>
      </div>
    </div>

    <!-- Product panel -->
    <div class="page" style="padding-top:44px;">

      <div class="tech-strip" style="margin-bottom:28px;">
        <span class="tech-badge">x402 Protocol v2</span>
        <span class="tech-badge">Base Sepolia · eip155:84532</span>
        <span class="tech-badge">USDC payment</span>
        <span class="tech-badge">HTTP 402</span>
        <span class="tech-badge">Lambda@Edge verify</span>
        <span class="tech-badge">Structured booking JSON</span>
      </div>

      <!-- Main product panel -->
      <div class="sim-product">
        <div class="sim-product-header">
          <div class="sim-product-dots">
            <div class="sim-product-dot"></div>
            <div class="sim-product-dot"></div>
            <div class="sim-product-dot"></div>
          </div>
          <span class="sim-product-title">guided storyboard · miami-elite-auto-detail · x402 v2 · Base Sepolia</span>
          <div>${statusPill}</div>
        </div>

        <div class="sim-product-body">
          <!-- Agent timeline -->
          <div class="sim-timeline-col">
            <div style="font-size:0.65rem; font-weight:700; color:var(--on-dark-subtle); letter-spacing:0.12em; text-transform:uppercase; margin-bottom:14px; padding:0 12px;">Agent flow</div>
            ${SIM_STEPS.map((step, i) => `
              <div class="sim-step ${stepClass(i)}" style="position:relative;">
                ${i < SIM_STEPS.length - 1 ? `
                  <div style="position:absolute; left:23px; top:38px; width:2px; height:calc(100% - 12px); background:${connLineColor(i)}; z-index:0; transition:background 0.4s;"></div>
                ` : ''}
                <div class="sim-step-num-wrap" style="position:relative;z-index:1;">
                  <span class="sim-step-num">${step.num}</span>
                </div>
                <div class="sim-step-info">
                  <div style="display:flex; align-items:center; gap:7px; margin-bottom:3px;">
                    <span class="sim-step-name">${step.label}</span>
                    ${state.simStep >= i + 1 && i !== 2 ? `<span class="method-badge ok" style="font-size:0.52rem;padding:2px 5px;">done</span>` : ''}
                    ${i === 2 && state.simStep >= 3 ? `<span class="method-badge err" style="font-size:0.52rem;padding:2px 5px;">402</span>` : ''}
                  </div>
                  <span class="sim-step-desc">${step.desc}</span>
                </div>
              </div>
            `).join('')}

            ${state.simStep === 6 ? `
              <div style="margin-top:14px; padding:14px; border:1px solid rgba(18,161,80,0.28); border-radius:var(--radius); background:rgba(18,161,80,0.06);">
                <div style="font-size:0.62rem; font-weight:800; color:#4ade80; letter-spacing:0.10em; text-transform:uppercase; margin-bottom:8px;">Payment verified</div>
                <div style="font-family:var(--font-mono); font-size:0.68rem; color:var(--on-dark-muted); line-height:1.7;">
                  <div>network: eip155:84532</div>
                  <div>amount:  0.50 USDC</div>
                  <div>status:  settled</div>
                  <div style="color:#4ade80; margin-top:4px;">id: booking_a3f9b2c1</div>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- API Console -->
          <div class="sim-console-col">
            <div class="sim-console-topbar">
              <span class="sim-console-tab">Storyboard console</span>
              <span style="flex:1;"></span>
              <span style="font-family:var(--font-mono); font-size:0.66rem; color:var(--on-dark-subtle);">${state.simStep}/6 steps</span>
            </div>
            <div class="sim-console-body" id="simConsole">
              ${simCodeContent(state.simStep)}
            </div>
          </div>
        </div>

        ${state.simStep >= 5 ? `
          <div class="sim-payment-bar">
            <div class="sim-payment-fields">
              <div class="sim-payment-field">
                <span class="sim-payment-field-label">Network</span>
                <span class="sim-payment-field-value">Base Sepolia · eip155:84532</span>
              </div>
              <div class="sim-payment-field">
                <span class="sim-payment-field-label">Amount</span>
                <span class="sim-payment-field-value">0.50 USDC</span>
              </div>
              <div class="sim-payment-field">
                <span class="sim-payment-field-label">Protocol</span>
                <span class="sim-payment-field-value">x402 v2</span>
              </div>
              <div class="sim-payment-field">
                <span class="sim-payment-field-label">Status</span>
                <span class="sim-payment-field-value verified">Settled on-chain</span>
              </div>
            </div>
            <span class="status-pill live">Payment verified</span>
          </div>
        ` : ''}
      </div>

      <!-- Interactive manual mode -->
      <div class="section-header" style="margin-top:72px;">
        <p class="eyebrow">Live proof mode</p>
        <h2>Prove it with real state changes</h2>
        <p>The buttons below call the deployed API. The evidence board updates from live 402 responses, paid-action receipts, and dashboard records.</p>
      </div>

      <div class="sim-layout">
        <div class="stack">
          <div class="panel api-shell">
            <div class="panel-header">
              <h2>Agent runbook</h2>
              <span class="chip blue">Base Sepolia · x402</span>
            </div>
            <div class="panel-body stack">
              <div class="runbook">
                <button class="runbook-step step-primary" type="button" data-demo-agent-buyer ${disabled}>
                  <span class="runbook-num">GO</span>
                  <span class="runbook-label">
                    <strong>Run one-click agent buyer</strong>
                    <small>Server agent discovers, receives 402, pays x402, and creates the lead</small>
                  </span>
                  <span class="method-badge pay">LIVE</span>
                </button>
                <button class="runbook-step" type="button" data-discover ${disabled}>
                  <span class="runbook-num">01</span>
                  <span class="runbook-label">
                    <strong>Discover profile</strong>
                    <small>Read services, pricing, and paid capabilities</small>
                  </span>
                  <span class="method-badge get">GET</span>
                </button>
                <button class="runbook-step step-danger" type="button" data-unpaid-hold ${disabled}>
                  <span class="runbook-num">02</span>
                  <span class="runbook-label">
                    <strong>Attempt hold — no payment</strong>
                    <small>See HTTP 402 Payment Required in action</small>
                  </span>
                  <span class="method-badge err">402</span>
                </button>
                <button class="runbook-step step-primary" type="button" data-paid-hold ${disabled}>
                  <span class="runbook-num">03</span>
                  <span class="runbook-label">
                    <strong>Advanced: browser wallet x402</strong>
                    <small>Use an injected wallet instead of the server-side demo buyer</small>
                  </span>
                  <span class="method-badge pay">USDC</span>
                </button>
              </div>
              ${show402Moment()}
              ${showSuccessMoment()}
              ${showBuyerNotice()}
              <div class="agent-cli">
                <strong>No terminal needed during judging</strong>
                <code>POST /api/demo/agent-buyer -> calls CloudFront /api/paid/hold-slot -> pays with x402</code>
              </div>
              ${technicalPanels()}
            </div>
          </div>
        </div>
        <div class="stack">
          ${proofEvidenceMarkup()}
          <div class="panel">
            <div class="panel-header">
              <h3>Paid capabilities</h3>
              ${state.profile ? '<span class="chip green">Discovered</span>' : '<span class="chip blue">Run Step 01</span>'}
            </div>
            <div class="panel-body">${capabilityMarkup(state.profile)}</div>
          </div>
          <div class="panel">
            <div class="panel-header"><h3>Payment flow timeline</h3></div>
            <div class="panel-body">${timelineMarkup()}</div>
          </div>
        </div>
      </div>

      <div class="cta-section" style="margin-top:48px;">
        <h2>The agent is not filling out a form.</h2>
        <p>Payment is part of the HTTP request cycle. After verification, a real-world business action is created — no checkout page, no human, no friction.</p>
        <div class="hero-actions" style="justify-content:center; margin-top:0;">
          <a class="primary" href="#/chat">Try the chat demo</a>
          <a class="secondary" href="#/miami">Miami Auto Detail use case</a>
        </div>
      </div>
    </div>
  `;
}

function dashboardPage() {
  const hasLiveData = state.leads.length > 0 || state.payments.length > 0;
  const metricPaidActions = hasLiveData ? state.payments.length : 12;
  const metricLeads = hasLiveData ? state.leads.length : 8;
  const metricRevenueValue = hasLiveData ? '$' + (state.payments.length * 0.5).toFixed(2) : '$6';
  const metricPending = hasLiveData ? state.leads.length : 3; // demo: 3 of 4 DEMO_BOOKINGS are non-booked (captured, awaiting, confirm)

  const DEMO_BOOKINGS = [
    {
      customer: 'Autonomous Agent',
      sub: 'AGP-AGENT-001',
      source: 'Agent API',
      service: 'Premium Mobile Detail',
      time: 'Today, 4:30 PM',
      payStatus: 'paid',
      payLabel: 'Paid',
      leadStatus: 'booked',
      leadLabel: 'Booking Hold Created',
      confId: 'AGP-MIA-1042',
    },
    {
      customer: 'Human Caller',
      sub: 'Chat session',
      source: 'Chat Demo',
      service: 'Interior Detail',
      time: 'Tomorrow, 11:00 AM',
      payStatus: 'none',
      payLabel: 'Not Required',
      leadStatus: 'captured',
      leadLabel: 'Lead Captured',
      confId: 'AGP-MIA-1043',
    },
    {
      customer: 'Autonomous Agent',
      sub: 'AGP-AGENT-002',
      source: 'Agent API',
      service: 'Ceramic Detail Consultation',
      time: 'Friday, 2:00 PM',
      payStatus: 'required',
      payLabel: 'Payment Required',
      leadStatus: 'awaiting',
      leadLabel: 'Awaiting Payment',
      confId: 'AGP-MIA-1044',
    },
    {
      customer: 'Human Visitor',
      sub: 'Walk-in inquiry',
      source: 'AI Receptionist',
      service: 'Exterior Wash',
      time: 'Saturday, 9:30 AM',
      payStatus: 'none',
      payLabel: 'Not Required',
      leadStatus: 'confirm',
      leadLabel: 'Needs Confirmation',
      confId: 'AGP-MIA-1045',
    },
  ];

  const liveBookingRows = state.leads.map((lead, i) => ({
    customer: lead.customerName,
    sub: lead.customerPhone,
    source: 'Live API',
    service: lead.service + (lead.vehicle ? ' · ' + lead.vehicle : ''),
    time: lead.appointmentTime,
    payStatus: 'paid',
    payLabel: 'Paid',
    leadStatus: 'booked',
    leadLabel: lead.status,
    confId: 'AGP-LIVE-' + String(i + 1).padStart(4, '0'),
  }));

  const allBookings = [...liveBookingRows, ...DEMO_BOOKINGS];

  const bookingRowsHtml = allBookings.map((row) => `
    <tr>
      <td>
        <span class="dash-customer-name">${escapeHtml(row.customer)}</span>
        <span class="dash-customer-sub">${escapeHtml(row.sub)}</span>
      </td>
      <td><span class="dash-customer-sub" style="color:var(--on-dark-muted);">${escapeHtml(row.source)}</span></td>
      <td style="color:var(--on-dark); white-space:nowrap;">${escapeHtml(row.service)}</td>
      <td style="white-space:nowrap; color:var(--on-dark-muted); font-size:0.78rem;">${escapeHtml(row.time)}</td>
      <td><span class="pay-pill ${escapeHtml(row.payStatus)}">${escapeHtml(row.payLabel)}</span></td>
      <td><span class="lead-pill ${escapeHtml(row.leadStatus)}">${escapeHtml(row.leadLabel)}</span></td>
      <td><span class="dash-conf-id">${escapeHtml(row.confId)}</span></td>
    </tr>
  `).join('');

  const DEMO_EVENTS = [
    {
      time: '10:42 AM',
      title: 'Agent discovered endpoint',
      desc: 'GET /.well-known/agentpay.json — Miami Elite Auto Detail profile returned.',
      badge: 'x402',
      badgeLabel: 'Discovery',
    },
    {
      time: '10:42 AM',
      title: 'HTTP 402 issued',
      desc: 'Agent requested POST /api/paid/hold-slot for 4:30 PM slot.',
      badge: 'http-402',
      badgeLabel: 'Payment required',
    },
    {
      time: '10:43 AM',
      title: 'USDC payment verified',
      desc: '$0.50 USDC settled on Base Sepolia · eip155:84532 · x402 v2.',
      badge: 'verified',
      badgeLabel: 'Verified',
    },
    {
      time: '10:43 AM',
      title: 'Booking hold created',
      desc: 'Same-day ceramic detail hold confirmed · reference: pay_mia_1042.',
      badge: 'verified',
      badgeLabel: 'Action created',
    },
    {
      time: '10:44 AM',
      title: 'Business notification queued',
      desc: 'Owner alert sent: new paid agent booking for 4:30 PM.',
      badge: 'network',
      badgeLabel: 'Notified',
    },
    {
      time: '10:45 AM',
      title: 'Lead added to dashboard',
      desc: 'AGP-MIA-1042 — verified paid lead record created.',
      badge: 'x402',
      badgeLabel: 'Recorded',
    },
  ];

  const liveEventRows = state.events.slice(0, 4).map((ev) => {
    let timeStr = ev.timestamp || '';
    try {
      timeStr = new Date(ev.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch (_) { /* keep raw */ }
    const badge =
      ev.status === 'PAYMENT_REQUIRED_402' ? 'http-402' :
      ev.status === 'PAYMENT_VERIFIED' ? 'verified' : 'x402';
    const badgeLabel =
      ev.status === 'PAYMENT_REQUIRED_402' ? 'Payment required' :
      ev.status === 'PAYMENT_VERIFIED' ? 'Verified' : 'Event';
    return {
      time: timeStr,
      title: (ev.status || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
      desc: ev.detail || ev.network || '',
      badge,
      badgeLabel,
    };
  });

  const allEvents = [...liveEventRows, ...DEMO_EVENTS];

  const activityHtml = allEvents.map((ev) => `
    <div class="dash-event">
      <span class="dash-event-time">${escapeHtml(ev.time)}</span>
      <div>
        <p class="dash-event-title">${escapeHtml(ev.title)}</p>
        <p class="dash-event-desc">${escapeHtml(ev.desc)}</p>
      </div>
      <span class="protocol-badge ${ev.badge}">${escapeHtml(ev.badgeLabel)}</span>
    </div>
  `).join('');

  const disabled = state.busy ? 'disabled' : '';

  return `
    <section class="page">

      <!-- Dashboard hero -->
      <div class="dash-hero">
        <p class="eyebrow">Business Operations · Miami Elite Auto Detail</p>
        <h1>AgentPay Business Dashboard</h1>
        <p>Track human leads, paid agent actions, payment verification, and structured booking events from one operational view.</p>
        <div class="dash-hero-chips">
          <span class="status-pill live">Live endpoint</span>
          <span class="protocol-badge x402">x402 enabled</span>
          <span class="protocol-badge network">Base Sepolia</span>
          <span class="chip blue">Miami Elite Auto Detail</span>
        </div>
      </div>

      <!-- Metric cards -->
      <div class="dash-metrics">
        <div class="dash-metric-card">
          <div class="dash-metric-value blue">${metricPaidActions}</div>
          <div class="dash-metric-label">Paid agent actions</div>
          <div class="dash-metric-sub">Verified through x402</div>
        </div>
        <div class="dash-metric-card">
          <div class="dash-metric-value cyan">${metricLeads}</div>
          <div class="dash-metric-label">Open leads</div>
          <div class="dash-metric-sub">Captured by receptionist</div>
        </div>
        <div class="dash-metric-card">
          <div class="dash-metric-value green">${metricRevenueValue}</div>
          <div class="dash-metric-label">Revenue collected</div>
          <div class="dash-metric-sub">Demo payment volume · USDC</div>
        </div>
        <div class="dash-metric-card">
          <div class="dash-metric-value amber">${metricPending}</div>
          <div class="dash-metric-label">Bookings pending</div>
          <div class="dash-metric-sub">Needs owner follow-up</div>
        </div>
      </div>

      <!-- Bookings and leads table -->
      <div class="dash-table-panel">
        <div class="dash-panel-header">
          <h2>Bookings &amp; leads</h2>
          <div class="dash-header-actions">
            <span class="protocol-badge x402">x402 verified</span>
            <button class="secondary" type="button" data-refresh-dashboard style="height:32px; padding:0 14px; font-size:0.78rem;" ${disabled}>Refresh</button>
            <button class="secondary" type="button" data-reset-dashboard style="height:32px; padding:0 14px; font-size:0.78rem;" ${disabled}>Reset</button>
          </div>
        </div>
        <div class="dash-table-wrap">
          <table class="dash-table">
            <thead>
              <tr>
                <th>Customer or agent</th>
                <th>Source</th>
                <th>Service requested</th>
                <th>Time requested</th>
                <th>Payment status</th>
                <th>Lead status</th>
                <th>Confirmation ID</th>
              </tr>
            </thead>
            <tbody>${bookingRowsHtml}</tbody>
          </table>
        </div>
      </div>

      <!-- Lower section: activity feed + sidebar -->
      <div class="dash-lower">

        <!-- Activity feed -->
        <div class="dash-activity-panel">
          <div class="dash-panel-header">
            <h2>Activity feed</h2>
            <span class="status-pill live">Live</span>
          </div>
          <div class="dash-activity-list">
            ${activityHtml}
          </div>
        </div>

        <!-- Sidebar -->
        <div class="dash-sidebar">

          <!-- Endpoint status panel -->
          <div class="dash-status-panel">
            <div class="dash-panel-header">
              <h2>Endpoint status</h2>
              <span class="status-pill live">All systems live</span>
            </div>
            <div class="dash-status-list">
              <div class="dash-status-row">
                <span class="dash-status-name">Business profile</span>
                <span class="status-pill live">Live</span>
              </div>
              <div class="dash-status-row">
                <span class="dash-status-name">Agent manifest</span>
                <span class="status-pill live">Published</span>
              </div>
              <div class="dash-status-row">
                <span class="dash-status-name">Booking endpoint</span>
                <span class="status-pill live">Online</span>
              </div>
              <div class="dash-status-row">
                <span class="dash-status-name">Payment network</span>
                <span class="protocol-badge network">Base Sepolia</span>
              </div>
              <div class="dash-status-row">
                <span class="dash-status-name">x402 protocol</span>
                <span class="protocol-badge x402">Enabled</span>
              </div>
              <div class="dash-status-row">
                <span class="dash-status-name">Webhook</span>
                <span class="status-pill inactive">Ready</span>
              </div>
              <div class="dash-status-row">
                <span class="dash-status-name">Dashboard sync</span>
                <span class="status-pill live">Active</span>
              </div>
            </div>
          </div>

          <!-- Payment verification card -->
          <div class="dash-verify-card">
            <div class="dash-verify-header">
              <div class="dash-verify-dot"></div>
              <span class="dash-verify-title">Latest verified payment</span>
            </div>
            <div class="dash-verify-fields">
              <div class="dash-verify-row">
                <span class="dash-verify-label">Amount</span>
                <span class="dash-verify-value verified">$0.50 USDC</span>
              </div>
              <div class="dash-verify-row">
                <span class="dash-verify-label">Network</span>
                <span class="dash-verify-value">Base Sepolia</span>
              </div>
              <div class="dash-verify-row">
                <span class="dash-verify-label">Protocol</span>
                <span class="dash-verify-value">x402 v2</span>
              </div>
              <div class="dash-verify-row">
                <span class="dash-verify-label">Status</span>
                <span class="dash-verify-value verified">Verified</span>
              </div>
              <div class="dash-verify-row">
                <span class="dash-verify-label">Action</span>
                <span class="dash-verify-value">Booking hold created</span>
              </div>
              <div class="dash-verify-row">
                <span class="dash-verify-label">Reference</span>
                <span class="dash-verify-value muted">pay_mia_1042</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div class="cta-section">
        <h2>Every local business becomes a payable API endpoint.</h2>
        <p>See the full use case: how Miami Elite Auto Detail serves both human customers and autonomous agents from the same underlying endpoint.</p>
        <div class="hero-actions" style="justify-content:center; margin-top:0;">
          <a class="primary" href="#/miami">Miami Auto Detail use case</a>
          <a class="secondary" href="#/chat">Try the chat demo</a>
        </div>
      </div>

    </section>
  `;
}

function miamiPage() {
  const bookingJson = escapeHtml(pretty({
    success: true,
    action: 'hold_slot',
    bookingId: 'lead_a3f9b2c1',
    businessName: 'Miami Elite Auto Detail',
    service: 'Same-day ceramic detail',
    appointmentTime: '2026-05-05T16:30:00-04:00',
    amountPaid: '0.50',
    currency: 'USDC',
    network: 'eip155:84532',
    paymentStatus: 'settled',
    bookingStatus: 'confirmed',
  }));

  return `
    <section class="hero" style="min-height: 62vh;">
      <div class="grid-texture" aria-hidden="true"></div>
      <div class="hero-inner">
        <p class="eyebrow">Use Case · Miami, Florida · Base Sepolia</p>
        <h1>Miami Elite Auto Detail,<br>now callable by humans<br>and payable by agents.</h1>
        <p class="hero-copy">A normal customer chats with the AI receptionist for free. An autonomous AI agent discovers services, requests a booking hold, pays $0.50 USDC over x402, and receives structured confirmation JSON — no human needed.</p>
        <div class="hero-actions">
          <a class="primary" href="#/simulator">Open API Simulator</a>
          <a class="secondary" href="#/chat">Try Customer Chat</a>
        </div>
      </div>
    </section>

    <section class="page">

      <!-- Business profile card -->
      <div class="biz-profile">
        <div class="biz-logo">ME</div>
        <div class="biz-info">
          <h2>Miami Elite Auto Detail</h2>
          <p>Premium ceramic coating and detailing · Miami, Florida · Open 8am – 7pm</p>
          <div class="biz-info-badges">
            <span class="status-pill live">x402 endpoint live</span>
            <span class="protocol-badge network">eip155:84532</span>
            <span class="protocol-badge usdc">USDC payments</span>
          </div>
        </div>
        <div class="biz-endpoints">
          <code>GET /api/agent/business-profile</code>
          <code>POST /api/paid/hold-slot</code>
          <code>POST /api/chat</code>
        </div>
      </div>

      <!-- Service menu -->
      <div class="section-header" style="margin-top: 52px;">
        <p class="eyebrow">Services</p>
        <h2>What Miami Elite Auto Detail offers</h2>
        <p>Free endpoints handle discovery and questions. Priority appointment holds require a $0.50 USDC deposit via x402.</p>
      </div>
      <div class="grid three">
        <div class="service-card">
          <p class="service-card-name">Same-day ceramic detail</p>
          <p class="service-card-detail">Interior and exterior ceramic treatment for any vehicle class. Priority same-day slots require a hold deposit.</p>
          <span class="service-card-price">from $250 · Priority hold: 0.50 USDC</span>
        </div>
        <div class="service-card">
          <p class="service-card-name">Full ceramic coating</p>
          <p class="service-card-detail">Multi-layer ceramic protection with a two-year warranty. Requires a scheduling consultation and full prep work.</p>
          <span class="service-card-price">from $800</span>
        </div>
        <div class="service-card">
          <p class="service-card-name">Paint correction</p>
          <p class="service-card-detail">Single and multi-stage polish to remove swirl marks, oxidation, and light scratches before coating.</p>
          <span class="service-card-price">from $350</span>
        </div>
        <div class="service-card">
          <p class="service-card-name">Interior deep clean</p>
          <p class="service-card-detail">Full interior extraction, steam clean, leather conditioning, and odor treatment for any vehicle size.</p>
          <span class="service-card-price">from $150</span>
        </div>
        <div class="service-card">
          <p class="service-card-name">Headlight restoration</p>
          <p class="service-card-detail">Clarity restoration for faded or yellowed headlights with UV sealant application and finish polish.</p>
          <span class="service-card-price">from $80</span>
        </div>
        <div class="service-card">
          <p class="service-card-name">Engine bay detail</p>
          <p class="service-card-detail">Safe degreasing and detailing of the engine bay for show prep or general maintenance.</p>
          <span class="service-card-price">from $120</span>
        </div>
      </div>

      <!-- What it enables -->
      <div class="section-header" style="margin-top: 56px;">
        <p class="eyebrow">What it enables</p>
        <h2>New capabilities for the agentic era</h2>
      </div>
      <div class="grid two">
        <div class="feature-card">
          <div style="margin-bottom: 12px;"><span class="protocol-badge http-402">POST /api/paid/hold-slot</span></div>
          <h3>Agent-paid appointment holds</h3>
          <p>Autonomous agents can reserve priority slots at any hour — without calling, without accounts, and without human intervention. The x402 payment is the contract.</p>
        </div>
        <div class="feature-card">
          <div style="margin-bottom: 12px;"><span class="protocol-badge verified">24/7</span></div>
          <h3>After-hours lead capture</h3>
          <p>The AI receptionist qualifies leads at 2am just as confidently as 2pm. Every paid action creates a verified dashboard record the moment payment settles.</p>
        </div>
        <div class="feature-card">
          <div style="margin-bottom: 12px;"><span class="protocol-badge network">GET /api/agent/business-profile</span></div>
          <h3>Machine-readable business profile</h3>
          <p>Any AI agent can discover what this business does, what it charges, and how to trigger a paid action — all from a single discovery request.</p>
        </div>
        <div class="feature-card">
          <div style="margin-bottom: 12px;"><span class="protocol-badge usdc">structured data</span></div>
          <h3>Structured customer intake</h3>
          <p>Every paid action creates a verified lead record with customer name, vehicle, service, appointment time, and payment status — ready for CRM or calendar export.</p>
        </div>
      </div>

      <!-- Human vs agent path -->
      <div class="section-header" style="margin-top: 56px;">
        <p class="eyebrow">Two ways to interact</p>
        <h2>Human path vs. agent path</h2>
        <p>The same underlying endpoint serves a human customer typing in a chat window and an autonomous agent making programmatic API calls.</p>
      </div>
      <div class="path-grid">
        <div class="path-col human">
          <div class="path-header">
            <div class="path-icon">U</div>
            <span class="path-label">Human customer</span>
          </div>
          <div class="path-steps">
            <div class="path-step">
              <span class="path-step-num">1</span>
              <span>Opens the chat widget and asks about a same-day ceramic detail for a black Tesla Model Y</span>
            </div>
            <div class="path-step">
              <span class="path-step-num">2</span>
              <span>AI receptionist asks a qualifying question about the vehicle and preferred timing</span>
            </div>
            <div class="path-step">
              <span class="path-step-num">3</span>
              <span>Receptionist offers the 4:30 PM priority hold for a $0.50 USDC deposit</span>
            </div>
            <div class="path-step">
              <span class="path-step-num">4</span>
              <span>Customer clicks "Sign x402 payment" and approves via connected Base Sepolia wallet</span>
            </div>
            <div class="path-step">
              <span class="path-step-num">5</span>
              <span>Booking confirmed — appears in the business dashboard with full transcript snippet</span>
            </div>
          </div>
        </div>
        <div class="path-col agent">
          <div class="path-header">
            <div class="path-icon">AI</div>
            <span class="path-label">Autonomous AI agent</span>
          </div>
          <div class="path-steps">
            <div class="path-step">
              <span class="path-step-num">1</span>
              <span>Calls <span class="mono" style="font-size:0.82em">GET /api/agent/business-profile</span> — reads services, pricing, and paid capabilities</span>
            </div>
            <div class="path-step">
              <span class="path-step-num">2</span>
              <span>Calls <span class="mono" style="font-size:0.82em">POST /api/paid/hold-slot</span> — receives HTTP 402 with x402 payment requirements</span>
            </div>
            <div class="path-step">
              <span class="path-step-num">3</span>
              <span>Signs an x402 payment header using a funded wallet and retries the same endpoint</span>
            </div>
            <div class="path-step">
              <span class="path-step-num">4</span>
              <span>Lambda@Edge verifies the USDC payment on Base Sepolia via the x402 facilitator</span>
            </div>
            <div class="path-step">
              <span class="path-step-num">5</span>
              <span>Receives 200 OK with structured booking JSON — lead is in the dashboard, no human involved</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Before / After -->
      <div class="section-header" style="margin-top: 56px;">
        <p class="eyebrow">Impact</p>
        <h2>Before AgentPay vs. after</h2>
      </div>
      <div class="comparison-grid">
        <div class="comparison-col before">
          <div class="comparison-header">Before AgentPay</div>
          <div class="comparison-body">
            <div class="comparison-item">
              <div class="comparison-icon">✕</div>
              <span>Website contact form — no immediate confirmation, no structured data</span>
            </div>
            <div class="comparison-item">
              <div class="comparison-icon">✕</div>
              <span>Missed calls after business hours, voicemails that go unprocessed</span>
            </div>
            <div class="comparison-item">
              <div class="comparison-icon">✕</div>
              <span>Manual appointment followup and data entry into calendar or CRM</span>
            </div>
            <div class="comparison-item">
              <div class="comparison-icon">✕</div>
              <span>No machine-readable booking path — completely invisible to AI agents</span>
            </div>
            <div class="comparison-item">
              <div class="comparison-icon">✕</div>
              <span>No verified payment intent — no deposit means no-shows and cancellations</span>
            </div>
          </div>
        </div>
        <div class="comparison-col after">
          <div class="comparison-header">After AgentPay</div>
          <div class="comparison-body">
            <div class="comparison-item">
              <div class="comparison-icon">✓</div>
              <span>AI receptionist handles humans and agents at any hour, without a human on-call</span>
            </div>
            <div class="comparison-item">
              <div class="comparison-icon">✓</div>
              <span>Agent-readable business profile — discoverable by any AI that knows how to call a GET endpoint</span>
            </div>
            <div class="comparison-item">
              <div class="comparison-icon">✓</div>
              <span>HTTP 402 payment gate — verified on-chain USDC intent before any slot is reserved</span>
            </div>
            <div class="comparison-item">
              <div class="comparison-icon">✓</div>
              <span>Structured booking leads with payment receipt land instantly in the business dashboard</span>
            </div>
            <div class="comparison-item">
              <div class="comparison-icon">✓</div>
              <span>Autonomous agents can discover, qualify, pay, and confirm — zero friction, zero accounts</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Booking mockup -->
      <div class="section-header" style="margin-top: 56px;">
        <p class="eyebrow">Confirmed booking</p>
        <h2>The paid booking response</h2>
        <p>After x402 payment verification, the origin API returns structured booking JSON. This is what an autonomous agent receives as confirmation of a completed hold.</p>
      </div>
      <div class="booking-mockup">
        <div class="booking-mockup-header">
          <div class="booking-mockup-status"></div>
          <span class="booking-mockup-title">200 OK · POST /api/paid/hold-slot · payment verified · settled on Base Sepolia</span>
        </div>
        <div class="booking-mockup-body">
          <pre>${bookingJson}</pre>
        </div>
      </div>

      <!-- Paid API capabilities -->
      <div class="section-header" style="margin-top: 56px;">
        <p class="eyebrow">Paid API capabilities</p>
        <h2>What agents can pay for</h2>
        <p>Discoverable via the machine-readable profile. The x402 gate enforces payment before any capacity is reserved.</p>
      </div>
      <div class="grid three">
        <div class="feature-card">
          <div style="margin-bottom: 12px;">
            <span class="protocol-badge http-402">POST /api/paid/hold-slot</span>
          </div>
          <h3>Same-day ceramic detail hold</h3>
          <p>Reserve a priority appointment slot for same-day service. $0.50 USDC · x402 v2 · Base Sepolia. Fully implemented in this demo.</p>
        </div>
        <div class="feature-card" style="opacity: 0.55;">
          <div style="margin-bottom: 12px;">
            <span class="protocol-badge network">POST /api/paid/quote-request</span>
          </div>
          <h3>Verified quote request</h3>
          <p>Get a binding quote for a specific service and vehicle. $1 USDC · x402 v2. Configured roadmap stub — not yet live.</p>
        </div>
        <div class="feature-card" style="opacity: 0.55;">
          <div style="margin-bottom: 12px;">
            <span class="protocol-badge network">POST /api/paid/priority-callback</span>
          </div>
          <h3>Priority callback</h3>
          <p>Request a same-day callback from the business owner. $2 USDC · x402 v2. Configured roadmap stub — not yet live.</p>
        </div>
      </div>

      <!-- x402 timeline -->
      <div class="section-header" style="margin-top: 56px;">
        <p class="eyebrow">Protocol steps</p>
        <h2>The x402 payment flow</h2>
        <p>From first request to booked lead in six protocol steps.</p>
      </div>
      <div class="panel">
        <div class="panel-body">
          ${timelineMarkup()}
        </div>
      </div>

      <!-- CTA -->
      <div class="cta-section">
        <h2>This is not a chatbot. This is a payable API for the physical world.</h2>
        <p>Watch the full flow live in the Agent API Simulator — discovery, HTTP 402, x402 payment, verification, and a real booking lead in the dashboard.</p>
        <div class="hero-actions" style="justify-content: center; margin-top: 0;">
          <a class="primary" href="#/simulator">Open API Simulator</a>
          <a class="secondary" href="#/dashboard">View Dashboard</a>
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
  else if (state.route === '/miami') app.innerHTML = miamiPage();
  else app.innerHTML = landingPage();

  bindEvents();
  if (state.route === '/chat') {
    const stream = document.querySelector('#chatStream');
    if (stream) stream.scrollTop = stream.scrollHeight;
  }
  if (state.route === '/simulator') {
    const consoleEl = document.querySelector('#simConsole');
    if (consoleEl && state.simStep > 0) consoleEl.scrollTop = consoleEl.scrollHeight;
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
  document.querySelectorAll('[data-demo-agent-buyer]').forEach((button) => {
    button.addEventListener('click', runServerDemoBuyer);
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

  document.querySelectorAll('[data-run-sim]').forEach((button) => {
    button.addEventListener('click', runSimulation);
  });

  document.querySelectorAll('[data-reset-sim]').forEach((button) => {
    button.addEventListener('click', () => {
      state.simStep = 0;
      state.simRunning = false;
      render();
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
  const prevRoute = state.route;
  state.route = routeFromHash();
  if (prevRoute === '/simulator' && state.route !== '/simulator') {
    state.lastHttpStatus = null;
    state.requestJson = null;
    state.responseJson = null;
    state.buyerNotice = null;
    state.timeline = [];
    state.lastPaymentRequirement = null;
  }
  if (state.route === '/dashboard' || state.route === '/simulator') await loadDashboard(false);
  render();
});

async function boot() {
  state.route = routeFromHash();
  if (state.route === '/dashboard' || state.route === '/simulator') await loadDashboard(false);
  render();
}

boot();
