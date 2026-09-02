import React, { useEffect, useState } from 'react'

export default function Drivers({token}:{token:string}){
  const [drivers,setDrivers]=useState<any[]>([])
  const [name,setName]=useState('')

  async function load(){
    const res = await fetch((import.meta.env.VITE_API_URL||'') + '/drivers', { headers: { Authorization: 'Bearer '+token } })
    const data = await res.json()
    setDrivers(data)
  }
  useEffect(()=>{ load() }, [])

  async function create(e:any){
    e.preventDefault()
    await fetch((import.meta.env.VITE_API_URL||'') + '/drivers', { method:'POST', headers:{'Content-Type':'application/json', Authorization: 'Bearer '+token}, body:JSON.stringify({name}) })
    setName('')
    load()
  }

  return (
    <div>
      <h2>Drivers</h2>
      <form onSubmit={create}>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Driver name" />
        <button>Create</button>
      </form>
      <ul>
        {drivers.map(d=> <li key={d.id}>{d.name} {d.licenseNo? `(${d.licenseNo})`:''}</li>)}
      </ul>
    </div>
  )
}
