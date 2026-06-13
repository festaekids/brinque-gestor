import React, { useState } from 'react';
import { Lock, PartyPopper } from 'lucide-react';

const STORAGE_KEY = 'brincagestor_auth';

export function isAuthenticated() {
  return sessionStorage.getItem(STORAGE_KEY) === 'ok';
}

export function logout() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export default function LoginScreen({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const correctPassword = import.meta.env.VITE_APP_PASSWORD;

    if (!correctPassword) {
      setError('Senha de acesso não configurada no sistema.');
      return;
    }

    if (password === correctPassword) {
      sessionStorage.setItem(STORAGE_KEY, 'ok');
      onSuccess();
    } else {
      setError('Senha incorreta. Tente novamente.');
      setPassword('');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#FBF9FF', fontFamily: "'Nunito', system-ui, sans-serif", padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, padding: 36, maxWidth: 380, width: '100%',
        boxShadow: '0 12px 40px -16px rgba(80,60,140,0.18)', textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, margin: '0 auto 18px',
          background: 'linear-gradient(135deg,#FFB84C,#FF6B9D)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 18px -8px rgba(255,107,157,0.5)',
        }}>
          <PartyPopper size={30} color="#fff" strokeWidth={2.3} />
        </div>
        <h1 style={{
          fontFamily: "'Baloo 2', system-ui, sans-serif", fontSize: 24, fontWeight: 700,
          color: '#3A3550', margin: '0 0 6px',
        }}>
          BrincaGestor
        </h1>
        <p style={{ fontSize: 14, color: '#A39EC0', margin: '0 0 24px' }}>
          Digite a senha de acesso para continuar
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <Lock size={18} color="#C7BFE8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="password"
              autoFocus
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%', padding: '13px 14px 13px 42px', borderRadius: 14,
                border: '1.5px solid #ECE8F7', fontSize: 15, fontFamily: "'Nunito', system-ui, sans-serif",
                background: '#FBFAFF', color: '#3A3550', boxSizing: 'border-box', outline: 'none',
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#D6486A', fontSize: 13, margin: '0 0 14px', fontWeight: 600 }}>{error}</p>
          )}

          <button
            type="submit"
            style={{
              width: '100%', padding: '13px', borderRadius: 14,
              background: 'linear-gradient(135deg,#FF8FB1,#FF6B9D)', color: '#fff',
              border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Nunito', system-ui, sans-serif",
            }}
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
