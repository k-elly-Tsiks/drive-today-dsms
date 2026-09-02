import React, { useEffect, useState } from 'react'

export default function Trips({token}:{token:string}){
  const [trips,setTrips]=useState<any[]>([])
  const [startAt,setStartAt]=useState('')
  const [driverId,setDriverId]=useState<number | ''>('')
  const [drivers,setDrivers]=useState<any[]>([])

  async function load(){
    const [tRes,dRes] = await Promise.all([
      fetch((import.meta.env.VITE_API_URL||'')+'/trips', { headers:{ Authorization:'Bearer '+token } }),
      fetch((import.meta.env.VITE_API_URL||'')+'/drivers', { headers:{ Authorization:'Bearer '+token } })
    ])
    setTrips(await tRes.json())
    setDrivers(await dRes.json())
  }
  useEffect(()=>{ load() }, [])

  async function create(e:any){
    e.preventDefault()
    await fetch((import.meta.env.VITE_API_URL||'') + '/trips', { method:'POST', headers:{'Content-Type':'application/json', Authorization: 'Bearer '+token}, body:JSON.stringify({ startAt, driverId }) })
    setStartAt('')
    setDriverId('')
    load()
  }

  return (
    <div>
      <h2>Trips</h2>
      <form onSubmit={create}>
        <input type="datetime-local" value={startAt} onChange={e=>setStartAt(e.target.value)} />
        <select value={driverId as any} onChange={e=>setDriverId(e.target.value?Number(e.target.value):'')}>
          <option value="">Choose driver</option>
          {drivers.map((d:any)=> <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button>Create</button>
      </form>
      <ul>
        {trips.map(t=> <li key={t.id}>{new Date(t.startAt).toLocaleString()} — {t.driver?.name || 'no driver'}</li>)}
      </ul>
    </div>
  )
}
