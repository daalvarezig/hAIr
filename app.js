/* ── STATE ── */
const state = {
  supabase: null,
  services: [],
  appointments: [],
  clients: [],
  settings: {
    openTime: '10:00',
    closeTime: '19:00',
    reminder24: 'true',
    reminder2: 'true',
    supabaseUrl: '',
    supabaseKey: ''
  }
};

const defaultServices = [
  { id: 's1', name: 'peinar',          category: 'Peinado', base_duration_short: 25, icon: '✂️' },
  { id: 's2', name: 'cortar_y_peinar', category: 'Corte',   base_duration_short: 40, icon: '💈' },
  { id: 's3', name: 'tinte',           category: 'Color',   base_duration_short: 40, icon: '🎨' },
  { id: 's4', name: 'barros',          category: 'Color',   base_duration_short: 40, icon: '🌿' },
  { id: 's5', name: 'mechas',          category: 'Color',   base_duration_short: 60, icon: '✨' },
  { id: 's6', name: 'rayos_de_sol',    category: 'Color',   base_duration_short: 60, icon: '☀️' }
];

/* ── UTILS ── */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function prettyService(name) {
  return name.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function translateHair(v) {
  return ({ short: 'Corto', medium: 'Medio', long: 'Largo' }[v] || v || '—');
}
function translateStatus(v) {
  return ({ confirmed: 'Confirmar', completed: 'Completar', cancelled: 'Cancelar', no_show: 'No show' }[v] || v);
}
function formatDateTime(value) {
  const d = new Date(value);
  if (isNaN(d)) return value || '—';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(d);
}
function formatTimeOnly(value) {
  const d = new Date(value);
  if (isNaN(d)) return value || '—';
  return new Intl.DateTimeFormat('es-ES', { timeStyle: 'short' }).format(d);
}

/* ── SETTINGS ── */
function loadSettings() {
  const raw = localStorage.getItem('tirso_settings');
  if (raw) {
    try { state.settings = { ...state.settings, ...JSON.parse(raw) }; } catch {}
  }
  $('#openTime').value = state.settings.openTime;
  $('#closeTime').value = state.settings.closeTime;
  $('#reminder24').value = state.settings.reminder24;
  $('#reminder2').value = state.settings.reminder2;
  $('#supabaseUrl').value = state.settings.supabaseUrl;
  $('#supabaseKey').value = state.settings.supabaseKey;
  maybeInitSupabase();
}

function saveSettings(e) {
  e.preventDefault();
  state.settings = {
    openTime: $('#openTime').value,
    closeTime: $('#closeTime').value,
    reminder24: $('#reminder24').value,
    reminder2: $('#reminder2').value,
    supabaseUrl: $('#supabaseUrl').value.trim(),
    supabaseKey: $('#supabaseKey').value.trim(),
  };
  localStorage.setItem('tirso_settings', JSON.stringify(state.settings));
  maybeInitSupabase();
  showToast('Ajustes guardados');
}

function maybeInitSupabase() {
  if (state.settings.supabaseUrl && state.settings.supabaseKey && window.supabase) {
    state.supabase = window.supabase.createClient(state.settings.supabaseUrl, state.settings.supabaseKey);
  }
}

/* ── TOAST ── */
function showToast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('toast-show'), 10);
  setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 300); }, 2500);
}

/* ── NAVIGATION ── */
function switchView(viewId) {
  $$('.view').forEach(v => v.classList.toggle('active', v.id === viewId));
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === viewId));
}

function openModal(id) { document.getElementById(id).showModal(); }

/* ── RENDER SERVICES ── */
function renderServices() {
  const grid = $('#servicesList');
  grid.innerHTML = '';
  const data = state.services.length ? state.services : defaultServices;

  data.forEach(s => {
    const card = document.createElement('article');
    card.className = 'service-card';
    card.innerHTML = `
      <div class="service-icon">${s.icon || '✂️'}</div>
      <div class="service-name">${prettyService(s.name)}</div>
      <div class="service-meta">${s.category}</div>
      <div class="service-duration">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        Corto ${s.base_duration_short}min · Medio ${s.base_duration_short + 15}min · Largo ${s.base_duration_short + 30}min
      </div>
    `;
    grid.appendChild(card);
  });

  // Populate select
  const select = $('#apptService');
  select.innerHTML = '';
  data.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id || s.name;
    opt.textContent = prettyService(s.name);
    select.appendChild(opt);
  });
}

/* ── RENDER CLIENTS ── */
function renderClients() {
  const target = $('#clientsList');
  target.innerHTML = '';
  if (!state.clients.length) {
    target.innerHTML = '<p style="color:var(--muted);text-align:center;padding:28px 0;font-size:13px;">Sin clientes registrados</p>';
    return;
  }
  state.clients.forEach(c => {
    const node = document.getElementById('itemTemplate').content.cloneNode(true);
    node.querySelector('.item-title').textContent = c.full_name;
    node.querySelector('.item-sub').textContent = `${c.phone}${c.notes ? ' · ' + c.notes : ''}`;
    target.appendChild(node);
  });
}

