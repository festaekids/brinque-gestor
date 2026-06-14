import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard, ToyBrick, Users, CalendarDays, Search,
  FileText, Wallet, FileSignature, Receipt, BarChart3, Building2,
  Plus, Trash2, Pencil, X, Check, Eye, Download,
  PartyPopper, Sparkles, ChevronLeft, ChevronRight, Grid3x3, List,
  Image as ImageIcon, ArrowUpRight, ArrowDownRight, TrendingUp, LogOut, RefreshCw, Menu
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend
} from 'recharts';
import {
  loadAllData, upsertToy, deleteToy, upsertClient, deleteClient,
  upsertReservation, deleteReservation, upsertFinance, deleteFinance, saveCompany,
} from './db';
import { logout } from './LoginScreen';

// ============================================================
// VALORES INICIAIS (usados apenas antes de carregar do banco)
// ============================================================
const emptyCompany = { name: '', cnpj: '', phone: '', email: '', address: '', logo: null };

// ============================================================
// HELPERS
// ============================================================
const fmtMoney = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

// Compara prev/next (arrays de itens com `id`) e persiste as diferenças
// no Supabase: itens novos/alterados via upsertFn, itens removidos via deleteFn.
// Erros de rede são logados no console; o estado local já foi atualizado
// otimisticamente pelo chamador.
function syncArrayChanges(prev, next, upsertFn, deleteFn) {
  const prevIds = new Set(prev.map((x) => x.id));
  const nextIds = new Set(next.map((x) => x.id));

  for (const item of next) {
    const before = prev.find((x) => x.id === item.id);
    if (!before || JSON.stringify(before) !== JSON.stringify(item)) {
      upsertFn(item).catch((err) => console.error('Erro ao salvar:', err));
    }
  }
  for (const item of prev) {
    if (!nextIds.has(item.id)) {
      deleteFn(item.id).catch((err) => console.error('Erro ao excluir:', err));
    }
  }
}


const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const STATUS_STYLES = {
  pendente:  { bg: '#FFF3D6', text: '#A6660A', label: 'Pendente' },
  confirmado:{ bg: '#DBF6E5', text: '#1B8A4A', label: 'Confirmado' },
  concluido: { bg: '#E3E0FB', text: '#5B4FCF', label: 'Concluído' },
  cancelado: { bg: '#FCE0E4', text: '#C13B5A', label: 'Cancelado' },
};

// ============================================================
// COMPONENTES VISUAIS REUTILIZÁVEIS
// ============================================================
function PageHeader({ icon: Icon, title, subtitle, accent, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 18, background: accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 16px -6px rgba(0,0,0,0.18)', flexShrink: 0,
          }}>
            <Icon size={26} color="#fff" strokeWidth={2.3} />
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#3A3550', margin: 0, lineHeight: 1.15 }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: 14, color: '#8A84A3', margin: '4px 0 0' }}>{subtitle}</p>
            )}
          </div>
        </div>
        {children && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{children}</div>}
      </div>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 20, border: '1px solid #F0EDF7',
      boxShadow: '0 4px 18px -10px rgba(80,60,140,0.12)', padding: 22, ...style,
    }}>
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = 'primary', icon: Icon, style, type = 'button', disabled }) {
  const variants = {
    primary: { background: 'linear-gradient(135deg,#FF8FB1,#FF6B9D)', color: '#fff', border: 'none' },
    secondary: { background: '#fff', color: '#5B4FCF', border: '2px solid #E3E0FB' },
    success: { background: 'linear-gradient(135deg,#5EE6C0,#2BC99A)', color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#8A84A3', border: '1px solid #EFEBFA' },
    danger: { background: '#FFF0F2', color: '#D6486A', border: '1px solid #FCD9E1' },
    teal: { background: 'linear-gradient(135deg,#5FE3D6,#34C9D8)', color: '#fff', border: 'none' },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '11px 18px', borderRadius: 14, fontSize: 14.5, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
        transition: 'transform 0.12s ease, opacity 0.12s ease',
        opacity: disabled ? 0.55 : 1,
        ...variants[variant], ...style,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {Icon && <Icon size={17} strokeWidth={2.3} />}
      {children}
    </button>
  );
}

function Badge({ children, bg, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '4px 12px',
      borderRadius: 999, fontSize: 12.5, fontWeight: 700, background: bg, color,
    }}>
      {children}
    </span>
  );
}

function Field({ label, children, full }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      {label && (
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6F6A8A', marginBottom: 6 }}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 12,
  border: '1.5px solid #ECE8F7', fontSize: 14.5, fontFamily: 'var(--font-sans)',
  background: '#FBFAFF', color: '#3A3550', boxSizing: 'border-box',
  outline: 'none',
};

function Input(props) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
function Textarea(props) {
  return <textarea {...props} style={{ ...inputStyle, resize: 'vertical', minHeight: 80, ...(props.style || {}) }} />;
}
function Select(props) {
  return <select {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div style={{ textAlign: 'center', padding: '52px 20px', color: '#A39EC0' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%', background: '#F5F2FC',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
      }}>
        <Icon size={30} strokeWidth={1.8} color="#C7BFE8" />
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: '#6F6A8A', margin: '0 0 4px' }}>{title}</p>
      {subtitle && <p style={{ fontSize: 13.5, margin: 0 }}>{subtitle}</p>}
    </div>
  );
}

// Modal genérico
function Modal({ open, onClose, title, children, width = 560 }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(58,53,80,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 22, width: '100%', maxWidth: width,
          maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 60px -20px rgba(60,40,110,0.35)',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px', borderBottom: '1px solid #F2EFFB', position: 'sticky', top: 0, background: '#fff', borderRadius: '22px 22px 0 0',
        }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#3A3550', margin: 0 }}>
            {title}
          </h2>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 10, border: 'none', background: '#F5F2FC',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#8A84A3',
          }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: '#5B4FCF' },
  { id: 'toys', label: 'Brinquedos', icon: ToyBrick, color: '#FF6B9D' },
  { id: 'clients', label: 'Clientes', icon: Users, color: '#34C9D8' },
  { id: 'reservations', label: 'Reservas', icon: CalendarDays, color: '#FF9F4A' },
  { id: 'availability', label: 'Disponibilidade', icon: Search, color: '#2BC99A' },
  { id: 'budgets', label: 'Orçamentos', icon: FileText, color: '#9B5DE5' },
  { id: 'finance', label: 'Financeiro', icon: Wallet, color: '#2BC99A' },
  { id: 'contracts', label: 'Contratos', icon: FileSignature, color: '#5B4FCF' },
  { id: 'receipts', label: 'Recibos', icon: Receipt, color: '#FF6B9D' },
  { id: 'stats', label: 'Estatísticas', icon: BarChart3, color: '#34C9D8' },
  { id: 'company', label: 'Empresa', icon: Building2, color: '#8A84A3' },
];

