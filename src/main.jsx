import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import LoginScreen, { isAuthenticated } from './LoginScreen.jsx';

function Root() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated());

  if (!authenticated) {
    return <LoginScreen onSuccess={() => setAuthenticated(true)} />;
  }

  return <App />;
}

createRoot(document.getElementById('root')).render(<Root />);
