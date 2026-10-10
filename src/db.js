import { supabase } from './supabaseClient';

// ============================================================
// HELPERS DE CONVERSÃO
// ============================================================

// Converte uma linha do banco (snake_case) para o formato usado pelo app (camelCase)
function rowToToy(row) {
  return {
    id: row.id, name: row.name, size: row.size || '',
    quantity: row.quantity ?? 0, price: row.price ?? '',
    // image fica 'undefined' até ser carregada separadamente (loadToyImage).
    // Só vem preenchida se a linha trouxer a coluna.
    image: 'image' in row ? (row.image || null) : undefined,
  };
}
function toyToRow(toy) {
  return {
    id: toy.id, name: toy.name, size: toy.size || '',
    quantity: Number(toy.quantity) || 0,
    price: toy.price === '' || toy.price == null ? null : Number(toy.price),
    // Se a imagem ainda não foi carregada (undefined), NÃO envia a coluna,
    // para não apagar a foto que já está salva no banco.
    ...(toy.image !== undefined ? { image: toy.image || null } : {}),
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
    source: row.source || 'desconhecido',
  };
}
function reservationToRow(r) {
  return {
    id: r.id, client_id: r.clientId || null, address: r.address || '',
    start_date: r.startDate, start_time: r.startTime || null,
    end_date: r.endDate || null, end_time: r.endTime || null,
    items: r.items || [], total: Number(r.total) || 0, deposit: Number(r.deposit) || 0,
    notes: r.notes || '', status: r.status || 'pendente',
    source: r.source || 'desconhecido',
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
    email: row.email || '', address: row.address || '',
    logo: 'logo' in row ? (row.logo || null) : undefined,
  };
}

// ============================================================
// CARREGAMENTO INICIAL - busca tudo de uma vez
// ============================================================
export async function loadAllData() {
  const [toysRes, clientsRes, reservationsRes, financeRes, companyRes] = await Promise.all([
    // Sem a coluna 'image' (base64 pesado): as fotos são carregadas depois, uma a uma.
    supabase.from('toys').select('id,name,size,quantity,price,created_at').order('created_at', { ascending: true }),
    supabase.from('clients').select('*').order('created_at', { ascending: true }),
    supabase.from('reservations').select('*').order('start_date', { ascending: true }),
    supabase.from('finance').select('*').order('date', { ascending: true }),
    // Sem a coluna 'logo' (base64 pesado): carregada depois por loadCompanyLogo().
    supabase.from('company').select('id,name,cnpj,phone,email,address').eq('id', 1).maybeSingle(),
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
// IMAGENS (carregadas em segundo plano, uma por vez)
// ============================================================
export async function loadToyImage(id) {
  const { data, error } = await supabase.from('toys').select('image').eq('id', id).maybeSingle();
  if (error) throw error;
  return data?.image || null;
}
export async function loadCompanyLogo() {
  const { data, error } = await supabase.from('company').select('logo').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data?.logo || null;
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
  // Se a logo ainda não foi carregada (undefined), não envia a coluna.
  const payload = { id: 1, ...company };
  if (payload.logo === undefined) delete payload.logo;
  const { error } = await supabase.from('company').upsert(payload);
  if (error) throw error;
}