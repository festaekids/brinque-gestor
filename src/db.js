import { supabase } from './supabaseClient';

// ============================================================
// HELPERS DE CONVERSÃO
// ============================================================

// Converte uma linha do banco (snake_case) para o formato usado pelo app (camelCase)
function rowToToy(row) {
  return {
    id: row.id, name: row.name, size: row.size || '',
    quantity: row.quantity ?? 0, price: row.price ?? '', image: row.image || null,
  };
}
function toyToRow(toy) {
  return {
    id: toy.id, name: toy.name, size: toy.size || '',
    quantity: Number(toy.quantity) || 0,
    price: toy.price === '' || toy.price == null ? null : Number(toy.price),
    image: toy.image || null,
  };
}

function rowToClient(row) {
  return {
    id: row.id, name: row.name, address: row.address || '',
    whatsapp: row.whatsapp || '', document: row.document || '',
    createdAt: row.created_at ? row.created_at.slice(0, 10) : '',
  };
}
function clientToRow(client) {
  return {
    id: client.id, name: client.name, address: client.address || '',
    whatsapp: client.whatsapp || '', document: client.document || '',
    created_at: client.createdAt || undefined,
  };
}

function rowToReservation(row) {
  return {
    id: row.id, clientId: row.client_id, address: row.address || '',
    startDate: row.start_date, startTime: row.start_time || '',
    endDate: row.end_date || '', endTime: row.end_time || '',
    items: row.items || [], total: row.total ?? 0, deposit: row.deposit ?? 0,
    notes: row.notes || '', status: row.status || 'pendente',
  };
}
function reservationToRow(r) {
  return {
    id: r.id, client_id: r.clientId || null, address: r.address || '',
    start_date: r.startDate, start_time: r.startTime || null,
    end_date: r.endDate || null, end_time: r.endTime || null,
    items: r.items || [], total: Number(r.total) || 0, deposit: Number(r.deposit) || 0,
    notes: r.notes || '', status: r.status || 'pendente',
  };
}

function rowToFinance(row) {
  return {
    id: row.id, type: row.type, description: row.description,
    amount: row.amount ?? 0, date: row.date, reservationId: row.reservation_id || null,
  };
}
function financeToRow(f) {
  return {
    id: f.id, type: f.type, description: f.description,
    amount: Number(f.amount) || 0, date: f.date, reservation_id: f.reservationId || null,
  };
}

function rowToCompany(row) {
  return {
    name: row.name || '', cnpj: row.cnpj || '', phone: row.phone || '',
    email: row.email || '', address: row.address || '', logo: row.logo || null,
  };
}

// ============================================================
// CARREGAMENTO INICIAL - busca tudo de uma vez
// ============================================================
export async function loadAllData() {
  const [toysRes, clientsRes, reservationsRes, financeRes, companyRes] = await Promise.all([
    supabase.from('toys').select('*').order('created_at', { ascending: true }),
    supabase.from('clients').select('*').order('created_at', { ascending: true }),
    supabase.from('reservations').select('*').order('start_date', { ascending: true }),
    supabase.from('finance').select('*').order('date', { ascending: true }),
    supabase.from('company').select('*').eq('id', 1).maybeSingle(),
  ]);

  const errors = [toysRes, clientsRes, reservationsRes, financeRes, companyRes]
    .map((r) => r.error).filter(Boolean);
  if (errors.length) {
    console.error('Erro ao carregar dados do Supabase:', errors);
    throw errors[0];
  }

  return {
    toys: (toysRes.data || []).map(rowToToy),
    clients: (clientsRes.data || []).map(rowToClient),
    reservations: (reservationsRes.data || []).map(rowToReservation),
    finance: (financeRes.data || []).map(rowToFinance),
    company: companyRes.data ? rowToCompany(companyRes.data) : { name: '', cnpj: '', phone: '', email: '', address: '', logo: null },
  };
}

// ============================================================
// BRINQUEDOS
// ============================================================
export async function upsertToy(toy) {
  const { error } = await supabase.from('toys').upsert(toyToRow(toy));
  if (error) throw error;
}
export async function deleteToy(id) {
  const { error } = await supabase.from('toys').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// CLIENTES
// ============================================================
export async function upsertClient(client) {
  const { error } = await supabase.from('clients').upsert(clientToRow(client));
  if (error) throw error;
}
export async function deleteClient(id) {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// RESERVAS
// ============================================================
export async function upsertReservation(reservation) {
  const { error } = await supabase.from('reservations').upsert(reservationToRow(reservation));
  if (error) throw error;
}
export async function deleteReservation(id) {
  const { error } = await supabase.from('reservations').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// FINANCEIRO
// ============================================================
export async function upsertFinance(entry) {
  const { error } = await supabase.from('finance').upsert(financeToRow(entry));
  if (error) throw error;
}
export async function deleteFinance(id) {
  const { error } = await supabase.from('finance').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// EMPRESA (linha única, id = 1)
// ============================================================
export async function saveCompany(company) {
  const { error } = await supabase.from('company').upsert({ id: 1, ...company });
  if (error) throw error;
}
