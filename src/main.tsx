import React from 'react';
import ReactDOM from 'react-dom/client';
// Keep the complete V0.8 implementation behind its existing entry. B1 imports
// neither its renderer nor its whole-frame foreground heightfield.
const App=React.lazy(()=>new URLSearchParams(location.search).get('mode')==='b1'?import('./b1/App'):import('./App'));
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><React.Suspense fallback={<p>正在载入景观实验…</p>}><App/></React.Suspense></React.StrictMode>);
