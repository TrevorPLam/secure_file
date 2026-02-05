// AI-META-BEGIN
// AI-META: React application entry point - mounts root App component to DOM
// OWNERSHIP: client/root
// ENTRYPOINTS: Loaded by index.html as main module entry
// DEPENDENCIES: react-dom/client (createRoot), ./App (root component), ./index.css (global styles)
// DANGER: Assumes #root element exists in HTML; strict mode disabled for production
// CHANGE-SAFETY: Safe to add global providers or error boundaries
// TESTS: Build verification via `npm run build`
// AI-META-END

import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(<App />)
