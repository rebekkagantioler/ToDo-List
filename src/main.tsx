import React from 'react';
import ReactDOM from 'react-dom/client';
import { Auth } from './Auth';
import { wichtelToken } from './wichtel';
import './styles.css';
const App=React.lazy(()=>import('./App'));
const WichtelPublic=React.lazy(()=>import('./WichtelPublic'));
function Root(){
 const [hash,setHash]=React.useState(()=>window.location.hash);
 React.useEffect(()=>{const update=()=>setHash(window.location.hash);window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update)},[]);
 const token=wichtelToken(hash);
 return <React.Suspense fallback={<div className="loading">Planraum wird geladen …</div>}>{token!==null?<WichtelPublic key={token} token={token}/>:<Auth><App/></Auth>}</React.Suspense>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Root/></React.StrictMode>);