function Sidebar({ active, setActive, companyName, onLogout, syncing, mobileOpen, onMobileClose }) {
  const NavContent = () => (
    <>
      <div style={{ padding: '24px 20px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 14,
          background: 'linear-gradient(135deg,#FFB84C,#FF6B9D)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 14px -6px rgba(255,107,157,0.5)', flexShrink: 0,
        }}>
          <PartyPopper size={22} color="#fff" strokeWidth={2.3} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: '#3A3550', margin: 0, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {companyName || 'BrincaGestor'}
          </p>
          <p style={{ fontSize: 11.5, color: '#B6AFD6', margin: 0, letterSpacing: 0.4 }}>gestão de locação</p>
        </div>
        {/* Botão fechar no mobile */}
        <button onClick={onMobileClose} style={{
          display: 'none', width: 32, height: 32, borderRadius: 10, border: 'none',
          background: '#F5F2FC', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#8A84A3', flexShrink: 0,
          ['@media (max-width: 768px)']: { display: 'flex' },
        }} className="sidebar-close-btn">
          <X size={18} />
        </button>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 12px' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => { setActive(item.id); onMobileClose(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '13px 14px', marginBottom: 4, borderRadius: 14,
                border: 'none', cursor: 'pointer', textAlign: 'left',
                background: isActive ? `${item.color}18` : 'transparent',
                color: isActive ? item.color : '#8A84A3',
                fontWeight: isActive ? 700 : 600, fontSize: 15,
                fontFamily: 'var(--font-sans)', transition: 'all 0.12s ease',
              }}
            >
              <Icon size={20} strokeWidth={2.2} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: 16, borderTop: '1px solid #F1EEFA', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{
          background: 'linear-gradient(135deg,#F5F2FC,#FCF4FF)', borderRadius: 16,
          padding: 14, display: 'flex', alignItems: 'center', gap: 10, minHeight: 48,
        }}>
          <Sparkles size={20} color="#9B5DE5" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: '#5B4FCF', margin: 0 }}>
              {syncing ? 'Salvando...' : 'Dados sincronizados'}
            </p>
            <p style={{ fontSize: 11, color: '#A39EC0', margin: 0 }}>compartilhado na nuvem</p>
          </div>
        </div>
        <button onClick={onLogout} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '10px 14px', borderRadius: 14,
          border: '1px solid #F2EFFB', background: 'transparent', cursor: 'pointer',
          color: '#A39EC0', fontWeight: 700, fontSize: 13.5, fontFamily: 'var(--font-sans)',
        }}>
          <LogOut size={16} strokeWidth={2.2} /> Sair
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* CSS global para responsividade */}
      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .sidebar-close-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .sidebar-overlay { display: none !important; }
          .sidebar-drawer { display: none !important; }
        }
      `}</style>

      {/* Sidebar desktop (fixa, visível só em tela grande) */}
      <aside className="sidebar-desktop" style={{
        width: 232, background: '#fff', borderRight: '1px solid #F1EEFA',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        height: '100vh', position: 'sticky', top: 0,
      }}>
        <NavContent />
      </aside>

      {/* Overlay escuro ao abrir menu no mobile */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={onMobileClose} style={{
          position: 'fixed', inset: 0, background: 'rgba(58,53,80,0.45)',
          zIndex: 200, touchAction: 'none',
        }} />
      )}

      {/* Drawer mobile (desliza da esquerda) */}
      <aside className="sidebar-drawer" style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 280,
        background: '#fff', display: 'flex', flexDirection: 'column',
        zIndex: 201, overflowY: 'auto',
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: mobileOpen ? '4px 0 24px rgba(60,40,110,0.18)' : 'none',
      }}>
        <NavContent />
      </aside>
    </>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ reservations, clients, toys, setActive }) {
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [clientFilter, setClientFilter] = useState('');
  const [toyFilter, setToyFilter] = useState('');

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      if (r.startDate < startDate || r.startDate > endDate) return false;
      if (clientFilter && r.clientId !== clientFilter) return false;
      if (toyFilter && !r.items.some((i) => i.toyId === toyFilter)) return false;
      return true;
    });
  }, [reservations, startDate, endDate, clientFilter, toyFilter]);

  const totalToysRented = filtered.reduce(
    (sum, r) => sum + r.items.reduce((s, i) => s + i.quantity, 0), 0
  );
  const expectedRevenue = filtered.reduce((sum, r) => sum + (r.total || 0), 0);

  const getClient = (id) => clients.find((c) => c.id === id);
  const getToy = (id) => toys.find((t) => t.id === id);

  return (
    <div>
      <PageHeader icon={LayoutDashboard} title="Dashboard" subtitle="Resumo das reservas do período selecionado" accent="linear-gradient(135deg,#7F77DD,#5B4FCF)">
        <Button variant="secondary" icon={Download}>PDF completo</Button>
        <Button variant="ghost" icon={Download}>PDF sem valores</Button>
      </PageHeader>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
          <Field label="Data inicial"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
          <Field label="Data final"><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          <Field label="Cliente">
            <Select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
              <option value="">Todos os clientes</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Brinquedo">
            <Select value={toyFilter} onChange={(e) => setToyFilter(e.target.value)}>
              <option value="">Todos os brinquedos</option>
              {toys.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBottom: 20 }}>
        <StatCard icon={CalendarDays} label="Reservas no período" value={filtered.length} color="#5B4FCF" bg="#EFEDFC" />
        <StatCard icon={ToyBrick} label="Brinquedos alugados" value={totalToysRented} color="#FF6B9D" bg="#FFEBF1" />
        <StatCard icon={Wallet} label="Receita prevista" value={fmtMoney(expectedRevenue)} color="#2BC99A" bg="#E4FAF1" />
      </div>

      <Card>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#3A3550', margin: '0 0 16px' }}>
          Reservas recentes
        </h3>
        {filtered.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Nenhuma reserva no período" subtitle="Ajuste os filtros ou crie uma nova reserva." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#A39EC0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <th style={{ padding: '0 10px 10px 0' }}>Cliente</th>
                  <th style={{ padding: '0 10px 10px' }}>Endereço</th>
                  <th style={{ padding: '0 10px 10px' }}>Data / Horário</th>
                  <th style={{ padding: '0 10px 10px' }}>Brinquedos</th>
                  <th style={{ padding: '0 10px 10px' }}>Valores</th>
                  <th style={{ padding: '0 10px 10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const client = getClient(r.clientId);
                  const st = STATUS_STYLES[r.status] || STATUS_STYLES.pendente;
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid #F4F1FB' }}>
                      <td style={{ padding: '12px 10px 12px 0', fontWeight: 700, color: '#3A3550' }}>
                        {client?.name || '—'}
                        <div style={{ fontSize: 12, color: '#B6AFD6', fontWeight: 500 }}>{client?.whatsapp}</div>
                      </td>
                      <td style={{ padding: '12px 10px', color: '#6F6A8A' }}>{r.address}</td>
                      <td style={{ padding: '12px 10px', color: '#6F6A8A', whiteSpace: 'nowrap' }}>
                        {fmtDate(r.startDate)}<br />{r.startTime} – {r.endTime}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {r.items.map((i, idx) => {
                            const toy = getToy(i.toyId);
                            return <Badge key={idx} bg="#E4FAF1" color="#1B8A4A">{i.quantity}× {toy?.name}</Badge>;
                          })}
                        </div>
                      </td>
                      <td style={{ padding: '12px 10px', color: '#3A3550', whiteSpace: 'nowrap' }}>
                        <div>Total: <b>{fmtMoney(r.total)}</b></div>
                        <div style={{ fontSize: 12, color: '#A39EC0' }}>Sinal: {fmtMoney(r.deposit)} · Resta: {fmtMoney(r.total - r.deposit)}</div>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <Badge bg={st.bg} color={st.text}>{st.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ fontSize: 12.5, color: '#B6AFD6', marginTop: 14, marginBottom: 0 }}>
          Mostrando {filtered.length} de {reservations.length} reservas
        </p>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <Card style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 20 }}>
      <div style={{ width: 50, height: 50, borderRadius: 16, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={24} color={color} strokeWidth={2.2} />
      </div>
      <div>
        <p style={{ fontSize: 12.5, color: '#A39EC0', fontWeight: 600, margin: '0 0 2px' }}>{label}</p>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: '#3A3550', margin: 0 }}>{value}</p>
      </div>
    </Card>
  );
}

// ============================================================
// BRINQUEDOS
// ============================================================
function ToyForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name: '', size: '', quantity: 1, price: '', image: null });

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, image: reader.result }));
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Imagem do brinquedo">
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          border: '2px dashed #E3E0FB', borderRadius: 16, padding: 24, cursor: 'pointer',
          background: '#FBFAFF', gap: 8, textAlign: 'center',
          backgroundImage: form.image ? `url(${form.image})` : 'none',
          backgroundSize: 'cover', backgroundPosition: 'center', minHeight: 140,
        }}>
          {!form.image && (
            <>
              <ImageIcon size={28} color="#C7BFE8" />
              <span style={{ fontSize: 13.5, color: '#8A84A3', fontWeight: 600 }}>Clique para enviar uma imagem</span>
              <span style={{ fontSize: 12, color: '#C7BFE8' }}>PNG ou JPG, máx. 5MB</span>
            </>
          )}
          <input type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
        </label>
      </Field>
      <Field label="Nome do brinquedo">
        <Input placeholder="Ex: Pula-Pula Grande" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Tamanho">
          <Input placeholder="Ex: 4m x 4m x 3m" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
        </Field>
        <Field label="Quantidade disponível">
          <Input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
        </Field>
      </div>
      <Field label="Valor da diária (R$)">
        <Input type="number" min={0} placeholder="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(form)} disabled={!form.name}>Salvar brinquedo</Button>
      </div>
    </div>
  );
}

function ToysPage({ toys, setToys }) {
  const [view, setView] = useState('grid');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (toy) => { setEditing(toy); setModalOpen(true); };

  const handleSave = (form) => {
    if (editing) {
      setToys((prev) => prev.map((t) => (t.id === editing.id ? { ...t, ...form } : t)));
    } else {
      setToys((prev) => [...prev, { id: uid('t'), ...form }]);
    }
    setModalOpen(false);
  };

  const handleDelete = (id) => setToys((prev) => prev.filter((t) => t.id !== id));

  return (
    <div>
      <PageHeader icon={ToyBrick} title="Gerenciamento de brinquedos" subtitle="Cadastre e gerencie o catálogo de brinquedos" accent="linear-gradient(135deg,#FF9FBE,#FF6B9D)">
        <Button icon={Plus} onClick={openNew}>Adicionar brinquedo</Button>
      </PageHeader>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#8A84A3' }}>Visualização:</span>
        <ViewToggle view={view} setView={setView} />
      </div>

      <Card>
        {toys.length === 0 ? (
          <EmptyState icon={ToyBrick} title="Nenhum brinquedo cadastrado" subtitle="Comece adicionando seu primeiro brinquedo ao catálogo" />
        ) : view === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 18 }}>
            {toys.map((toy) => (
              <div key={toy.id} style={{ borderRadius: 18, border: '1px solid #F2EFFB', overflow: 'hidden' }}>
                <div style={{
                  height: 140, background: toy.image ? `url(${toy.image}) center/cover` : 'linear-gradient(135deg,#FCEFFF,#F1EEFD)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                }}>
                  {!toy.image && <ToyBrick size={36} color="#D8CFF7" />}
                  <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                    <IconBtn icon={Pencil} onClick={() => openEdit(toy)} bg="#fff" color="#5B4FCF" />
                    <IconBtn icon={Trash2} onClick={() => handleDelete(toy.id)} bg="#fff" color="#D6486A" />
                  </div>
                </div>
                <div style={{ padding: 14 }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15.5, color: '#3A3550', margin: '0 0 4px' }}>{toy.name}</p>
                  <p style={{ fontSize: 12.5, color: '#A39EC0', margin: '0 0 8px' }}>Tamanho: {toy.size || '—'}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Badge bg="#E4FAF1" color="#1B8A4A">{toy.quantity} disponí{toy.quantity === 1 ? 'vel' : 'veis'}</Badge>
                    {toy.price !== '' && toy.price != null && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#5B4FCF' }}>{fmtMoney(toy.price)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {toys.map((toy) => (
              <div key={toy.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: 12,
                border: '1px solid #F2EFFB', borderRadius: 16,
              }}>
                <div style={{
                  width: 58, height: 58, borderRadius: 12, flexShrink: 0,
                  background: toy.image ? `url(${toy.image}) center/cover` : 'linear-gradient(135deg,#FCEFFF,#F1EEFD)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {!toy.image && <ToyBrick size={24} color="#D8CFF7" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: '#3A3550', margin: 0 }}>{toy.name}</p>
                  <p style={{ fontSize: 12.5, color: '#A39EC0', margin: '2px 0 0' }}>Tamanho: {toy.size || '—'}</p>
                </div>
                <Badge bg="#E4FAF1" color="#1B8A4A">{toy.quantity} disponí{toy.quantity === 1 ? 'vel' : 'veis'}</Badge>
                {toy.price !== '' && toy.price != null && (
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#5B4FCF', minWidth: 80, textAlign: 'right' }}>{fmtMoney(toy.price)}</span>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <IconBtn icon={Pencil} onClick={() => openEdit(toy)} bg="#F5F2FC" color="#5B4FCF" />
                  <IconBtn icon={Trash2} onClick={() => handleDelete(toy.id)} bg="#FFF0F2" color="#D6486A" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar brinquedo' : 'Novo brinquedo'}>
        <ToyForm initial={editing} onSave={handleSave} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}

function ViewToggle({ view, setView }) {
  return (
    <div style={{ display: 'flex', background: '#F5F2FC', borderRadius: 12, padding: 4, gap: 4 }}>
      {[{ id: 'grid', icon: Grid3x3 }, { id: 'list', icon: List }].map((v) => (
        <button key={v.id} onClick={() => setView(v.id)} style={{
          width: 34, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: view === v.id ? '#fff' : 'transparent',
          color: view === v.id ? '#5B4FCF' : '#A39EC0',
          boxShadow: view === v.id ? '0 2px 8px -3px rgba(91,79,207,0.4)' : 'none',
        }}>
          <v.icon size={16} />
        </button>
      ))}
    </div>
  );
}

function IconBtn({ icon: Icon, onClick, bg, color, title }) {
  return (
    <button title={title} onClick={onClick} style={{
      width: 32, height: 32, borderRadius: 9, border: 'none', cursor: 'pointer',
      background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={15} strokeWidth={2.3} />
    </button>
  );
}

// ============================================================
// CLIENTES
// ============================================================
function ClientForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name: '', address: '', whatsapp: '', document: '' });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Nome">
        <Input placeholder="Nome completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Endereço">
        <Input placeholder="Endereço completo" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </Field>
      <Field label="WhatsApp">
        <Input placeholder="(00) 00000-0000" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
      </Field>
      <Field label="Documento (opcional)">
        <Input placeholder="CPF ou CNPJ" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(form)} disabled={!form.name}>Salvar cliente</Button>
      </div>
    </div>
  );
}

function ClientsPage({ clients, setClients, reservations }) {
  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = clients.filter((c) => {
    const matchSearch = [c.name, c.whatsapp, c.address].join(' ').toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filterMonth !== '' && filterYear !== '') {
      const d = new Date(c.createdAt);
      if (d.getMonth() !== Number(filterMonth) || d.getFullYear() !== Number(filterYear)) return false;
    }
    return true;
  });

  const years = [...new Set(clients.map((c) => new Date(c.createdAt).getFullYear()))].sort((a, b) => b - a);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (c) => { setEditing(c); setModalOpen(true); };

  const handleSave = (form) => {
    if (editing) {
      setClients((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...form } : c)));
    } else {
      setClients((prev) => [...prev, { id: uid('c'), createdAt: todayISO(), ...form }]);
    }
    setModalOpen(false);
  };

  const handleDelete = (id) => {
    const inUse = reservations.some((r) => r.clientId === id);
    if (inUse && !window.confirm('Este cliente possui reservas associadas. Excluir mesmo assim?')) return;
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  const exportExcel = () => {
    const header = ['Nome', 'Endereço', 'WhatsApp', 'Documento', 'Data de cadastro'];
    const rows = filtered.map((c) => [c.name, c.address, c.whatsapp, c.document, fmtDate(c.createdAt)]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${(v || '').toString().replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'clientes.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader icon={Users} title="Cadastro de clientes" subtitle="Gerencie seus clientes" accent="linear-gradient(135deg,#6FE3EE,#34C9D8)">
        <Button variant="secondary" icon={Download} onClick={exportExcel}>Exportar CSV</Button>
        <Button icon={Plus} onClick={openNew}>Novo cliente</Button>
      </PageHeader>

      <Card>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input placeholder="Buscar por nome, telefone ou endereço..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <Select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={{ width: 130 }}>
            <option value="">Todos os meses</option>
            {MONTHS_PT.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </Select>
          <Select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} style={{ width: 100 }}>
            <option value="">Todos os anos</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum cliente cadastrado" subtitle="Comece adicionando seu primeiro cliente" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#A39EC0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <th style={{ padding: '0 10px 10px 0' }}>Nome</th>
                  <th style={{ padding: '0 10px 10px' }}>Endereço</th>
                  <th style={{ padding: '0 10px 10px' }}>WhatsApp</th>
                  <th style={{ padding: '0 10px 10px' }}>Cadastro</th>
                  <th style={{ padding: '0 10px 10px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} style={{ borderTop: '1px solid #F4F1FB' }}>
                    <td style={{ padding: '12px 10px 12px 0', fontWeight: 700, color: '#3A3550' }}>{c.name}</td>
                    <td style={{ padding: '12px 10px', color: '#6F6A8A' }}>{c.address}</td>
                    <td style={{ padding: '12px 10px', color: '#6F6A8A' }}>{c.whatsapp}</td>
                    <td style={{ padding: '12px 10px', color: '#6F6A8A' }}>{fmtDate(c.createdAt)}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <IconBtn icon={Pencil} onClick={() => openEdit(c)} bg="#F5F2FC" color="#5B4FCF" />
                        <IconBtn icon={Trash2} onClick={() => handleDelete(c.id)} bg="#FFF0F2" color="#D6486A" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar cliente' : 'Novo cliente'}>
        <ClientForm initial={editing} onSave={handleSave} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}

// ============================================================
// LÓGICA DE DISPONIBILIDADE (compartilhada)
// ============================================================
// Verifica se dois intervalos de data/hora se sobrepõem
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function toDateTime(date, time) {
  return new Date(`${date}T${time || '00:00'}`);
}

// Retorna a quantidade já reservada de um brinquedo no intervalo informado,
// excluindo opcionalmente uma reserva (para edição) e considerando apenas
// reservas não canceladas.
function getReservedQuantity(toyId, startDate, startTime, endDate, endTime, reservations, excludeId) {
  const s = toDateTime(startDate, startTime || '00:00');
  const e = toDateTime(endDate || startDate, endTime || '23:59');
  let total = 0;
  for (const r of reservations) {
    if (r.id === excludeId) continue;
    if (r.status === 'cancelado') continue;
    const rs = toDateTime(r.startDate, r.startTime || '00:00');
    const re = toDateTime(r.endDate || r.startDate, r.endTime || '23:59');
    if (!rangesOverlap(s, e, rs, re)) continue;
    const item = r.items.find((i) => i.toyId === toyId);
    if (item) total += item.quantity;
  }
  return total;
}

// ============================================================
// RESERVAS
// ============================================================
function ReservationForm({ initial, toys, clients, reservations, onSave, onCancel, setClients }) {
  const [form, setForm] = useState(initial || {
    clientId: '', address: '',
    startDate: todayISO(), startTime: '10:00',
    endDate: '', endTime: '14:00',
    items: [], total: '', deposit: '', notes: '', status: 'pendente',
  });
  const [clientSearch, setClientSearch] = useState('');
  const [showClientList, setShowClientList] = useState(false);
  const [quickClientOpen, setQuickClientOpen] = useState(false);

  const selectedClient = clients.find((c) => c.id === form.clientId);
  const clientResults = clients.filter((c) =>
    [c.name, c.whatsapp, c.address].join(' ').toLowerCase().includes(clientSearch.toLowerCase())
  );

  const hasDateTime = form.startDate && form.startTime && form.endTime;
  const effectiveEndDate = form.endDate || form.startDate;

  const availableToys = useMemo(() => {
    if (!hasDateTime) return [];
    return toys.map((toy) => {
      const reservedQty = getReservedQuantity(
        toy.id, form.startDate, form.startTime, effectiveEndDate, form.endTime,
        reservations, initial?.id
      );
      const free = Math.max(0, toy.quantity - reservedQty);
      return { ...toy, free };
    });
  }, [toys, hasDateTime, form.startDate, form.startTime, effectiveEndDate, form.endTime, reservations, initial]);

  const [toySearch, setToySearch] = useState('');
  const visibleToys = availableToys.filter((t) => t.name.toLowerCase().includes(toySearch.toLowerCase()));

  const toggleToy = (toyId, free) => {
    setForm((f) => {
      const exists = f.items.find((i) => i.toyId === toyId);
      if (exists) {
        return { ...f, items: f.items.filter((i) => i.toyId !== toyId) };
      }
      if (free <= 0) return f;
      return { ...f, items: [...f.items, { toyId, quantity: 1 }] };
    });
  };

  const setItemQty = (toyId, qty, free) => {
    const q = Math.max(1, Math.min(qty, free));
    setForm((f) => ({ ...f, items: f.items.map((i) => (i.toyId === toyId ? { ...i, quantity: q } : i)) }));
  };

  const remaining = (Number(form.total) || 0) - (Number(form.deposit) || 0);

  const canSave = form.clientId && form.address && form.startDate && form.startTime && form.endTime && form.items.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Cliente">
        {selectedClient ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 14px', borderRadius: 12, background: '#F5F2FC', border: '1.5px solid #ECE8F7',
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#3A3550' }}>{selectedClient.name}</p>
              <p style={{ margin: 0, fontSize: 12.5, color: '#A39EC0' }}>{selectedClient.whatsapp}</p>
            </div>
            <Button variant="ghost" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setForm({ ...form, clientId: '' })}>Trocar</Button>
          </div>
        ) : (
          <div>
            <div style={{ position: 'relative' }}>
              <Input
                placeholder="Buscar cliente por nome, telefone ou endereço..."
                value={clientSearch}
                onFocus={() => setShowClientList(true)}
                onChange={(e) => { setClientSearch(e.target.value); setShowClientList(true); }}
              />
              {showClientList && clientSearch && (
                <div style={{
                  position: 'absolute', top: '110%', left: 0, right: 0, background: '#fff',
                  border: '1px solid #ECE8F7', borderRadius: 12, boxShadow: '0 10px 24px -10px rgba(60,40,110,0.2)',
                  zIndex: 10, maxHeight: 180, overflowY: 'auto',
                }}>
                  {clientResults.length === 0 ? (
                    <div style={{ padding: 12, fontSize: 13, color: '#A39EC0' }}>Nenhum cliente encontrado</div>
                  ) : clientResults.map((c) => (
                    <div key={c.id}
                      onClick={() => { setForm({ ...form, clientId: c.id, address: form.address || c.address }); setClientSearch(''); setShowClientList(false); }}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F4F1FB' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#FAF8FE'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#3A3550' }}>{c.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#A39EC0' }}>{c.whatsapp} · {c.address}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setQuickClientOpen(true)} style={{
              background: 'none', border: 'none', color: '#5B4FCF', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', padding: '8px 0 0', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Plus size={14} /> Cadastrar novo cliente
            </button>
          </div>
        )}
      </Field>

      <Field label="Endereço da festa">
        <Input placeholder="Digite o endereço da festa" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </Field>

      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#3A3550', margin: '0 0 10px' }}>Data e horário de início</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Data de início"><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="Hora de início"><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></Field>
        </div>
      </div>

      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#3A3550', margin: '0 0 10px' }}>Data e horário de término</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Data de término"><Input type="date" value={form.endDate} placeholder={form.startDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
          <Field label="Hora de término"><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></Field>
        </div>
      </div>

      <Field label="Brinquedos disponíveis">
        {!hasDateTime ? (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: '#A39EC0', background: '#FBFAFF', borderRadius: 12, border: '1.5px dashed #ECE8F7' }}>
            Informe a data e horário para ver os brinquedos disponíveis
          </div>
        ) : (
          <>
            <Input placeholder="Buscar brinquedos..." value={toySearch} onChange={(e) => setToySearch(e.target.value)} style={{ marginBottom: 10 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
              {visibleToys.map((toy) => {
                const selected = form.items.find((i) => i.toyId === toy.id);
                const disabled = !selected && toy.free <= 0;
                return (
                  <div key={toy.id} onClick={() => !disabled && toggleToy(toy.id, toy.free)} style={{
                    border: `1.5px solid ${selected ? '#5B4FCF' : '#ECE8F7'}`,
                    background: selected ? '#F2EFFC' : disabled ? '#FAFAFC' : '#fff',
                    borderRadius: 14, padding: 12, cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.55 : 1, position: 'relative',
                  }}>
                    {selected && (
                      <div style={{ position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: '50%', background: '#5B4FCF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={12} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#3A3550', paddingRight: 24 }}>{toy.name}</p>
                    <p style={{ margin: '2px 0 6px', fontSize: 12, color: '#A39EC0' }}>Tamanho: {toy.size || '—'}</p>
                    <Badge bg={toy.free > 0 ? '#E4FAF1' : '#FCE0E4'} color={toy.free > 0 ? '#1B8A4A' : '#C13B5A'}>
                      {toy.free} disponí{toy.free === 1 ? 'vel' : 'veis'}
                    </Badge>
                    {selected && (
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                        <span style={{ fontSize: 12, color: '#6F6A8A', fontWeight: 600 }}>Qtd:</span>
                        <Input type="number" min={1} max={toy.free} value={selected.quantity}
                          onChange={(e) => setItemQty(toy.id, Number(e.target.value), toy.free)}
                          style={{ width: 60, padding: '6px 8px' }} />
                        <span style={{ fontSize: 11.5, color: '#C7BFE8' }}>(máx: {toy.free})</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {visibleToys.length === 0 && (
                <p style={{ fontSize: 13, color: '#A39EC0', gridColumn: '1/-1' }}>Nenhum brinquedo encontrado.</p>
              )}
            </div>
          </>
        )}
      </Field>

      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#3A3550', margin: '0 0 10px' }}>Valores</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label="Valor total (R$)"><Input type="number" min={0} placeholder="0" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} /></Field>
          <Field label="Valor do sinal (R$)"><Input type="number" min={0} placeholder="0" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} /></Field>
          <Field label="Valor restante (R$)"><Input readOnly value={fmtMoney(remaining)} style={{ background: '#F5F2FC', color: '#5B4FCF', fontWeight: 700 }} /></Field>
        </div>
      </div>

      <Field label="Status">
        <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="pendente">Pendente</option>
          <option value="confirmado">Confirmado</option>
          <option value="concluido">Concluído</option>
          <option value="cancelado">Cancelado</option>
        </Select>
      </Field>

      <Field label="Observações">
        <Textarea placeholder="Adicione observações relevantes sobre a reserva..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(form)} disabled={!canSave}>Salvar reserva</Button>
      </div>

      <Modal open={quickClientOpen} onClose={() => setQuickClientOpen(false)} title="Novo cliente" width={460}>
        <ClientForm onSave={(cf) => {
          const newClient = { id: uid('c'), createdAt: todayISO(), ...cf };
          setClients((prev) => [...prev, newClient]);
          setForm((f) => ({ ...f, clientId: newClient.id, address: f.address || newClient.address }));
          setQuickClientOpen(false);
        }} onCancel={() => setQuickClientOpen(false)} />
      </Modal>
    </div>
  );
}

function pad2(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

function buildCalendarGrid(year, month) {
  // month: 0-indexed. Retorna 35 ou 42 células, cada uma com { day, current, iso }
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - startWeekday + 1; // 1 = primeiro dia do mês
    const d = new Date(year, month, dayOffset);
    cells.push({ day: d.getDate(), current: d.getMonth() === month, iso: toISO(d) });
  }
  return cells;
}

function ReservationsPage({ reservations, setReservations, toys, clients, setClients }) {
  const [refDate, setRefDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [viewingReservation, setViewingReservation] = useState(null);

  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const cells = useMemo(() => buildCalendarGrid(year, month), [year, month]);

  const reservationsByDay = useMemo(() => {
    const map = {};
    for (const r of reservations) {
      const key = r.startDate;
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [reservations]);

  const todayIso = todayISO();

  const dayReservations = selectedDay
    ? reservations.filter((r) => r.startDate === selectedDay)
    : reservations.filter((r) => {
        const d = new Date(r.startDate);
        return d.getFullYear() === year && d.getMonth() === month;
      });

  const goMonth = (delta) => {
    const d = new Date(refDate);
    d.setMonth(d.getMonth() + delta);
    setRefDate(d);
    setSelectedDay(null);
  };

  const openNew = (dayIso) => {
    setEditing(dayIso ? { startDate: dayIso, startTime: '10:00', endDate: dayIso, endTime: '14:00', clientId: '', address: '', items: [], total: '', deposit: '', notes: '', status: 'pendente' } : null);
    setModalOpen(true);
  };
  const openEdit = (r) => { setEditing(r); setModalOpen(true); };

  const handleSave = (form) => {
    if (editing?.id) {
      setReservations((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...form } : r)));
    } else {
      setReservations((prev) => [...prev, { id: uid('r'), ...form }]);
    }
    setModalOpen(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('Excluir esta reserva?')) {
      setReservations((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const cycleStatus = (r) => {
    const order = ['pendente', 'confirmado', 'concluido', 'cancelado'];
    const idx = order.indexOf(r.status);
    const next = order[(idx + 1) % order.length];
    setReservations((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: next } : x)));
  };

  const getClient = (id) => clients.find((c) => c.id === id);
  const getToy = (id) => toys.find((t) => t.id === id);

  return (
    <div>
      <PageHeader icon={CalendarDays} title="Gerenciamento de reservas" subtitle="Crie e gerencie as reservas de brinquedos" accent="linear-gradient(135deg,#FFB870,#FF9F4A)">
        <Select value={month} onChange={(e) => { const d = new Date(refDate); d.setMonth(Number(e.target.value)); setRefDate(d); setSelectedDay(null); }} style={{ width: 130 }}>
          {MONTHS_PT.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </Select>
        <Select value={year} onChange={(e) => { const d = new Date(refDate); d.setFullYear(Number(e.target.value)); setRefDate(d); setSelectedDay(null); }} style={{ width: 90 }}>
          {[year - 1, year, year + 1, year + 2].map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Button icon={Plus} onClick={() => openNew(null)}>Nova reserva</Button>
      </PageHeader>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#3A3550', margin: 0, textTransform: 'capitalize' }}>
            {MONTHS_PT[month].toLowerCase()} {year}
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <IconBtn icon={ChevronLeft} onClick={() => goMonth(-1)} bg="#F5F2FC" color="#5B4FCF" />
            <IconBtn icon={ChevronRight} onClick={() => goMonth(1)} bg="#F5F2FC" color="#5B4FCF" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
          {WEEKDAYS_PT.map((w) => (
            <div key={w} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#B6AFD6', padding: '4px 0' }}>{w}</div>
          ))}
          {cells.map((cell, idx) => {
            const iso = cell.iso;
            const count = reservationsByDay[iso] || 0;
            const isToday = iso === todayIso;
            const isSelected = selectedDay === iso;
            return (
              <div
                key={idx}
                onClick={() => setSelectedDay(isSelected ? null : iso)}
                style={{
                  minHeight: 64, borderRadius: 12, padding: '8px 8px',
                  border: isSelected ? '2px solid #5B4FCF' : isToday ? '2px solid #FFB870' : '1px solid #F4F1FB',
                  background: cell.current ? (isSelected ? '#F2EFFC' : '#fff') : '#FBFAFD',
                  color: cell.current ? '#3A3550' : '#D8D4EA',
                  cursor: 'pointer', position: 'relative', fontSize: 13.5, fontWeight: isToday ? 800 : 600,
                }}
              >
                {cell.day}
                {count > 0 && (
                  <div style={{
                    position: 'absolute', bottom: 8, left: 8, right: 8,
                    background: '#FFE3CC', color: '#C16B1E', borderRadius: 8,
                    fontSize: 11, fontWeight: 700, textAlign: 'center', padding: '2px 0',
                  }}>
                    {count} reserva{count > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#3A3550', margin: 0 }}>
            {selectedDay ? `Reservas em ${fmtDate(selectedDay)}` : `Todas as reservas de ${MONTHS_PT[month].toLowerCase()}`}
          </h3>
          {selectedDay && (
            <Button variant="secondary" icon={Plus} onClick={() => openNew(selectedDay)} style={{ padding: '8px 14px', fontSize: 13.5 }}>
              Nova reserva neste dia
            </Button>
          )}
        </div>

        {dayReservations.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Nenhuma reserva encontrada" subtitle='Clique em "Nova reserva" para criar uma.' />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#A39EC0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #F4F1FB' }}>
                  <th style={{ padding: '0 10px 12px 0' }}>Cliente</th>
                  <th style={{ padding: '0 10px 12px' }}>Endereço da festa</th>
                  <th style={{ padding: '0 10px 12px' }}>Data e Horário</th>
                  <th style={{ padding: '0 10px 12px' }}>Brinquedo</th>
                  <th style={{ padding: '0 10px 12px' }}>Valores</th>
                  <th style={{ padding: '0 10px 12px' }}>Status</th>
                  <th style={{ padding: '0 10px 12px' }}>Observações</th>
                  <th style={{ padding: '0 10px 12px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dayReservations.map((r) => {
                  const client = getClient(r.clientId);
                  const st = STATUS_STYLES[r.status] || STATUS_STYLES.pendente;
                  const remaining = (Number(r.total) || 0) - (Number(r.deposit) || 0);
                  const toysList = r.items.map((i) => { const t = getToy(i.toyId); return `${i.quantity} ${t?.name || '—'}`; }).join(', ');
                  const wMsg = `Parabéns, ${client?.name}! Sua reserva está confirmada.\n\nData e horário do evento: ${fmtDate(r.startDate)} às ${r.startTime} até ${r.endTime}\nEndereço do cliente: ${client?.address}\nEndereço da festa: ${r.address}\nBrinquedos contratados: ${toysList}\nValor total: ${fmtMoney(r.total)}\nValor sinal: ${fmtMoney(r.deposit)}\nValor restante: ${fmtMoney(remaining)}${r.notes ? `\nObservações: ${r.notes}` : ''}`;
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #F4F1FB', verticalAlign: 'top' }}>
                      <td style={{ padding: '14px 10px 14px 0', minWidth: 140 }}>
                        <p style={{ margin: 0, fontWeight: 800, color: '#3A3550', fontSize: 14 }}>{client?.name || '—'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#A39EC0' }}>{client?.address}</p>
                        <p style={{ margin: '1px 0 0', fontSize: 12, color: '#B6AFD6' }}>{client?.whatsapp}</p>
                      </td>
                      <td style={{ padding: '14px 10px', color: '#6F6A8A', minWidth: 130 }}>{r.address || '—'}</td>
                      <td style={{ padding: '14px 10px', color: '#6F6A8A', whiteSpace: 'nowrap', minWidth: 160 }}>
                        {fmtDate(r.startDate)} às {r.startTime}
                        {r.endDate && r.endDate !== r.startDate
                          ? <>{' '}a {fmtDate(r.endDate)} às {r.endTime}</>
                          : <>{' '}a {r.endTime}</>
                        }
                      </td>
                      <td style={{ padding: '14px 10px', minWidth: 140 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {r.items.map((i, idx) => {
                            const toy = getToy(i.toyId);
                            return <Badge key={idx} bg="#E4FAF1" color="#1B8A4A">{i.quantity} {toy?.name || '—'}</Badge>;
                          })}
                        </div>
                      </td>
                      <td style={{ padding: '14px 10px', minWidth: 150 }}>
                        <p style={{ margin: 0, fontSize: 13, color: '#3A3550' }}>Total: <b>{fmtMoney(r.total)}</b></p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#A39EC0' }}>Sinal: {fmtMoney(r.deposit)}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#A39EC0' }}>Restante: {fmtMoney(remaining)}</p>
                      </td>
                      <td style={{ padding: '14px 10px', minWidth: 110 }}>
                        <button onClick={() => cycleStatus(r)} style={{ border: 'none', cursor: 'pointer', background: 'none', padding: 0 }} title="Clique para avançar o status">
                          <Badge bg={st.bg} color={st.text}>{st.label}</Badge>
                        </button>
                      </td>
                      <td style={{ padding: '14px 10px', color: '#8A84A3', fontStyle: 'italic', fontSize: 12.5, minWidth: 120 }}>
                        {r.notes || <span style={{ color: '#D8D4EA' }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 10px', textAlign: 'right', minWidth: 130 }}>
                        <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <IconBtn icon={Eye} onClick={() => setViewingReservation(r)} bg="#F5F2FC" color="#5B4FCF" title="Ver detalhes" />
                          <IconBtn icon={Pencil} onClick={() => openEdit(r)} bg="#F5F2FC" color="#5B4FCF" title="Editar" />
                          {client?.whatsapp && (
                            <IconBtn
                              title="Enviar confirmação via WhatsApp"
                              icon={() => <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>}
                              onClick={() => { const phone = (client.whatsapp).replace(/\D/g,''); window.open(`https://api.whatsapp.com/send/?phone=55${phone}&text=${encodeURIComponent(wMsg)}`); }}
                              bg="#E4FAF1" color="#1B8A4A"
                            />
                          )}
                          <IconBtn icon={Trash2} onClick={() => handleDelete(r.id)} bg="#FFF0F2" color="#D6486A" title="Excluir" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing?.id ? 'Editar reserva' : 'Nova reserva'} width={680}>
        <ReservationForm initial={editing} toys={toys} clients={clients} reservations={reservations} setClients={setClients} onSave={handleSave} onCancel={() => setModalOpen(false)} />
      </Modal>

      {viewingReservation && (() => {
        const r = viewingReservation;
        const client = getClient(r.clientId);
        const st = STATUS_STYLES[r.status] || STATUS_STYLES.pendente;
        return (
          <Modal open={!!viewingReservation} onClose={() => setViewingReservation(null)} title="Detalhes da Reserva" width={560}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#A39EC0', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px' }}>Cliente</p>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#3A3550' }}>{client?.name || '—'}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#8A84A3' }}>{client?.address}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#8A84A3' }}>{client?.whatsapp}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#A39EC0', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px' }}>Data e Horário</p>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#3A3550' }}>
                    {fmtDate(r.startDate)} às {r.startTime} até
                  </p>
                  <p style={{ margin: '2px 0 0', fontWeight: 600, fontSize: 14, color: '#3A3550' }}>
                    {r.endDate && r.endDate !== r.startDate ? `${fmtDate(r.endDate)} às ` : ''}{r.endTime}
                  </p>
                </div>
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#A39EC0', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px' }}>Endereço da Festa</p>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#3A3550' }}>{r.address || '—'}</p>
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#A39EC0', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px' }}>Brinquedos</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {r.items.map((i, idx) => {
                    const toy = getToy(i.toyId);
                    return <Badge key={idx} bg="#E4FAF1" color="#1B8A4A">{toy?.name || '—'} ({i.quantity}x)</Badge>;
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div style={{ background: '#F5F2FC', borderRadius: 14, padding: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#A39EC0', margin: '0 0 4px' }}>Valor Total</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#5B4FCF', margin: 0 }}>{fmtMoney(r.total)}</p>
                </div>
                <div style={{ background: '#FFF3E8', borderRadius: 14, padding: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#A39EC0', margin: '0 0 4px' }}>Sinal</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#FF9F4A', margin: 0 }}>{fmtMoney(r.deposit)}</p>
                </div>
                <div style={{ background: '#E4FAF1', borderRadius: 14, padding: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#A39EC0', margin: '0 0 4px' }}>Restante</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#1B8A4A', margin: 0 }}>{fmtMoney((Number(r.total)||0)-(Number(r.deposit)||0))}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#A39EC0', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px' }}>Status</p>
                  <Badge bg={st.bg} color={st.text}>{st.label}</Badge>
                </div>
                {r.notes && (
                  <div style={{ flex: 1, marginLeft: 24 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#A39EC0', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px' }}>Observações</p>
                    <p style={{ margin: 0, fontSize: 13.5, color: '#6F6A8A', fontStyle: 'italic' }}>{r.notes}</p>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4, borderTop: '1px solid #F2EFFB' }}>
                <Button variant="ghost" onClick={() => setViewingReservation(null)}>Fechar</Button>
                <Button onClick={() => { setViewingReservation(null); openEdit(r); }} icon={Pencil}>Editar Reserva</Button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

// ============================================================
// DISPONIBILIDADE
// ============================================================
function AvailabilityPage({ toys, reservations }) {
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [results, setResults] = useState(null);

  const canSearch = startDate && endDate;

  const search = () => {
    if (!canSearch) return;
    const data = toys.map((toy) => {
      const reserved = getReservedQuantity(
        toy.id, startDate, startTime || '00:00', endDate, endTime || '23:59', reservations, null
      );
      return { ...toy, reserved, free: Math.max(0, toy.quantity - reserved) };
    });
    setResults(data);
  };

  const clear = () => {
    setStartDate(''); setStartTime(''); setEndDate(''); setEndTime(''); setResults(null);
  };

  return (
    <div>
      <PageHeader icon={Search} title="Disponibilidade" subtitle="Consulte quais brinquedos estão disponíveis em um período específico" accent="linear-gradient(135deg,#5EE6C0,#2BC99A)" />

      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#3A3550', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={18} color="#2BC99A" /> Filtros de disponibilidade
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 16 }}>
          <Field label="Data de início"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
          <Field label="Horário de início"><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>
          <Field label="Data de fim"><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          <Field label="Horário de fim"><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button icon={Search} onClick={search} disabled={!canSearch} variant="success">Buscar disponibilidade</Button>
          <Button variant="ghost" onClick={clear}>Limpar filtros</Button>
        </div>
      </Card>

      <Card>
        {!results ? (
          <EmptyState icon={Search} title="Consulte a disponibilidade" subtitle='Preencha os campos acima com o período desejado e clique em "Buscar disponibilidade" para ver quais brinquedos estão livres nesse horário.' />
        ) : results.length === 0 ? (
          <EmptyState icon={ToyBrick} title="Nenhum brinquedo cadastrado" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
            {results.map((toy) => (
              <div key={toy.id} style={{ border: '1px solid #F2EFFB', borderRadius: 16, padding: 16 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#3A3550' }}>{toy.name}</p>
                <p style={{ margin: '2px 0 10px', fontSize: 12.5, color: '#A39EC0' }}>Tamanho: {toy.size || '—'} · Total: {toy.quantity}</p>
                <Badge bg={toy.free > 0 ? '#E4FAF1' : '#FCE0E4'} color={toy.free > 0 ? '#1B8A4A' : '#C13B5A'}>
                  {toy.free > 0 ? `${toy.free} disponí${toy.free === 1 ? 'vel' : 'veis'}` : 'Indisponível'}
                </Badge>
                {toy.reserved > 0 && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#C7BFE8' }}>{toy.reserved} já reservado(s) neste período</p>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================
// FINANCEIRO
// ============================================================
function FinanceEntryForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { type: 'receita', description: '', amount: '', date: todayISO() });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Tipo">
        <div style={{ display: 'flex', gap: 18 }}>
          {[{ id: 'receita', label: 'Receita' }, { id: 'despesa', label: 'Despesa' }].map((opt) => (
            <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14.5, fontWeight: 600, color: '#3A3550' }}>
              <input type="radio" name="ftype" checked={form.type === opt.id} onChange={() => setForm({ ...form, type: opt.id })} />
              {opt.label}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Descrição">
        <Input placeholder="Ex: Gasolina, Manutenção, Locação..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <Field label="Valor (R$)">
        <Input type="number" min={0} placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      </Field>
      <Field label="Data">
        <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(form)} disabled={!form.description || !form.amount}>Salvar</Button>
      </div>
    </div>
  );
}

function FinancePage({ finance, setFinance }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  const filtered = finance.filter((f) => {
    const d = new Date(f.date);
    return d.getMonth() === month && d.getFullYear() === year;
  }).sort((a, b) => (a.date < b.date ? 1 : -1));

  const totalReceitas = filtered.filter((f) => f.type === 'receita').reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const totalDespesas = filtered.filter((f) => f.type === 'despesa').reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const saldo = totalReceitas - totalDespesas;
  const lucro = totalReceitas - totalDespesas;

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (f) => { setEditing(f); setModalOpen(true); };

  const handleSave = (form) => {
    if (editing) {
      setFinance((prev) => prev.map((f) => (f.id === editing.id ? { ...f, ...form } : f)));
    } else {
      setFinance((prev) => [...prev, { id: uid('f'), ...form }]);
    }
    setModalOpen(false);
  };

  const handleDelete = (id) => setFinance((prev) => prev.filter((f) => f.id !== id));

  const exportPdf = () => {
    const totalReceitas = filtered.filter((f) => f.type === 'receita').reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const totalDespesas = filtered.filter((f) => f.type === 'despesa').reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const saldoPeriodo = totalReceitas - totalDespesas;
    const mesAno = `${MONTHS_PT[month].toLowerCase()} ${year}`;
    const rows = filtered.map((f) => `
      <tr>
        <td>${fmtDate(f.date)}</td>
        <td><span class="${f.type}">${f.type === 'receita' ? 'Receita' : 'Despesa'}</span></td>
        <td>${f.description}</td>
        <td class="valor ${f.type}">${f.type === 'receita' ? '' : '-'}${fmtMoney(f.amount)}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>Extrato Financeiro - ${mesAno}</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #333; }
      h1 { font-size: 22px; font-weight: bold; margin-bottom: 6px; }
      p.sub { color: #888; font-size: 13px; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
      thead tr { background: #4A6CF7; color: #fff; }
      th { padding: 10px 12px; text-align: left; font-size: 13px; }
      td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #eee; }
      span.receita { background: #E4FAF1; color: #1B8A4A; padding: 3px 10px; border-radius: 99px; font-weight: bold; font-size: 12px; }
      span.despesa { background: #FCE0E4; color: #C13B5A; padding: 3px 10px; border-radius: 99px; font-weight: bold; font-size: 12px; }
      td.valor.receita { color: #1B8A4A; font-weight: bold; text-align: right; }
      td.valor.despesa { color: #C13B5A; font-weight: bold; text-align: right; }
      th:last-child { text-align: right; }
      .sumario { background: #F9F9FE; border: 1px solid #E8E6F4; border-radius: 12px; padding: 20px 24px; }
      .sumario-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; border-bottom: 1px solid #eee; }
      .sumario-row:last-child { border-bottom: none; font-weight: bold; font-size: 16px; }
      .verde { color: #1B8A4A; } .vermelho { color: #C13B5A; }
    </style></head><body>
    <h1>Extrato Financeiro - ${mesAno.charAt(0).toUpperCase() + mesAno.slice(1)}</h1>
    <p class="sub">Gerado em ${fmtDate(todayISO())}</p>
    <table>
      <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th style="text-align:right">Valor</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#aaa;padding:20px">Nenhum lançamento no período</td></tr>'}</tbody>
    </table>
    <div class="sumario">
      <div class="sumario-row"><span>Total de Entradas:</span><span class="verde">${fmtMoney(totalReceitas)}</span></div>
      <div class="sumario-row"><span>Total de Saídas:</span><span class="vermelho">${fmtMoney(totalDespesas)}</span></div>
      <div class="sumario-row"><span>Valores Pendentes:</span><span>R$ 0,00</span></div>
      <div class="sumario-row"><span>Saldo do Período:</span><span class="${saldoPeriodo >= 0 ? 'verde' : 'vermelho'}">${fmtMoney(saldoPeriodo)}</span></div>
    </div>
    <script>window.onload = () => window.print();</script>
    </body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  return (
    <div>
      <PageHeader icon={Wallet} title="Financeiro" subtitle="Gerencie suas receitas e despesas" accent="linear-gradient(135deg,#5EE6C0,#2BC99A)">
        <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ width: 140 }}>
          {MONTHS_PT.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </Select>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 100 }}>
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Button icon={Plus} onClick={openNew}>Novo lançamento</Button>
      </PageHeader>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 20 }}>
        <StatCard icon={Wallet} label="Saldo total" value={fmtMoney(saldo)} color="#5B4FCF" bg="#EFEDFC" />
        <StatCard icon={ArrowUpRight} label="Receitas totais" value={fmtMoney(totalReceitas)} color="#1B8A4A" bg="#E4FAF1" />
        <StatCard icon={ArrowDownRight} label="Despesas totais" value={fmtMoney(totalDespesas)} color="#D6486A" bg="#FFEBF1" />
        <StatCard icon={TrendingUp} label="Lucro líquido" value={fmtMoney(lucro)} color="#1B8A4A" bg="#E4FAF1" />
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#3A3550', margin: 0 }}>Lançamentos financeiros</h3>
          <Button variant="secondary" icon={Download} onClick={exportPdf} style={{ padding: '8px 14px', fontSize: 13.5 }}>Exportar PDF</Button>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={Wallet} title="Nenhum lançamento neste período" subtitle="Adicione receitas e despesas para acompanhar seu lucro." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#A39EC0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <th style={{ padding: '0 10px 10px 0' }}>Data</th>
                  <th style={{ padding: '0 10px 10px' }}>Tipo</th>
                  <th style={{ padding: '0 10px 10px' }}>Descrição</th>
                  <th style={{ padding: '0 10px 10px', textAlign: 'right' }}>Valor</th>
                  <th style={{ padding: '0 10px 10px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id} style={{ borderTop: '1px solid #F4F1FB' }}>
                    <td style={{ padding: '12px 10px 12px 0', color: '#6F6A8A' }}>{fmtDate(f.date)}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <Badge bg={f.type === 'receita' ? '#E4FAF1' : '#FCE0E4'} color={f.type === 'receita' ? '#1B8A4A' : '#C13B5A'}>
                        {f.type === 'receita' ? 'Receita' : 'Despesa'}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 10px', color: '#3A3550', fontWeight: 600 }}>{f.description}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700, color: f.type === 'receita' ? '#1B8A4A' : '#D6486A' }}>
                      {f.type === 'receita' ? '+' : '-'} {fmtMoney(f.amount)}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <IconBtn icon={Pencil} onClick={() => openEdit(f)} bg="#F5F2FC" color="#5B4FCF" />
                        <IconBtn icon={Trash2} onClick={() => handleDelete(f.id)} bg="#FFF0F2" color="#D6486A" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar lançamento' : 'Novo lançamento'}>
        <FinanceEntryForm initial={editing} onSave={handleSave} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}

// ============================================================
// DOCUMENTOS (Orçamentos, Contratos, Recibos) - base compartilhada
// ============================================================
function DocumentPreviewModal({ open, onClose, title, content }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={680}>
      <div style={{
        background: '#FBFAFF', border: '1px solid #ECE8F7', borderRadius: 16,
        padding: 28, fontSize: 14, lineHeight: 1.8, color: '#3A3550', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)',
      }}>
        {content}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <Button variant="secondary" icon={Download} onClick={() => window.print()}>Imprimir / Salvar PDF</Button>
        <Button onClick={onClose}>Fechar</Button>
      </div>
    </Modal>
  );
}

function ReservationPicker({ reservations, clients, value, onChange }) {
  const getClient = (id) => clients.find((c) => c.id === id);
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Selecione uma reserva...</option>
      {reservations.map((r) => (
        <option key={r.id} value={r.id}>
          {getClient(r.clientId)?.name || '—'} · {fmtDate(r.startDate)} {r.startTime}
        </option>
      ))}
    </Select>
  );
}

// ----------------- ORÇAMENTOS -----------------
function BudgetsPage({ reservations, clients, toys, company, budgets, setBudgets }) {
  const [filterMonth, setFilterMonth] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingBudget, setViewingBudget] = useState(null);
  const [editingBudget, setEditingBudget] = useState(null);

  const now = new Date();
  const filteredBudgets = (budgets || []).filter((b) => {
    if (!filterMonth) return true;
    const d = new Date(b.date);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === filterMonth;
  }).sort((a,b) => b.date > a.date ? 1 : -1);

  const getClient = (id) => clients.find((c) => c.id === id);
  const getToy = (id) => toys.find((t) => t.id === id);
  const calcTotal = (b) => (b.items||[]).reduce((s,i) => s + i.quantity * i.price, 0) + (Number(b.delivery)||0) - (Number(b.discount)||0);

  const sendWhatsApp = (b) => {
    const client = getClient(b.clientId);
    if (!client?.whatsapp) return;
    const total = calcTotal(b);
    const toysList = (b.items||[]).map((i) => { const t = getToy(i.toyId); return `${i.quantity}x ${t?.name || '—'} — ${fmtMoney(i.price)} un.`; }).join('\n');
    const msg = `Olá, ${client.name}! Segue o orçamento da SBS Brinquedos:\n\n📅 Data: ${b.noTime ? fmtDate(b.eventDate) : `${fmtDate(b.eventDate)} das ${b.startTime} às ${b.endTime}`}\n📍 Local: ${b.address || '—'}\n\n🎪 Brinquedos:\n${toysList}\n\n💰 Taxa de entrega: ${fmtMoney(b.delivery||0)}\n💸 Desconto: -${fmtMoney(b.discount||0)}\n✅ VALOR TOTAL: ${fmtMoney(total)}\n\n${b.notes ? `📝 Obs: ${b.notes}\n\n` : ''}Qualquer dúvida, estou à disposição para ajudar!\nFico no aguardo do seu retorno.`;
    const phone = (client.whatsapp).replace(/\D/g, '');
    window.open(`https://api.whatsapp.com/send/?phone=55${phone}&text=${encodeURIComponent(msg)}`);
  };

  const printBudget = (b) => {
    const client = getClient(b.clientId);
    const subtotal = (b.items||[]).reduce((s,i) => s + i.quantity * i.price, 0);
    const total = subtotal + (Number(b.delivery)||0) - (Number(b.discount)||0);
    const toysRows = (b.items||[]).map((i) => {
      const toy = getToy(i.toyId);
      const imgTag = toy?.image ? `<img src="${toy.image}" width="40" height="40" style="border-radius:8px;object-fit:cover;vertical-align:middle;margin-right:8px">` : '';
      return `<tr>
        <td>${imgTag}${toy?.name || '—'}</td>
        <td style="text-align:center">${toy?.size || '—'}</td>
        <td style="text-align:center">${i.quantity}</td>
        <td style="text-align:right">${fmtMoney(i.price)}</td>
        <td style="text-align:right;font-weight:bold">${fmtMoney(i.quantity * i.price)}</td>
      </tr>`;
    }).join('');
    const logoTag = company.logo ? `<img src="${company.logo}" height="60" style="max-width:180px;object-fit:contain">` : `<div style="font-size:28px;font-weight:900;color:#5B4FCF">${company.name || 'BrincaGestor'}</div>`;
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Orçamento</title>
    <style>
      body{font-family:Arial,sans-serif;max-width:780px;margin:40px auto;color:#333;padding:0 20px}
      .header{text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #5B4FCF}
      .header p{margin:3px 0;font-size:13px;color:#666}
      h2{color:#5B4FCF;text-align:center;letter-spacing:2px;font-size:15px;margin:18px 0}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px}
      .box{border:1px solid #eee;border-radius:10px;padding:14px}
      .box h3{font-size:13px;color:#888;margin:0 0 8px;text-transform:uppercase;letter-spacing:.5px}
      .box p{margin:3px 0;font-size:14px}
      table{width:100%;border-collapse:collapse;margin-bottom:18px}
      thead tr{background:#5B4FCF;color:#fff}
      th{padding:10px 12px;text-align:left;font-size:13px}
      td{padding:10px 12px;font-size:13px;border-bottom:1px solid #eee;vertical-align:middle}
      th:last-child,th:nth-child(4),th:nth-child(3),th:nth-child(2){text-align:right}
      td:last-child,td:nth-child(4),td:nth-child(3),td:nth-child(2){text-align:right}
      .totais{margin-left:auto;width:280px}
      .totais-row{display:flex;justify-content:space-between;padding:7px 0;font-size:14px;border-bottom:1px solid #eee}
      .totais-row.final{font-size:17px;font-weight:bold;color:#5B4FCF;border-bottom:none}
      .footer{text-align:center;font-size:12px;color:#aaa;margin-top:32px;padding-top:16px;border-top:1px solid #eee}
    </style></head><body>
    <div class="header">
      ${logoTag}
      <div style="margin-top:8px">
        ${company.name ? `<p style="font-size:18px;font-weight:bold;color:#333;margin:6px 0">${company.name}</p>` : ''}
        ${company.cnpj ? `<p>CNPJ: ${company.cnpj}</p>` : ''}
        ${company.address ? `<p>${company.address}</p>` : ''}
        ${company.phone ? `<p>Tel: ${company.phone}${company.email ? `&nbsp;&nbsp; Email: ${company.email}` : ''}</p>` : ''}
      </div>
    </div>
    <h2>ORÇAMENTO</h2>
    <div class="grid">
      <div class="box">
        <h3>Informações do Cliente</h3>
        <p><strong>${client?.name || '—'}</strong></p>
        <p>${client?.address || ''}</p>
        <p>WhatsApp: ${client?.whatsapp || ''}</p>
      </div>
      <div class="box">
        <h3>Informações do Evento</h3>
        <p><strong>Data/Horário:</strong> ${b.noTime ? fmtDate(b.eventDate) : `${fmtDate(b.eventDate)} das ${b.startTime} às ${b.endTime}`}</p>
        <p><strong>Endereço da festa:</strong> ${b.address || '—'}</p>
      </div>
    </div>
    <h3 style="font-size:15px;margin-bottom:10px">Brinquedos</h3>
    <table>
      <thead><tr><th>Brinquedo</th><th style="text-align:center">Tamanho</th><th style="text-align:center">Qtd</th><th>Valor Unit.</th><th>Valor Total</th></tr></thead>
      <tbody>${toysRows}</tbody>
    </table>
    <div class="totais">
      ${Number(b.delivery) > 0 ? `<div class="totais-row"><span>Taxa de entrega:</span><span>${fmtMoney(b.delivery)}</span></div>` : ''}
      ${Number(b.discount) > 0 ? `<div class="totais-row"><span>Desconto:</span><span>-${fmtMoney(b.discount)}</span></div>` : ''}
      <div class="totais-row final"><span>Valor Total:</span><span>${fmtMoney(total)}</span></div>
    </div>
    ${b.notes ? `<div style="margin-top:20px;background:#F5F2FC;border-radius:10px;padding:14px"><strong>Observações:</strong> ${b.notes}</div>` : ''}
    <div class="footer">Orçamento gerado em ${fmtDate(b.date)} — Válido por 7 dias</div>
    <script>window.onload = () => window.print();</script>
    </body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  return (
    <div>
      <PageHeader icon={FileText} title="Orçamentos" subtitle="Crie e gerencie orçamentos de locação" accent="linear-gradient(135deg,#C0A4F7,#9B5DE5)">
        <Select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={{ width: 160 }}>
          <option value="">Todos os meses</option>
          {Array.from({length: 12}, (_,i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
            const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            return <option key={val} value={val}>{MONTHS_PT[d.getMonth()]} {d.getFullYear()}</option>;
          })}
        </Select>
        <Button icon={Plus} onClick={() => { setEditingBudget(null); setModalOpen(true); }}>Novo orçamento</Button>
      </PageHeader>

      <Card>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#3A3550', margin: '0 0 16px' }}>Orçamentos realizados</h3>
        {filteredBudgets.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhum orçamento encontrado" subtitle="Crie seu primeiro orçamento clicando em '+ Novo orçamento'." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#A39EC0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <th style={{ padding: '0 10px 10px 0' }}>Cliente</th>
                  <th style={{ padding: '0 10px 10px' }}>Endereço da festa</th>
                  <th style={{ padding: '0 10px 10px' }}>Data e Horário</th>
                  <th style={{ padding: '0 10px 10px' }}>Brinquedos</th>
                  <th style={{ padding: '0 10px 10px' }}>Taxa de Entrega</th>
                  <th style={{ padding: '0 10px 10px' }}>Desconto</th>
                  <th style={{ padding: '0 10px 10px', textAlign: 'right' }}>Valor Total</th>
                  <th style={{ padding: '0 10px 10px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredBudgets.map((b) => {
                  const client = getClient(b.clientId);
                  const total = calcTotal(b);
                  return (
                    <tr key={b.id} style={{ borderTop: '1px solid #F4F1FB' }}>
                      <td style={{ padding: '12px 10px 12px 0' }}>
                        <p style={{ margin: 0, fontWeight: 700, color: '#3A3550' }}>{client?.name || '—'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#A39EC0' }}>{client?.whatsapp}</p>
                      </td>
                      <td style={{ padding: '12px 10px', color: '#6F6A8A', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.address || '—'}</td>
                      <td style={{ padding: '12px 10px', color: '#6F6A8A', whiteSpace: 'nowrap' }}>
                        {fmtDate(b.eventDate)}{!b.noTime && b.startTime ? ` das ${b.startTime}` : ''}{!b.noTime && b.endTime ? ` às ${b.endTime}` : ''}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(b.items||[]).map((i, idx) => {
                            const toy = getToy(i.toyId);
                            return <Badge key={idx} bg="#E4FAF1" color="#1B8A4A">{i.quantity} {toy?.name || '—'}</Badge>;
                          })}
                        </div>
                      </td>
                      <td style={{ padding: '12px 10px', color: '#6F6A8A' }}>{Number(b.delivery) > 0 ? fmtMoney(b.delivery) : '—'}</td>
                      <td style={{ padding: '12px 10px', color: '#D6486A' }}>{Number(b.discount) > 0 ? `-${fmtMoney(b.discount)}` : '—'}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800, color: '#5B4FCF', fontSize: 15 }}>{fmtMoney(total)}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <IconBtn icon={Eye} onClick={() => setViewingBudget(b)} bg="#F5F2FC" color="#5B4FCF" title="Visualizar orçamento" />
                          <IconBtn icon={Pencil} onClick={() => { setEditingBudget(b); setModalOpen(true); }} bg="#F5F2FC" color="#5B4FCF" title="Editar" />
                          <IconBtn
                            title="Enviar para WhatsApp"
                            icon={() => <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>}
                            onClick={() => sendWhatsApp(b)}
                            bg="#E4FAF1" color="#1B8A4A"
                          />
                          <IconBtn icon={Trash2} onClick={() => setBudgets((prev) => prev.filter((x) => x.id !== b.id))} bg="#FFF0F2" color="#D6486A" title="Excluir" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingBudget ? 'Editar orçamento' : 'Novo orçamento'} width={680}>
        <BudgetForm
          initial={editingBudget}
          clients={clients} toys={toys}
          onSave={(form) => {
            if (editingBudget) {
              setBudgets((prev) => prev.map((b) => b.id === editingBudget.id ? { ...b, ...form } : b));
            } else {
              setBudgets((prev) => [...prev, { id: uid('b'), date: todayISO(), ...form }]);
            }
            setModalOpen(false);
          }}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      {/* Modal de visualização bonita do orçamento */}
      {viewingBudget && (() => {
        const b = viewingBudget;
        const client = getClient(b.clientId);
        const subtotal = (b.items||[]).reduce((s,i) => s + i.quantity * i.price, 0);
        const total = subtotal + (Number(b.delivery)||0) - (Number(b.discount)||0);
        return (
          <Modal open={!!viewingBudget} onClose={() => setViewingBudget(null)} title="Visualização do Orçamento" width={720}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
              <Button variant="secondary" icon={Download} onClick={() => printBudget(b)}>Baixar PDF</Button>
              <Button variant="ghost" onClick={() => setViewingBudget(null)}>
                <X size={16} /> Fechar
              </Button>
            </div>

            {/* Cabeçalho empresa */}
            <div style={{ textAlign: 'center', padding: '20px 0 24px', borderBottom: '2px solid #5B4FCF', marginBottom: 24 }}>
              {company.logo && <img src={company.logo} alt="logo" style={{ height: 60, maxWidth: 180, objectFit: 'contain', marginBottom: 10 }} />}
              {company.name && <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: '#3A3550', margin: '0 0 4px' }}>{company.name}</p>}
              {company.address && <p style={{ fontSize: 13, color: '#8A84A3', margin: '2px 0' }}>{company.address}</p>}
              {(company.phone || company.email) && <p style={{ fontSize: 13, color: '#8A84A3', margin: '2px 0' }}>{company.phone}{company.email ? ` · ${company.email}` : ''}</p>}
              {company.cnpj && <p style={{ fontSize: 13, color: '#8A84A3', margin: '2px 0' }}>CNPJ: {company.cnpj}</p>}
            </div>

            <p style={{ textAlign: 'center', fontWeight: 800, letterSpacing: 3, color: '#5B4FCF', fontSize: 13, marginBottom: 20 }}>ORÇAMENTO</p>

            {/* Info cliente e evento */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ border: '1px solid #ECE8F7', borderRadius: 14, padding: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#A39EC0', textTransform: 'uppercase', margin: '0 0 10px' }}>Informações do Cliente</p>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#3A3550' }}>{client?.name || '—'}</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6F6A8A' }}>{client?.address}</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6F6A8A' }}>WhatsApp: {client?.whatsapp}</p>
              </div>
              <div style={{ border: '1px solid #ECE8F7', borderRadius: 14, padding: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#A39EC0', textTransform: 'uppercase', margin: '0 0 10px' }}>Informações do Evento</p>
                <p style={{ margin: 0, fontSize: 13.5, color: '#3A3550' }}><b>Data/Horário:</b> {b.noTime ? fmtDate(b.eventDate) : `${fmtDate(b.eventDate)} das ${b.startTime} às ${b.endTime}`}</p>
                <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#3A3550' }}><b>Endereço da festa:</b> {b.address || '—'}</p>
              </div>
            </div>

            {/* Tabela de brinquedos */}
            <p style={{ fontWeight: 700, fontSize: 15, color: '#3A3550', margin: '0 0 12px' }}>Brinquedos</p>
            <div style={{ border: '1px solid #ECE8F7', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: '#F5F2FC' }}>
                    {['Brinquedo', 'Tamanho', 'Quantidade', 'Valor Unit.', 'Valor Total'].map((h,i) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: i > 1 ? 'right' : 'left', fontSize: 12, fontWeight: 700, color: '#8A84A3', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(b.items||[]).map((item, idx) => {
                    const toy = getToy(item.toyId);
                    return (
                      <tr key={idx} style={{ borderTop: '1px solid #F4F1FB' }}>
                        <td style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          {toy?.image && <img src={toy.image} alt={toy.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                          <span style={{ fontWeight: 700, color: '#3A3550' }}>{toy?.name || '—'}</span>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#6F6A8A' }}>{toy?.size || '—'}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: '#6F6A8A' }}>{item.quantity}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: '#6F6A8A' }}>{fmtMoney(item.price)}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#3A3550' }}>{fmtMoney(item.quantity * item.price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totais */}
            <div style={{ marginLeft: 'auto', maxWidth: 300 }}>
              {Number(b.delivery) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F4F1FB', fontSize: 14, color: '#6F6A8A' }}>
                  <span>Taxa de Entrega:</span><span>{fmtMoney(b.delivery)}</span>
                </div>
              )}
              {Number(b.discount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F4F1FB', fontSize: 14, color: '#D6486A' }}>
                  <span>Desconto:</span><span>-{fmtMoney(b.discount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 18, fontWeight: 800, color: '#5B4FCF' }}>
                <span>Valor Total:</span><span>{fmtMoney(total)}</span>
              </div>
            </div>

            {b.notes && (
              <div style={{ background: '#F5F2FC', borderRadius: 12, padding: 14, marginTop: 16, fontSize: 13.5, color: '#6F6A8A' }}>
                <b>Observações:</b> {b.notes}
              </div>
            )}

            <p style={{ textAlign: 'center', fontSize: 12, color: '#C7BFE8', marginTop: 20 }}>Orçamento gerado em {fmtDate(b.date)}</p>
          </Modal>
        );
      })()}
    </div>
  );
}

function BudgetForm({ initial, clients, toys, onSave, onCancel }) {
  const [clientId, setClientId] = useState(initial?.clientId || '');
  const [address, setAddress] = useState(initial?.address || '');
  const [eventDate, setEventDate] = useState(initial?.eventDate || todayISO());
  const [startTime, setStartTime] = useState(initial?.startTime || '10:00');
  const [endTime, setEndTime] = useState(initial?.endTime || '14:00');
  const [noTime, setNoTime] = useState(initial?.noTime || false);
  const [items, setItems] = useState(initial?.items || toys.map((t) => ({ toyId: t.id, quantity: 1, price: Number(t.price)||0, selected: false })));
  const [delivery, setDelivery] = useState(initial?.delivery || 0);
  const [discount, setDiscount] = useState(initial?.discount || 0);
  const [notes, setNotes] = useState(initial?.notes || '');

  const selectedClient = clients.find((c) => c.id === clientId);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientList, setShowClientList] = useState(false);
  const clientResults = clients.filter((c) => [c.name, c.whatsapp].join(' ').toLowerCase().includes(clientSearch.toLowerCase()));

  const selectedItems = items.filter((i) => i.selected);
  const subtotal = selectedItems.reduce((s, i) => s + i.quantity * i.price, 0);
  const total = subtotal + (Number(delivery)||0) - (Number(discount)||0);

  const toggleItem = (toyId) => setItems((prev) => prev.map((i) => i.toyId === toyId ? { ...i, selected: !i.selected } : i));
  const updateItem = (toyId, field, value) => setItems((prev) => prev.map((i) => i.toyId === toyId ? { ...i, [field]: value } : i));

  const canSave = clientId && eventDate && selectedItems.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Cliente">
        {selectedClient ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderRadius: 12, background: '#F5F2FC', border: '1.5px solid #ECE8F7' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#3A3550' }}>{selectedClient.name}</p>
              <p style={{ margin: 0, fontSize: 12.5, color: '#A39EC0' }}>{selectedClient.whatsapp}</p>
            </div>
            <Button variant="ghost" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => { setClientId(''); setClientSearch(''); }}>Trocar</Button>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <Input placeholder="Buscar cliente por nome, telefone ou endereço..." value={clientSearch} onFocus={() => setShowClientList(true)}
              onChange={(e) => { setClientSearch(e.target.value); setShowClientList(true); }} />
            {showClientList && clientSearch && (
              <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: '#fff', border: '1px solid #ECE8F7', borderRadius: 12, boxShadow: '0 10px 24px -10px rgba(60,40,110,0.2)', zIndex: 10, maxHeight: 180, overflowY: 'auto' }}>
                {clientResults.map((c) => (
                  <div key={c.id} onClick={() => { setClientId(c.id); setAddress(address || c.address); setClientSearch(''); setShowClientList(false); }}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F4F1FB' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#FAF8FE'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#3A3550' }}>{c.name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#A39EC0' }}>{c.whatsapp}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Field>

      <Field label="Endereço do evento">
        <Input placeholder="Endereço completo" value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>

      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#3A3550', margin: '0 0 10px' }}>Data e Horário do Evento</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer', fontSize: 13.5, color: '#6F6A8A' }}>
          <input type="checkbox" checked={noTime} onChange={(e) => setNoTime(e.target.checked)} />
          Sem horário específico
          <span style={{ fontSize: 12, color: '#A39EC0' }}>Marque esta opção se o evento não tem horário definido</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label="Data de Início"><Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></Field>
          {!noTime && <Field label="Hora de Início"><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>}
          {!noTime && <Field label="Hora de Término"><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field>}
        </div>
      </div>

      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#3A3550', margin: '0 0 10px' }}>Brinquedos e Valores</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {toys.map((toy) => {
            const item = items.find((i) => i.toyId === toy.id);
            if (!item) return null;
            return (
              <div key={toy.id} onClick={() => toggleItem(toy.id)} style={{
                border: `1.5px solid ${item.selected ? '#5B4FCF' : '#ECE8F7'}`,
                background: item.selected ? '#F2EFFC' : '#fff',
                borderRadius: 14, padding: 14, cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: item.selected ? 12 : 0 }}>
                  <input type="checkbox" checked={item.selected} readOnly style={{ pointerEvents: 'none' }} />
                  <span style={{ fontWeight: 700, fontSize: 14.5, color: '#3A3550' }}>{toy.name}</span>
                  {toy.size && <span style={{ fontSize: 12, color: '#A39EC0' }}>{toy.size}</span>}
                </div>
                {item.selected && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }} onClick={(e) => e.stopPropagation()}>
                    <Field label="Qtd:">
                      <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(toy.id, 'quantity', Number(e.target.value))} style={{ padding: '8px 10px' }} />
                    </Field>
                    <Field label="Valor unit.:">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 13, color: '#8A84A3' }}>R$</span>
                        <Input type="number" min={0} value={item.price} onChange={(e) => updateItem(toy.id, 'price', Number(e.target.value))} style={{ padding: '8px 10px' }} />
                      </div>
                    </Field>
                    <Field label="Total:">
                      <div style={{ padding: '10px 12px', borderRadius: 12, background: '#E4FAF1', fontWeight: 700, color: '#1B8A4A', fontSize: 13.5 }}>
                        {fmtMoney(item.quantity * item.price)}
                      </div>
                    </Field>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <Field label="Taxa de Entrega">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#8A84A3' }}>R$</span>
            <Input type="number" min={0} value={delivery} onChange={(e) => setDelivery(e.target.value)} style={{ padding: '8px 10px' }} />
          </div>
        </Field>
        <Field label="Desconto">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#8A84A3' }}>R$</span>
            <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} style={{ padding: '8px 10px' }} />
          </div>
        </Field>
        <Field label="Valor Total">
          <div style={{ padding: '10px 14px', borderRadius: 12, background: '#F2EFFC', fontFamily: 'var(--font-display)', fontWeight: 700, color: '#5B4FCF', fontSize: 16 }}>
            {fmtMoney(total)}
          </div>
        </Field>
      </div>

      <Field label="Observações">
        <Textarea placeholder="Adicione observações relevantes sobre o orçamento..." value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave({ clientId, address, eventDate, startTime: noTime ? '' : startTime, endTime: noTime ? '' : endTime, noTime, items: items.filter((i) => i.selected), delivery: Number(delivery)||0, discount: Number(discount)||0, notes })} disabled={!canSave}>
          Salvar Orçamento
        </Button>
      </div>
    </div>
  );
}

// ----------------- CONTRATOS -----------------
function ContractsPage({ reservations, clients, toys, company }) {
  const [selectedId, setSelectedId] = useState('');
  const [preview, setPreview] = useState(false);

  const reservation = reservations.find((r) => r.id === selectedId);
  const client = reservation && clients.find((c) => c.id === reservation.clientId);
  const getToy = (id) => toys.find((t) => t.id === id);

  const content = useMemo(() => {
    if (!reservation || !client) return '';
    const itemsLines = reservation.items.map((i) => {
      const toy = getToy(i.toyId);
      return `  • ${i.quantity}x ${toy?.name || '—'} (${toy?.size || '—'})`;
    }).join('\n');
    return `CONTRATO DE LOCAÇÃO DE BRINQUEDOS\n\nLOCADORA: ${company.name || '[Nome da empresa]'}\nCNPJ: ${company.cnpj || '[CNPJ]'}\nEndereço: ${company.address || '[Endereço]'}\nContato: ${company.phone || ''}  ${company.email || ''}\n\nLOCATÁRIO: ${client.name}\nDocumento: ${client.document || '—'}\nEndereço: ${client.address}\nWhatsApp: ${client.whatsapp}\n\nOBJETO DO CONTRATO:\nLocação dos itens abaixo para uso no endereço ${reservation.address}, na data de ${fmtDate(reservation.startDate)}, das ${reservation.startTime} às ${reservation.endTime}.\n\nItens locados:\n${itemsLines}\n\nVALORES:\nValor total: ${fmtMoney(reservation.total)}\nSinal pago: ${fmtMoney(reservation.deposit)}\nValor restante (a pagar na entrega): ${fmtMoney((Number(reservation.total) || 0) - (Number(reservation.deposit) || 0))}\n\nCLÁUSULAS GERAIS:\n1. O LOCATÁRIO se responsabiliza pela guarda e bom uso dos equipamentos durante o período de locação.\n2. Em caso de dano, perda ou extravio, o LOCATÁRIO se compromete a ressarcir a LOCADORA pelo valor de mercado do item.\n3. O cancelamento deve ser comunicado com antecedência mínima de 48 horas, sob pena de retenção do sinal.\n4. A montagem e desmontagem dos equipamentos é de responsabilidade da LOCADORA.\n\nObservações: ${reservation.notes || '—'}\n\n\n_______________________________          _______________________________\n        Locadora                                          Locatário`;
  }, [reservation, client, company, toys]);

  return (
    <div>
      <PageHeader icon={FileSignature} title="Contratos" subtitle="Gere contratos de locação a partir das reservas" accent="linear-gradient(135deg,#7F77DD,#5B4FCF)" />
      <Card>
        {reservations.length === 0 ? (
          <EmptyState icon={FileSignature} title="Nenhuma reserva cadastrada" subtitle="Crie uma reserva para gerar um contrato." />
        ) : (
          <>
            <Field label="Selecione a reserva">
              <ReservationPicker reservations={reservations} clients={clients} value={selectedId} onChange={setSelectedId} />
            </Field>
            <div style={{ marginTop: 16 }}>
              <Button icon={Eye} onClick={() => setPreview(true)} disabled={!selectedId}>Gerar contrato</Button>
            </div>
          </>
        )}
      </Card>
      <DocumentPreviewModal open={preview} onClose={() => setPreview(false)} title="Contrato de locação" content={content} />
    </div>
  );
}

// ----------------- RECIBOS -----------------
function ReceiptsPage({ reservations, clients, company }) {
  const [selectedId, setSelectedId] = useState('');
  const [receiptType, setReceiptType] = useState('sinal');
  const [preview, setPreview] = useState(false);

  const reservation = reservations.find((r) => r.id === selectedId);
  const client = reservation && clients.find((c) => c.id === reservation.clientId);

  const content = useMemo(() => {
    if (!reservation || !client) return '';
    const remaining = (Number(reservation.total) || 0) - (Number(reservation.deposit) || 0);
    const value = receiptType === 'sinal' ? reservation.deposit : receiptType === 'restante' ? remaining : reservation.total;
    const label = receiptType === 'sinal' ? 'sinal/entrada' : receiptType === 'restante' ? 'valor restante' : 'pagamento total';
    return `RECIBO DE PAGAMENTO\n${company.name || '[Nome da empresa]'}\n${company.cnpj ? `CNPJ: ${company.cnpj}` : ''}\n\nRecebi de ${client.name}, ${client.document ? `portador do documento ${client.document}, ` : ''}a importância de ${fmtMoney(value)}, referente ao ${label} da locação de brinquedos para o evento realizado em ${reservation.address}, no dia ${fmtDate(reservation.startDate)}.\n\nValor total da locação: ${fmtMoney(reservation.total)}\nValor deste recibo: ${fmtMoney(value)}\n\nData de emissão: ${fmtDate(todayISO())}\n\n\n_______________________________\n${company.name || 'Assinatura'}`;
  }, [reservation, client, company, receiptType]);

  return (
    <div>
      <PageHeader icon={Receipt} title="Recibos" subtitle="Gere recibos de pagamento a partir das reservas" accent="linear-gradient(135deg,#FF9FBE,#FF6B9D)" />
      <Card>
        {reservations.length === 0 ? (
          <EmptyState icon={Receipt} title="Nenhuma reserva cadastrada" subtitle="Crie uma reserva para gerar um recibo." />
        ) : (
          <>
            <Field label="Selecione a reserva">
              <ReservationPicker reservations={reservations} clients={clients} value={selectedId} onChange={setSelectedId} />
            </Field>
            <div style={{ marginTop: 14 }}>
              <Field label="Tipo de recibo">
                <Select value={receiptType} onChange={(e) => setReceiptType(e.target.value)}>
                  <option value="sinal">Sinal / entrada</option>
                  <option value="restante">Valor restante</option>
                  <option value="total">Pagamento total</option>
                </Select>
              </Field>
            </div>
            <div style={{ marginTop: 16 }}>
              <Button icon={Eye} onClick={() => setPreview(true)} disabled={!selectedId}>Gerar recibo</Button>
            </div>
          </>
        )}
      </Card>
      <DocumentPreviewModal open={preview} onClose={() => setPreview(false)} title="Recibo de pagamento" content={content} />
    </div>
  );
}

// ============================================================
// ESTATÍSTICAS
// ============================================================
function StatsPage({ reservations, finance, toys }) {
  const last12 = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth(), label: `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` });
    }
    return months;
  }, []);

  const revenueVsCost = useMemo(() => {
    return last12.map(({ year, month, label }) => {
      let receita = 0, custo = 0;
      for (const f of finance) {
        const d = new Date(f.date);
        if (d.getFullYear() === year && d.getMonth() === month) {
          if (f.type === 'receita') receita += Number(f.amount) || 0;
          else custo += Number(f.amount) || 0;
        }
      }
      return { name: label, Receita: receita, Custo: custo };
    });
  }, [finance, last12]);

  const eventsPerMonth = useMemo(() => {
    return last12.map(({ year, month, label }) => {
      const count = reservations.filter((r) => {
        const d = new Date(r.startDate);
        return d.getFullYear() === year && d.getMonth() === month;
      }).length;
      return { name: label, Eventos: count };
    });
  }, [reservations, last12]);

  const totalEvents = reservations.length;
  const totalRevenue = finance.filter((f) => f.type === 'receita').reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const toysRented = reservations.reduce((s, r) => s + r.items.reduce((x, i) => x + i.quantity, 0), 0);

  const eventsVsToys = useMemo(() => {
    return last12.map(({ year, month, label }) => {
      const monthReservations = reservations.filter((r) => {
        const d = new Date(r.startDate);
        return d.getFullYear() === year && d.getMonth() === month;
      });
      const eventos = monthReservations.length;
      const brinquedos = monthReservations.reduce((s, r) => s + r.items.reduce((x, i) => x + i.quantity, 0), 0);
      return { name: label, Eventos: eventos, 'Brinquedos alugados': brinquedos };
    });
  }, [reservations, last12]);

  const ticketMedioEvento = totalEvents > 0 ? totalRevenue / totalEvents : 0;
  const ticketMedioBrinquedo = toysRented > 0 ? totalRevenue / toysRented : 0;

  // Brinquedos mais populares
  const toyCounts = {};
  for (const r of reservations) {
    for (const item of r.items) {
      toyCounts[item.toyId] = (toyCounts[item.toyId] || 0) + 1;
    }
  }
  const maxCount = Math.max(1, ...Object.values(toyCounts));
  const popularToys = toys.map((t) => ({ ...t, count: toyCounts[t.id] || 0 }))
    .sort((a, b) => b.count - a.count).slice(0, 5);

  // Eventos por dia da semana
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const r of reservations) {
    const d = new Date(r.startDate);
    weekdayCounts[d.getDay()]++;
  }
  const maxWeekday = Math.max(1, ...weekdayCounts);

  return (
    <div>
      <PageHeader icon={BarChart3} title="Estatísticas" subtitle="Análise completa dos últimos 12 meses" accent="linear-gradient(135deg,#6FE3EE,#34C9D8)" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 20 }}>
        <StatCard icon={CalendarDays} label="Total de eventos" value={totalEvents} color="#5B4FCF" bg="#EFEDFC" />
        <StatCard icon={Wallet} label="Receita total" value={fmtMoney(totalRevenue)} color="#1B8A4A" bg="#E4FAF1" />
        <StatCard icon={ToyBrick} label="Brinquedos alugados" value={toysRented} color="#FF6B9D" bg="#FFEBF1" />
        <StatCard icon={TrendingUp} label="Ticket médio por evento" value={fmtMoney(ticketMedioEvento)} color="#FF9F4A" bg="#FFF3E8" />
        <StatCard icon={TrendingUp} label="Ticket médio por brinquedo" value={fmtMoney(ticketMedioBrinquedo)} color="#34C9D8" bg="#E4F9FB" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginBottom: 16 }}>
        <Card>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#3A3550', margin: '0 0 16px' }}>Receita vs custo por mês</h3>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueVsCost}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F1FB" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#A39EC0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#A39EC0' }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ borderRadius: 12, border: '1px solid #ECE8F7', fontSize: 12.5 }} />
                <Legend wrapperStyle={{ fontSize: 12.5 }} />
                <Bar dataKey="Receita" fill="#2BC99A" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Custo" fill="#FF9F4A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#3A3550', margin: '0 0 16px' }}>Eventos vs Brinquedos alugados</h3>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eventsVsToys}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F1FB" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#A39EC0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#A39EC0' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #ECE8F7', fontSize: 12.5 }} />
                <Legend wrapperStyle={{ fontSize: 12.5 }} />
                <Bar dataKey="Eventos" fill="#5B4FCF" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Brinquedos alugados" fill="#FF6B9D" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Card>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#3A3550', margin: '0 0 16px' }}>Eventos por mês</h3>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={eventsPerMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F1FB" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#A39EC0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#A39EC0' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #ECE8F7', fontSize: 12.5 }} />
                <Line type="monotone" dataKey="Eventos" stroke="#5B4FCF" strokeWidth={3} dot={{ r: 4, fill: '#5B4FCF' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
        <Card>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#3A3550', margin: '0 0 16px' }}>Brinquedos mais populares</h3>
          {popularToys.length === 0 || popularToys.every((t) => t.count === 0) ? (
            <p style={{ fontSize: 13.5, color: '#A39EC0' }}>Ainda não há dados suficientes.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {popularToys.map((toy) => (
                <div key={toy.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13.5 }}>
                    <span style={{ fontWeight: 700, color: '#3A3550' }}>{toy.name} - {Math.round((toy.count / maxCount) * 100)}%</span>
                    <span style={{ color: '#A39EC0' }}>{toy.count} vez{toy.count !== 1 ? 'es' : ''}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: '#F4F1FB', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(toy.count / maxCount) * 100}%`, background: 'linear-gradient(90deg,#7F77DD,#5B4FCF)', borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#3A3550', margin: '0 0 16px' }}>Eventos por dia da semana</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {WEEKDAYS_PT.map((day, idx) => {
              const count = weekdayCounts[idx];
              const pct = totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0;
              return (
                <div key={day}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13.5 }}>
                    <span style={{ fontWeight: 700, color: '#3A3550' }}>{['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][idx]} - {pct}%</span>
                    <span style={{ color: '#A39EC0' }}>{count} evento{count !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: '#F4F1FB', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / maxWeekday) * 100}%`, background: 'linear-gradient(90deg,#6FE3EE,#34C9D8)', borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// EMPRESA
// ============================================================
function CompanyPage({ company, setCompany }) {
  const [form, setForm] = useState(company);
  const [saved, setSaved] = useState(false);

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logo: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    setCompany(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <PageHeader icon={Building2} title="Dados da empresa" subtitle="Configure as informações da sua empresa" accent="linear-gradient(135deg,#B8B4CC,#8A84A3)" />
      <Card style={{ maxWidth: 640 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#3A3550', margin: '0 0 4px' }}>Informações da empresa</h3>
        <p style={{ fontSize: 13, color: '#A39EC0', margin: '0 0 20px' }}>Estas informações serão exibidas em orçamentos, contratos e outros documentos.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Logo da empresa">
            <label style={{
              display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
              border: '2px dashed #E3E0FB', borderRadius: 16, padding: 16, background: '#FBFAFF',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 14, background: form.logo ? `url(${form.logo}) center/cover` : '#F1EEFD',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {!form.logo && <Building2 size={26} color="#C7BFE8" />}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#5B4FCF' }}>Escolher arquivo</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#A39EC0' }}>PNG ou JPG, máximo 5MB</p>
              </div>
              <input type="file" accept="image/*" onChange={handleLogo} style={{ display: 'none' }} />
            </label>
          </Field>

          <Field label="Nome da empresa">
            <Input placeholder="Nome da sua empresa" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>

          <Field label="CNPJ">
            <Input placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Telefone">
              <Input placeholder="(00) 00000-0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input placeholder="contato@suaempresa.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>

          <Field label="Endereço">
            <Input placeholder="Endereço completo" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <Button onClick={handleSave}>Salvar dados</Button>
            {saved && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1B8A4A', fontSize: 13.5, fontWeight: 700 }}>
                <Check size={16} /> Salvo com sucesso
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// APP PRINCIPAL
// ============================================================
export default function App() {
  const [active, setActive] = useState('dashboard');
  const [toys, setToysState] = useState([]);
  const [clients, setClientsState] = useState([]);
  const [reservations, setReservationsState] = useState([]);
  const [finance, setFinanceState] = useState([]);
  const [company, setCompanyState] = useState(emptyCompany);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Carrega as fontes do Google Fonts uma vez
  React.useEffect(() => {
    const id = 'brinque-gestor-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap';
    document.head.appendChild(link);
  }, []);

  // Carrega todos os dados do Supabase ao iniciar
  const fetchData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await loadAllData();
      setToysState(data.toys);
      setClientsState(data.clients);
      setReservationsState(data.reservations);
      setFinanceState(data.finance);
      setCompanyState(data.company);
    } catch (err) {
      setLoadError(err?.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Indicador visual breve de "salvando..."
  const flashSyncing = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 700);
  };

  // ----- Wrappers de persistência -----
  // Cada wrapper aceita um valor ou uma função updater (como o useState normal),
  // atualiza o estado local imediatamente e envia as diferenças ao Supabase.
  const wrappedSetToys = (updater) => {
    const prev = toys;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setToysState(next);
    syncArrayChanges(prev, next, upsertToy, deleteToy);
    flashSyncing();
  };

  const wrappedSetClients = (updater) => {
    const prev = clients;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setClientsState(next);
    syncArrayChanges(prev, next, upsertClient, deleteClient);
    flashSyncing();
  };

  const wrappedSetFinance = (updater) => {
    const prev = finance;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setFinanceState(next);
    syncArrayChanges(prev, next, upsertFinance, deleteFinance);
    flashSyncing();
  };

  const wrappedSetCompany = (updater) => {
    const prev = company;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setCompanyState(next);
    saveCompany(next).catch((err) => console.error('Erro ao salvar empresa:', err));
    flashSyncing();
  };

  // Sincroniza lançamentos financeiros automáticos de reservas
  // (sinal recebido / valor restante quando concluído)
  const applyFinanceSync = (reservation, prevReservation) => {
    const clientName = clients.find((c) => c.id === reservation.clientId)?.name || 'Cliente';
    setFinanceState((prev) => {
      let next = [...prev];
      const depositId = `auto-deposit-${reservation.id}`;
      const remainingId = `auto-remaining-${reservation.id}`;

      const hasDeposit = next.some((f) => f.id === depositId);
      if ((Number(reservation.deposit) || 0) > 0 && !hasDeposit) {
        next.push({
          id: depositId, type: 'receita',
          description: `Sinal recebido - ${clientName}`, amount: Number(reservation.deposit),
          date: reservation.startDate, reservationId: reservation.id,
        });
      } else if (hasDeposit) {
        next = next.map((f) => f.id === depositId ? { ...f, amount: Number(reservation.deposit) || 0 } : f);
      }

      const wasJustCompleted = reservation.status === 'concluido' && prevReservation?.status !== 'concluido';
      const remaining = (Number(reservation.total) || 0) - (Number(reservation.deposit) || 0);
      const hasRemaining = next.some((f) => f.id === remainingId);
      if (wasJustCompleted && remaining > 0 && !hasRemaining) {
        next.push({
          id: remainingId, type: 'receita',
          description: `Valor restante - ${clientName} (reserva concluída)`, amount: remaining,
          date: todayISO(), reservationId: reservation.id,
        });
      }
      // Persiste apenas os lançamentos novos/alterados gerados automaticamente
      syncArrayChanges(prev, next, upsertFinance, deleteFinance);
      return next;
    });
  };

  const wrappedSetReservations = (updater) => {
    const prev = reservations;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setReservationsState(next);
    syncArrayChanges(prev, next, upsertReservation, deleteReservation);
    for (const r of next) {
      const prevR = prev.find((p) => p.id === r.id);
      if (!prevR || prevR.deposit !== r.deposit || prevR.status !== r.status || prevR.total !== r.total) {
        applyFinanceSync(r, prevR);
      }
    }
    flashSyncing();
  };

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#FBF9FF', fontFamily: "'Nunito', system-ui, sans-serif",
      }}>
        <div style={{ textAlign: 'center', color: '#A39EC0' }}>
          <RefreshCw size={32} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, fontWeight: 700 }}>Carregando dados...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#FBF9FF', fontFamily: "'Nunito', system-ui, sans-serif", padding: 20,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <p style={{ fontWeight: 800, fontSize: 18, color: '#D6486A', marginBottom: 8 }}>Não foi possível carregar os dados</p>
          <p style={{ color: '#8A84A3', fontSize: 14, marginBottom: 16 }}>{loadError}</p>
          <p style={{ color: '#A39EC0', fontSize: 13, marginBottom: 16 }}>
            Verifique se as variáveis de ambiente do Supabase (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY) estão configuradas corretamente.
          </p>
          <button onClick={fetchData} style={{
            padding: '11px 20px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#FF8FB1,#FF6B9D)', color: '#fff', fontWeight: 700, fontSize: 14,
          }}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  let page;
  switch (active) {
    case 'dashboard':
      page = <Dashboard reservations={reservations} clients={clients} toys={toys} setActive={setActive} />;
      break;
    case 'toys':
      page = <ToysPage toys={toys} setToys={wrappedSetToys} />;
      break;
    case 'clients':
      page = <ClientsPage clients={clients} setClients={wrappedSetClients} reservations={reservations} />;
      break;
    case 'reservations':
      page = <ReservationsPage reservations={reservations} setReservations={wrappedSetReservations} toys={toys} clients={clients} setClients={wrappedSetClients} />;
      break;
    case 'availability':
      page = <AvailabilityPage toys={toys} reservations={reservations} />;
      break;
    case 'budgets':
      page = <BudgetsPage reservations={reservations} clients={clients} toys={toys} company={company} budgets={budgets} setBudgets={setBudgets} />;
      break;
    case 'finance':
      page = <FinancePage finance={finance} setFinance={wrappedSetFinance} />;
      break;
    case 'contracts':
      page = <ContractsPage reservations={reservations} clients={clients} toys={toys} company={company} />;
      break;
    case 'receipts':
      page = <ReceiptsPage reservations={reservations} clients={clients} company={company} />;
      break;
    case 'stats':
      page = <StatsPage reservations={reservations} finance={finance} toys={toys} />;
      break;
    case 'company':
      page = <CompanyPage company={company} setCompany={wrappedSetCompany} />;
      break;
    default:
      page = null;
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', background: '#FBF9FF',
      fontFamily: 'var(--font-sans)',
      '--font-display': "'Baloo 2', system-ui, sans-serif",
      '--font-sans': "'Nunito', system-ui, sans-serif",
    }}>
      <style>{`
        @media (max-width: 768px) {
          .main-topbar { display: flex !important; }
          .main-content { padding: 16px !important; }
        }
        * { box-sizing: border-box; }
      `}</style>

      <Sidebar
        active={active} setActive={setActive} companyName={company.name}
        onLogout={handleLogout} syncing={syncing}
        mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar mobile — só aparece em telas pequenas */}
        <div className="main-topbar" style={{
          display: 'none', alignItems: 'center', gap: 14,
          padding: '14px 16px', background: '#fff',
          borderBottom: '1px solid #F1EEFA', position: 'sticky', top: 0, zIndex: 100,
        }}>
          <button onClick={() => setMobileMenuOpen(true)} style={{
            width: 42, height: 42, borderRadius: 14, border: 'none',
            background: '#F5F2FC', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#5B4FCF', flexShrink: 0,
          }}>
            <Menu size={22} strokeWidth={2.3} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg,#FFB84C,#FF6B9D)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <PartyPopper size={17} color="#fff" strokeWidth={2.3} />
            </div>
            <p style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
              color: '#3A3550', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {company.name || 'BrincaGestor'}
            </p>
          </div>
          {syncing && <RefreshCw size={18} color="#9B5DE5" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
        </div>

        <main className="main-content" style={{ flex: 1, padding: '28px 32px', minWidth: 0 }}>
          {page}
        </main>
      </div>
    </div>
  );
}