/* ── RENDER APPOINTMENTS ── */
function renderAppointments() {
  const targetAll = $('#appointmentsList');
  const targetToday = $('#todayList');
  targetAll.innerHTML = '';
  targetToday.innerHTML = '';

  const filteredDate = $('#dateFilter').value;
  const appts = [...state.appointments].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const today = new Date().toISOString().slice(0, 10);

  appts.forEach(a => {
    if ((a.starts_at || '').slice(0, 10) === today) {
      targetToday.appendChild(makeAppointmentNode(a));
    }
  });

  const filtered = filteredDate
    ? appts.filter(a => (a.starts_at || '').slice(0, 10) === filteredDate)
    : appts;
  filtered.forEach(a => targetAll.appendChild(makeAppointmentNode(a)));

  // KPIs
  const todayAppts = appts.filter(a => (a.starts_at || '').slice(0, 10) === today);
  $('#kpiToday').textContent = todayAppts.length;
  $('#kpiPending').textContent = appts.filter(a => ['booked', 'confirmed'].includes(a.status)).length;
  $('#kpiNoShow').textContent = appts.filter(a => a.status === 'no_show').length;
  const next = appts.find(a => new Date(a.starts_at) > new Date() && ['booked', 'confirmed'].includes(a.status));
  $('#kpiNext').textContent = next ? formatTimeOnly(next.starts_at) : '—';

  // Today label
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const now = new Date();
  $('#todayLabel').textContent = `${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]}`;
}

function makeAppointmentNode(a) {
  const node = document.getElementById('itemTemplate').content.cloneNode(true);
  const name = a.client_name || a.full_name || 'Cliente';
  const svc = prettyService(a.service_name || a.service || 'Servicio');
  node.querySelector('.item-title').innerHTML = `${name} <span style="color:var(--accent);font-weight:400">·</span> ${svc}`;

  const badge = `<span class="badge badge-${a.status}">${statusLabel(a.status)}</span>`;
  node.querySelector('.item-sub').innerHTML = `${formatDateTime(a.starts_at)} · ${translateHair(a.hair_length)} ${badge}`;

  const actions = node.querySelector('.item-actions');
  if (!['completed', 'cancelled'].includes(a.status)) {
    [['confirmed', 'btn-confirm', 'Confirmar'], ['completed', 'btn-complete', 'Completar'], ['cancelled', 'btn-cancel', 'Cancelar']].forEach(([status, cls, label]) => {
      if (a.status === status) return;
      const btn = document.createElement('button');
      btn.className = `btn-status ${cls}`;
      btn.textContent = label;
      btn.onclick = () => updateAppointmentStatus(a.id, status);
      actions.appendChild(btn);
    });
  }
  return node;
}

function statusLabel(v) {
  return ({ booked: 'Reservada', confirmed: 'Confirmada', completed: 'Completada', cancelled: 'Cancelada', no_show: 'No show' }[v] || v);
}

/* ── FETCH ── */
async function fetchData() {
  if (!state.supabase) {
    state.services = defaultServices;
    state.clients = [
      { id: '1', full_name: 'Laura Sánchez', phone: '+34 600 111 222', notes: 'Mechas rubias cada 6 semanas' },
      { id: '2', full_name: 'Carmen Ortega', phone: '+34 600 333 444', notes: 'Prefiere barros, sin amoniaco' },
      { id: '3', full_name: 'Marta Jiménez', phone: '+34 600 555 666', notes: 'Pelo largo, tinte castaño' }
    ];
    const d = new Date();
    const mk = (h, m) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString();
    state.appointments = [
      { id: 'a1', client_name: 'Laura Sánchez',  service_name: 'mechas',          hair_length: 'long',   starts_at: mk(10, 30), status: 'confirmed' },
      { id: 'a2', client_name: 'Carmen Ortega',  service_name: 'barros',          hair_length: 'medium', starts_at: mk(12, 0),  status: 'booked' },
      { id: 'a3', client_name: 'Marta Jiménez',  service_name: 'cortar_y_peinar', hair_length: 'long',   starts_at: mk(15, 0),  status: 'booked' },
      { id: 'a4', client_name: 'Ana Torres',     service_name: 'tinte',           hair_length: 'medium', starts_at: mk(17, 0),  status: 'booked' }
    ];
    renderAll();
    return;
  }

  try {
    const [{ data: services }, { data: clients }, { data: appts }] = await Promise.all([
      state.supabase.from('services').select('*').order('name'),
      state.supabase.from('clients').select('*').order('full_name'),
      state.supabase.from('appointments_with_details').select('*').order('starts_at')
    ]);
    state.services = services || [];
    state.clients = clients || [];
    state.appointments = appts || [];
    renderAll();
  } catch (err) {
    showToast('Error al cargar datos: ' + err.message, 'err');
  }
}

