import React, { useState } from 'react'
import Drivers from './pages/Drivers'
import Trips from './pages/Trips'
import Incidents from './pages/Incidents'

export default function App(){
  const [token, setToken] = useState<string | null>(null)
  const [view, setView] = useState<'drivers'|'trips'|'incidents'>('drivers')

  if (!token){
    return <Auth onToken={t=>setToken(t)} />
  }

  return (
    <div style={{padding:20}}>
      <h1>Drive Today — DSMS (MVP)</h1>
      <nav style={{marginBottom:10}}>
        <button onClick={()=>setView('drivers')}>Drivers</button>
        <button onClick={()=>setView('trips')}>Trips</button>
        <button onClick={()=>setView('incidents')}>Incidents</button>
        <button onClick={()=>{ setToken(null); localStorage.removeItem('dt_token') }}>Logout</button>
      </nav>
      {view==='drivers' && <Drivers token={token} />}
      {view==='trips' && <Trips token={token} />}
      {view==='incidents' && <Incidents token={token} />}
    </div>
  )
}

function Auth({onToken}:{onToken:(t:string)=>void}){
  const [email,setEmail]=useState('admin@local')
  const [password,setPassword]=useState('password')
  const [mode,setMode]=useState<'login'|'register'>('login')

  async function submit(e:any){
    e.preventDefault()
    const url = (mode==='login')?'/auth/login':'/auth/register'
    const res = await fetch((import.meta.env.VITE_API_URL||'') + url, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email,password})
    })
    const data = await res.json()
    if (data.token) {
      localStorage.setItem('dt_token', data.token)
      onToken(data.token)
    } else if (mode==='register' && data.id) {
      // after register, switch to login
      setMode('login')
    } else if (data.token===undefined && data.id!==undefined) {
      // handle early register responses
      setMode('login')
    } else {
      alert(JSON.stringify(data))
    }
  }

  return (
    <form onSubmit={submit} style={{padding:20}}>
      <h2>{mode==='login'? 'Login' : 'Register'}</h2>
      <div>
        <label>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} />
      </div>
      <div>
        <label>Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      </div>
      <button type="submit">{mode==='login' ? 'Login' : 'Register'}</button>
      <div>
        <button type="button" onClick={()=>setMode(mode==='login'? 'register' : 'login')}>Switch to {mode==='login'?'Register':'Login'}</button>
      </div>
    </form>
  )
}
