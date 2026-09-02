import React, { useEffect, useState } from 'react'

export default function Incidents({token}:{token:string}){
  const [incidents,setIncidents]=useState<any[]>([])
  const [tripId,setTripId]=useState<number | ''>('')
  const [type,setType]=useState('')
  const [trips,setTrips]=useState<any[]>([])

  async function load(){
    const [iRes,tRes] = await Promise.all([
      fetch((import.meta.env.VITE_API_URL||'')+'/incidents', { headers:{ Authorization:'Bearer '+token } }),
      fetch((import.meta.env.VITE_API_URL||'')+'/trips', { headers:{ Authorization:'Bearer '+token } })
    ])
    setIncidents(await iRes.json())
    setTrips(await tRes.json())
  }
  useEffect(()=>{ load() }, [])

  async function create(e:any){
    e.preventDefault()
    await fetch((import.meta.env.VITE_API_URL||'') + '/incidents', { method:'POST', headers:{'Content-Type':'application/json', Authorization: 'Bearer '+token}, body:JSON.stringify({ tripId, type }) })
    setTripId('')
    setType('')
    load()
  }

  return (
    <div>
      <h2>Incidents</h2>
      <form onSubmit={create}>
        <select value={tripId as any} onChange={e=>setTripId(e.target.value?Number(e.target.value):'')}>
          <option value="">Choose trip</option>
          {trips.map((t:any)=> <option key={t.id} value={t.id}>{t.id} - {new Date(t.startAt).toLocaleString()}</option>)}
        </select>
        <input value={type} onChange={e=>setType(e.target.value)} placeholder="type" />
        <button>Create</button>
      </form>
      <ul>
        {incidents.map(i=> <li key={i.id}>{i.type} — trip {i.tripId}</li>)}
      </ul>
    </div>
  )
}