function renderAll() {
  renderServices();
  renderClients();
  renderAppointments();
}

/* ── SAVE CLIENT ── */
async function saveClient(e) {
  e.preventDefault();
  const payload = {
    full_name: $('#clientName').value.trim(),
    phone: $('#clientPhone').value.trim(),
    notes: $('#clientNotes').value.trim()
  };
  if (state.supabase) {
    const { error } = await state.supabase.from('clients').insert(payload);
    if (error) return showToast(error.message, 'err');
    await fetchData();
  } else {
    state.clients.push({ id: crypto.randomUUID(), ...payload });
    renderClients();
  }
  document.getElementById('newClientModal').close();
  e.target.reset();
  showToast('Cliente guardado');
}

/* ── SAVE APPOINTMENT ── */
async function saveAppointment(e) {
  e.preventDefault();
  const serviceValue = $('#apptService').value;
  const hair_length = $('#apptHairLength').value;
  const starts_at = new Date(`${$('#apptDate').value}T${$('#apptTime').value}:00`).toISOString();
  const notes = $('#apptNotes').value.trim();
  const full_name = $('#apptClientName').value.trim();
  const phone = $('#apptClientPhone').value.trim();

  if (state.supabase) {
    let clientId = null;
    const existing = await state.supabase.from('clients').select('*').eq('phone', phone).maybeSingle();
    if (existing.data) clientId = existing.data.id;
    else {
      const inserted = await state.supabase.from('clients').insert({ full_name, phone }).select().single();
      if (inserted.error) return showToast(inserted.error.message, 'err');
      clientId = inserted.data.id;
    }
    const service = state.services.find(s => String(s.id) === String(serviceValue)) || state.services.find(s => s.name === serviceValue);
    const rpc = await state.supabase.rpc('create_appointment', {
      p_client_id: clientId,
      p_service_id: service.id,
      p_hair_length: hair_length,
      p_starts_at: starts_at,
      p_notes: notes || null
    });
    if (rpc.error) return showToast(rpc.error.message, 'err');
    await fetchData();
  } else {
    const allServices = state.services.length ? state.services : defaultServices;
    const service = allServices.find(s => (s.id || s.name) === serviceValue);
    state.appointments.push({
      id: crypto.randomUUID(),
      client_name: full_name,
      service_name: service?.name || serviceValue,
      hair_length,
      starts_at,
      status: 'booked',
      notes
    });
    renderAppointments();
  }

  document.getElementById('newAppointmentModal').close();
  e.target.reset();
  showToast('Cita guardada');
}

/* ── UPDATE STATUS ── */
async function updateAppointmentStatus(id, status) {
  if (state.supabase) {
    const { error } = await state.supabase.from('appointments').update({ status }).eq('id', id);
    if (error) return showToast(error.message, 'err');
    await fetchData();
  } else {
    const found = state.appointments.find(a => a.id === id);
    if (found) { found.status = status; renderAll(); }
  }
  showToast(`Estado: ${statusLabel(status)}`);
}

/* ── EVENTS ── */
function bindEvents() {
  $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  $$('[data-open-modal]').forEach(btn => btn.addEventListener('click', () => openModal(btn.dataset.openModal)));
  $('#settingsForm').addEventListener('submit', saveSettings);
  $('#clientForm').addEventListener('submit', saveClient);
  $('#appointmentForm').addEventListener('submit', saveAppointment);
  $('#refreshBtn').addEventListener('click', () => { fetchData(); showToast('Actualizando…'); });
  $('#dateFilter').value = new Date().toISOString().slice(0, 10);
  $('#dateFilter').addEventListener('change', renderAppointments);
}

/* ── INSTALL PWA ── */
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('#installBtn').classList.remove('hidden');
});
window.addEventListener('load', () => {
  $('#installBtn')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt = null;
    $('#installBtn').classList.add('hidden');
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }
});

/* ── SPLASH ── */
window.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  loadSettings();
  fetchData();

  setTimeout(() => {
    const splash = document.getElementById('splash');
    const app = document.getElementById('app');
    splash.classList.add('fade-out');
    app.classList.remove('app-hidden');
    app.classList.add('app-visible');
    setTimeout(() => splash.remove(), 600);
  }, 1400);
});

/* ── TOAST STYLES (injected) ── */
const toastStyle = document.createElement('style');
toastStyle.textContent = `
.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);
  background: #1c1c1c; border: 1px solid #333;
  color: #f0ece4; font-size: 13px; font-family: 'DM Sans', sans-serif;
  padding: 10px 20px; border-radius: 100px;
  opacity: 0; transition: all .25s ease; z-index: 9999;
  white-space: nowrap;
}
.toast-show { opacity: 1; transform: translateX(-50%) translateY(0); }
.toast-err { border-color: rgba(212,80,74,.4); background: #1f1515; }
`;
document.head.appendChild(toastStyle);
