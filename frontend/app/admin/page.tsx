"use client";
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, Users, Search, UserPlus, Activity, RotateCcw,
  CheckCircle2, Briefcase, XCircle, Trash2, PlusCircle,
  LayoutGrid, ClipboardList, DollarSign, Calendar, Clock, UserSearch, History, AlertCircle, X
} from 'lucide-react';

type TabType = 'dashboard' | 'doctors' | 'services' | 'patients';

export default function AdminDashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  const [appointments, setAppointments] = useState<any[]>([]);
  const [dentists, setDentists] = useState<any[]>([]);
  const [dbPatients, setDbPatients] = useState<any[]>([]); // Tutaj lądują tylko osoby z rolą 'patient'

  const [searchTerm, setSearchTerm] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");

  const [newDentist, setNewDentist] = useState({
    first_name: "", last_name: "", specialization: "", email: "", phone_number: ""
  });
  const [newService, setNewService] = useState({
    dentist_id: "", name: "", price: ""
  });
  const [newSlot, setNewSlot] = useState({
    dentist_id: "", slot_date: "", start_time: "", service_id: ""
  });

  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [appToCancel, setAppToCancel] = useState<{ appId: string; slotId: string } | null>(null);
  const [showConfirmDeleteDoctor, setShowConfirmDeleteDoctor] = useState(false);
  const [doctorToDelete, setDoctorToDelete] = useState<string | null>(null);
  const [showConfirmDeleteService, setShowConfirmDeleteService] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<{ dentistId: string; serviceId: string } | null>(null);

  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const notify = (msg: string, type: "success" | "error" = "success") => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const token = localStorage.getItem("token");
    if (!token) { router.push("/auth"); return; }
    try {
      const [resApps, resDents, resPats] = await Promise.all([
        fetch("http://127.0.0.1:8000/admin/appointments", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("http://127.0.0.1:8000/dentists"),
        fetch("http://127.0.0.1:8000/admin/patients", { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (resApps.ok) setAppointments(await resApps.json());
      if (resDents.ok) setDentists(await resDents.json());
      if (resPats.ok) setDbPatients(await resPats.json());
    } catch (err) {
      notify("Błąd synchronizacji z serwerem", "error");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, [fetchData]);

  const filteredPatients = useMemo(() => {
    return dbPatients.filter(p => {
      const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
      return fullName.includes(patientSearch.toLowerCase());
    });
  }, [dbPatients, patientSearch]);

  const stats = [
    { label: 'Wszystkie Wizyty', val: appointments.length, icon: <CalendarDays />, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Baza Pacjentów', val: dbPatients.length, icon: <Users />, color: 'text-purple-600', bg: 'bg-purple-50' }, // Statystyka z całej bazy pacjentów
    { label: 'Zespół Lekarski', val: dentists.length, icon: <Briefcase />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Status Systemu', val: 'LIVE', icon: <Activity />, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  const handleAddDentist = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const res = await fetch("http://127.0.0.1:8000/admin/dentists", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(newDentist)
    });
    if (res.ok) { notify("Lekarz dodany."); setNewDentist({first_name:"", last_name:"", specialization:"", email:"", phone_number:""}); fetchData(); }
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...newSlot, dentist_id: String(newSlot.dentist_id) };
    const res = await fetch("http://127.0.0.1:8000/admin/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      notify("Termin dodany.");
      setNewSlot({ dentist_id: "", slot_date: "", start_time: "", service_id: "" });
      fetchData();
    } else { notify("Wypełnij wszystkie pola", "error"); }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { dentist_id: String(newService.dentist_id), name: newService.name, price: String(newService.price) };
    const res = await fetch("http://127.0.0.1:8000/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: JSON.stringify(payload)
    });
    if (res.ok) { notify("Usługa dodana."); setNewService({dentist_id:"", name:"", price:""}); fetchData(); }
  };

  const proceedWithDoctorDelete = async () => {
    if (!doctorToDelete) return;
    const res = await fetch(`http://127.0.0.1:8000/admin/dentists/${doctorToDelete}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });
    if (res.ok) { notify("Lekarz usunięty."); fetchData(); }
    setShowConfirmDeleteDoctor(false);
  };

  const proceedWithServiceDelete = async () => {
    if (!serviceToDelete) return;
    const res = await fetch(`http://127.0.0.1:8000/admin/services/${serviceToDelete.dentistId}/${serviceToDelete.serviceId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });
    if (res.ok) { notify("Usługa usunięta."); fetchData(); }
    setShowConfirmDeleteService(false);
  };

  const proceedWithCancellation = async () => {
    if (!appToCancel) return;
    const res = await fetch(`http://127.0.0.1:8000/admin/cancel/${appToCancel.appId}/${appToCancel.slotId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });
    if (res.ok) { notify("Wizyta anulowana."); fetchData(); }
    setShowConfirmCancel(false);
  };

  const filteredApps = appointments.filter(a =>
    String(a.patient_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(a.dentist_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDentistsForServices = useMemo(() => {
    return dentists.filter(d => `${d.first_name} ${d.last_name}`.toLowerCase().includes(serviceSearch.toLowerCase()));
  }, [dentists, serviceSearch]);

  const ToothIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M17 3C15.5 3 13.5 4.5 12 4.5C10.5 4.5 8.5 3 7 3C4 3 2 5.5 2 9C2 12.5 3.5 15.5 5 18C6.5 20.5 7 22 7 23C7 23.5 7.5 24 8 24H9C9.5 24 10 23.5 10 23C10 20.5 11 18 12 18C13 18 14 20.5 14 23C14 23.5 14.5 24 15 24H16C16.5 24 17 23.5 17 23C17 22 17.5 20.5 19 18C20.5 15.5 22 12.5 22 9C22 5.5 20 3 17 3Z" /></svg>
  );

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-20 selection:bg-blue-600">
      {/* HEADER */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50 py-5">
        <div className="max-w-[1700px] mx-auto px-10 flex justify-between items-center">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30">
              <ToothIcon className="text-white w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black uppercase text-slate-900 tracking-tighter">Dentica Admin</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={fetchData} className={`p-3 rounded-xl bg-slate-50 ${isLoading ? 'animate-spin' : ''}`}><RotateCcw size={20} className="text-slate-400"/></button>
            <Link href="/dashboard"><button className="px-7 py-3.5 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl">Widok Pacjenta</button></Link>
            <button onClick={() => {localStorage.clear(); router.push("/");}} className="px-7 py-3.5 rounded-2xl bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all">Wyloguj</button>
          </div>
        </div>
      </header>

      <main className="max-w-[1700px] mx-auto px-10 py-12 space-y-12">
        <section className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <div key={i} className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm flex items-center gap-8">
              <div className={`w-20 h-20 ${s.bg} ${s.color} rounded-[2rem] flex items-center justify-center`}>{React.cloneElement(s.icon as React.ReactElement, { size: 32 })}</div>
              <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p><p className="text-4xl font-black">{s.val}</p></div>
            </div>
          ))}
        </section>

        <div className="flex gap-4 p-2 bg-white rounded-[2.5rem] border border-slate-100 w-fit shadow-sm">
          {[
            { id: 'dashboard', label: 'Wizyty', icon: <LayoutGrid size={18}/> },
            { id: 'doctors', label: 'Lekarze', icon: <Users size={18}/> },
            { id: 'services', label: 'Cennik', icon: <DollarSign size={18}/> },
            { id: 'patients', label: 'Pacjenci', icon: <UserSearch size={18}/> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`flex items-center gap-3 px-8 py-4 rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? "bg-blue-600 text-white shadow-xl shadow-blue-600/20" : "text-slate-400 hover:bg-slate-50"}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-10">
              <div className="flex justify-between items-center px-4">
                <h2 className="text-xl font-black uppercase flex items-center gap-3"><Clock className="text-blue-600" /> Kolejka Rezerwacji</h2>
                <div className="relative w-64 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input type="text" placeholder="Szukaj wizyty..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-none text-xs font-bold outline-none uppercase" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left uppercase">
                  <thead><tr className="text-[10px] font-black text-slate-400 tracking-widest border-b border-slate-50"><th className="px-4 pb-4">Status</th><th className="px-4 pb-4">Pacjent</th><th className="px-4 pb-4">Lekarz</th><th className="px-4 pb-4">Termin</th><th className="px-4 pb-4 text-right">Akcja</th></tr></thead>
                  <tbody className="divide-y divide-slate-50 text-[12px] font-black">
                    {filteredApps.map((a, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-8 px-4"><span className="px-3 py-1 bg-blue-600 text-white rounded-full text-[8px] tracking-widest">NADCHODZĄCA</span></td>
                        <td className="py-8 px-4">{a.patient_name || 'Pacjent'}</td>
                        <td className="py-8 px-4 text-slate-700">dr {a.dentist_name}</td>
                        <td className="py-8 px-4">{a.slot_date} | {a.start_time?.slice(0,5)}</td>
                        <td className="py-8 px-4 text-right">
                          <button onClick={() => {setAppToCancel({appId: a.id, slotId: a.slot_id}); setShowConfirmCancel(true);}} className="p-3 text-slate-300 hover:text-red-500 transition-all"><XCircle size={20} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'doctors' && (
            <motion.div key="docs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
              <div className="grid lg:grid-cols-12 gap-10">
                <div className="lg:col-span-4 bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-8 h-fit">
                  <h2 className="text-xl font-black uppercase flex items-center gap-3"><UserPlus className="text-blue-600" /> Dodaj Lekarza</h2>
                  <form onSubmit={handleAddDentist} className="space-y-4 uppercase">
                    <input required type="text" placeholder="Imię" className="w-full p-4 rounded-2xl bg-slate-50 font-bold" value={newDentist.first_name} onChange={e => setNewDentist({...newDentist, first_name: e.target.value})} />
                    <input required type="text" placeholder="Nazwisko" className="w-full p-4 rounded-2xl bg-slate-50 font-bold" value={newDentist.last_name} onChange={e => setNewDentist({...newDentist, last_name: e.target.value})} />
                    <input required type="text" placeholder="Specjalizacja" className="w-full p-4 rounded-2xl bg-slate-50 font-bold" value={newDentist.specialization} onChange={e => setNewDentist({...newDentist, specialization: e.target.value})} />
                    <input required type="email" placeholder="E-mail" className="w-full p-4 rounded-2xl bg-slate-50 font-bold" value={newDentist.email} onChange={e => setNewDentist({...newDentist, email: e.target.value})} />
                    <button type="submit" className="w-full py-5 rounded-2xl bg-blue-600 text-white font-black uppercase shadow-xl tracking-widest">Zapisz Lekarza</button>
                  </form>
                </div>
                <div className="lg:col-span-8 bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-8 h-fit">
                  <h2 className="text-xl font-black uppercase flex items-center gap-3"><Calendar className="text-blue-600" /> Otwórz Termin</h2>
                  <form onSubmit={handleAddSlot} className="space-y-8 uppercase">
                    <div className="grid md:grid-cols-3 gap-3">
                      {dentists.map(d => (
                        <button key={d.id} type="button" onClick={() => setNewSlot({...newSlot, dentist_id: String(d.id), service_id: ""})} className={`p-4 rounded-2xl text-left border ${newSlot.dentist_id === String(d.id) ? "bg-blue-600 border-blue-600 text-white shadow-lg" : "bg-white border-slate-100 text-slate-700 shadow-sm"}`}>
                           <span className="text-[11px] font-black uppercase truncate leading-none">{d.first_name}<br/>{d.last_name}</span>
                        </button>
                      ))}
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                      <input required type="date" className="w-full p-4 rounded-2xl bg-slate-50 font-bold" value={newSlot.slot_date} onChange={e => setNewSlot({...newSlot, slot_date: e.target.value})} />
                      <input required type="time" className="w-full p-4 rounded-2xl bg-slate-50 font-bold" value={newSlot.start_time} onChange={e => setNewSlot({...newSlot, start_time: e.target.value})} />
                      <select required className="w-full p-4 rounded-2xl bg-slate-50 font-bold" value={newSlot.service_id} onChange={e => setNewSlot({...newSlot, service_id: e.target.value})} disabled={!newSlot.dentist_id}>
                        <option value="">Wybierz usługę...</option>
                        {dentists.find(d => String(d.id) === String(newSlot.dentist_id))?.services?.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                    <button type="submit" disabled={!newSlot.service_id} className="w-full py-5 rounded-2xl bg-emerald-600 text-white font-black uppercase shadow-lg tracking-widest hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-300 transition-all">Dodaj do grafiku</button>
                  </form>
                </div>
              </div>
              <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-8">
                <h2 className="text-xl font-black uppercase flex items-center gap-3"><Users className="text-blue-600" /> Baza Lekarzy</h2>
                <div className="grid md:grid-cols-3 gap-6">
                  {dentists.map(d => (
                    <div key={d.id} className="p-6 rounded-3xl bg-slate-50 flex justify-between items-center group transition-all hover:bg-white hover:shadow-lg border border-transparent hover:border-slate-100">
                      <div className="uppercase leading-none"><p className="font-black text-slate-900 text-[12px]">dr {d.first_name} {d.last_name}</p><p className="text-[10px] font-bold text-blue-600 tracking-widest mt-1">{d.specialization}</p></div>
                      <button onClick={() => {setDoctorToDelete(String(d.id)); setShowConfirmDeleteDoctor(true);}} className="p-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18}/></button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'services' && (
             <motion.div key="serv" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid lg:grid-cols-12 gap-10">
                <div className="lg:col-span-4 bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-8 h-fit">
                  <h2 className="text-xl font-black uppercase flex items-center gap-3"><PlusCircle className="text-blue-600" /> Nowa Usługa</h2>
                  <form onSubmit={handleAddService} className="space-y-4 uppercase">
                    <select required className="w-full p-4 rounded-2xl bg-slate-50 font-bold" value={newService.dentist_id} onChange={e => setNewService({...newService, dentist_id: e.target.value})}>
                      <option value="">Wybierz lekarza...</option>
                      {dentists.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
                    </select>
                    <input required type="text" placeholder="Zabieg" className="w-full p-4 rounded-2xl bg-slate-50 font-bold uppercase" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} />
                    <input required type="number" placeholder="Cena (zł)" className="w-full p-4 rounded-2xl bg-slate-50 font-bold" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})} />
                    <button type="submit" className="w-full py-5 rounded-2xl bg-blue-600 text-white font-black uppercase shadow-xl tracking-widest">Dodaj do cennika</button>
                  </form>
                </div>
                <div className="lg:col-span-8 bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-8">
                    <div className="flex justify-between items-center px-4">
                      <h2 className="text-xl font-black uppercase flex items-center gap-3"><ClipboardList className="text-blue-600" /> Cennik Specjalistów</h2>
                      <div className="relative w-64 group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="text" placeholder="Filtruj lekarza..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-none text-xs font-bold outline-none uppercase" value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} /></div>
                    </div>
                    <div className="space-y-8">
                    {filteredDentistsForServices.map(d => (
                        <div key={d.id} className="border-b border-slate-50 pb-6 last:border-none uppercase">
                        <p className="font-black text-slate-400 text-[10px] tracking-widest mb-4">Dr {d.last_name}</p>
                        <div className="grid md:grid-cols-2 gap-4">
                            {d.services?.map((s: any) => (
                            <div key={s.id} className="bg-slate-50 px-6 py-4 rounded-2xl flex justify-between items-center group transition-all hover:bg-white hover:shadow-md border border-transparent hover:border-slate-100">
                                <div><span className="text-[12px] font-black text-slate-800">{s.name}</span><p className="text-[11px] font-black text-blue-600 mt-1">{s.price} zł</p></div>
                                <button onClick={() => {
                                    setServiceToDelete({ dentistId: String(d.id), serviceId: String(s.id) });
                                    setShowConfirmDeleteService(true);
                                }} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                            </div>
                            ))}
                        </div>
                        </div>
                    ))}
                    </div>
                </div>
             </motion.div>
          )}

          {activeTab === 'patients' && (
            <motion.div key="pats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-8">
               <div className="flex justify-between items-center px-4">
                  <h2 className="text-xl font-black uppercase flex items-center gap-3"><UserSearch className="text-blue-600" /> Baza Pacjentów</h2>
                  <div className="relative w-64 group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="text" placeholder="Szukaj..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-none text-xs font-bold outline-none uppercase" value={patientSearch} onChange={e => setPatientSearch(e.target.value)} /></div>
               </div>
               <div className="grid md:grid-cols-3 gap-4 uppercase">
                  {filteredPatients.length > 0 ? (
                    filteredPatients.map((p, i) => (
                      <button key={i} onClick={() => setSelectedPatient(`${p.first_name} ${p.last_name}`)} className="w-full text-left p-6 rounded-3xl bg-slate-50 hover:bg-blue-600 hover:text-white transition-all flex justify-between items-center group shadow-sm">
                         <span className="font-black text-[12px] uppercase">{p.first_name} {p.last_name}</span><History size={16} className="group-hover:text-white text-slate-300" />
                      </button>
                    ))
                  ) : (
                    <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">Brak pacjentów w bazie</div>
                  )}
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {(showConfirmCancel || showConfirmDeleteDoctor || showConfirmDeleteService) && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md p-12 rounded-[4rem] text-center shadow-2xl">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6"><AlertCircle size={40} /></div>
                    <h3 className="text-2xl font-black uppercase text-slate-900 mb-4 tracking-tighter">Czy na pewno?</h3>
                    <p className="text-slate-500 text-sm mb-10 uppercase font-bold tracking-tighter text-[10px]">Ta operacja jest nieodwracalna.</p>
                    <div className="flex flex-col gap-4 uppercase">
                        <button
                            onClick={showConfirmCancel ? proceedWithCancellation : (showConfirmDeleteDoctor ? proceedWithDoctorDelete : proceedWithServiceDelete)}
                            className="w-full py-5 rounded-3xl bg-red-600 text-white font-black text-[10px] uppercase shadow-xl hover:bg-red-700 transition-all"
                        >Potwierdzam</button>
                        <button
                            onClick={() => {setShowConfirmCancel(false); setShowConfirmDeleteDoctor(false); setShowConfirmDeleteService(false);}}
                            className="w-full py-5 rounded-3xl bg-slate-50 text-slate-400 font-black text-[10px] uppercase"
                        >Wróć</button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPatient && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPatient(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative bg-white w-full max-w-3xl p-12 rounded-[4rem] shadow-2xl flex flex-col max-h-[85vh] uppercase border border-white">
               <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Historia: {selectedPatient}</h3>
                  <button onClick={() => setSelectedPatient(null)} className="p-3 bg-slate-50 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors"><XCircle size={24} /></button>
               </div>
               <div className="overflow-y-auto space-y-4 pr-4">
                {appointments.filter(a => a.patient_name === selectedPatient).length > 0 ? (
                  appointments.filter(a => a.patient_name === selectedPatient).map((a, i) => (
                    <div key={i} className="p-8 rounded-[2.5rem] border border-slate-100 bg-slate-50 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">lek. dent. {a.dentist_name}</p>
                        <p className="font-black text-slate-900 text-lg uppercase leading-none">{a.service_name}</p>
                      </div>
                      <div className="text-right uppercase">
                         <p className="text-lg font-black text-slate-900 leading-none">{a.slot_date}</p>
                         <p className="text-xs text-blue-600 font-black uppercase tracking-widest mt-2">godz. {a.start_time?.slice(0,5)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">Brak wizyt w historii</div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notification && (
          <motion.div initial={{ opacity: 0, y: 50, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, x: "-50%" }} className={`fixed bottom-10 left-1/2 z-[300] px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-5 text-white backdrop-blur-xl border border-white/10 ${notification.type === 'success' ? 'bg-emerald-600/90' : 'bg-red-600/90'}`}>
            {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
            <p className="font-black uppercase text-[10px] tracking-widest">{notification.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}