'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { format, subDays, addDays, eachDayOfInterval, isSameDay, isBefore, startOfDay } from 'date-fns';

export default function LawnScheduleDashboard() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // Core business states
  const [slots, setSlots] = useState([]);
  const [dayConfigs, setDayConfigs] = useState([]); 
  const [timers, setTimers] = useState([]); // Master client timers array
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  
  // Rescheduling & Timer Form Inputs
  const [movingSlot, setMovingSlot] = useState(null);
  const [targetMoveDate, setTargetMoveDate] = useState('');
  const [newTimerName, setNewTimerName] = useState('');
  const [newTimerStamp, setNewTimerStamp] = useState('');
  
  const [isPastOpen, setIsPastOpen] = useState(false);

  // 1. Sync real-time data streaming straight from Firestore collections
  useEffect(() => {
    if (!isAuthenticated) return;

    const qSlots = query(collection(db, 'slots'));
    const unsubscribeSlots = onSnapshot(qSlots, (snapshot) => {
      const slotsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSlots(slotsData);
    }, (error) => console.error(error));

    const qDays = query(collection(db, 'days'));
    const unsubscribeDays = onSnapshot(qDays, (snapshot) => {
      const daysData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDayConfigs(daysData);
    }, (error) => console.error(error));

    const qTimers = query(collection(db, 'timers'));
    const unsubscribeTimers = onSnapshot(qTimers, (snapshot) => {
      const timersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTimers(timersData);
      setLoading(false);
    }, (error) => console.error(error));

    return () => {
      unsubscribeSlots();
      unsubscribeDays();
      unsubscribeTimers();
    };
  }, [isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === "lawncare2026") {
      setIsAuthenticated(true);
    } else {
      alert('Incorrect access password!');
    }
  };

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    if (!selectedDate) return;
    try {
      await addDoc(collection(db, 'slots'), {
        date: selectedDate,
        isReserved: false,
        status: 'open',
        clientName: '',
        clientPhone: '',
        clientAddress: '',
        dailyNote: ''
      });
      setStatusMessage(`Published slot for ${format(new Date(selectedDate + 'T00:00:00'), 'MMM d, yyyy')}!`);
      setSelectedDate('');
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (error) {
      console.error(error);
    }
  };

  // NEW: Save a client cut timestamp marker to Firestore database tracks
  const handleCreateTimerSubmit = async (e) => {
    e.preventDefault();
    if (!newTimerName.trim() || !newTimerStamp) return;

    try {
      await addDoc(collection(db, 'timers'), {
        name: newTimerName.trim(),
        lastCutAt: newTimerStamp // ISO string containing date and specific hours/minutes parameters
      });
      setNewTimerName('');
      setNewTimerStamp('');
      setStatusMessage('Cut timer parameters published successfully.');
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (error) {
      console.error(error);
      alert("Failed to write timestamp rule variables.");
    }
  };

  // NEW: Purge a tracking metric from the monitor table list
  const handleDeleteTimer = async (timerId, clientLabel) => {
    if (window.confirm(`Remove cut growth tracking configuration for ${clientLabel}?`)) {
      try {
        await deleteDoc(doc(db, 'timers', timerId));
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleNoteChange = async (slotId, text) => {
    try {
      await updateDoc(doc(db, 'slots', slotId), { dailyNote: text });
    } catch (error) { console.error(error); }
  };

  const handleDayRainoutToggle = async (dateKey, currentSetting) => {
    try {
      await setDoc(doc(db, 'days', dateKey), { isRainout: !currentSetting }, { merge: true });
    } catch (error) { console.error(error); }
  };

  const handleCompleteSlot = async (slotId, dateLabel, clientName) => {
    if (window.confirm(`Mark job for ${clientName} on ${dateLabel} as COMPLETE?`)) {
      try {
        await updateDoc(doc(db, 'slots', slotId), { status: 'completed' });
      } catch (error) { console.error(error); }
    }
  };

  const handleDeleteSlot = async (slotId, dateLabel, clientName) => {
    if (window.confirm(clientName ? `Permanently delete booking for ${clientName}?` : `Remove open availability window?`)) {
      try { await deleteDoc(doc(db, 'slots', slotId)); } catch (error) { console.error(error); }
    }
  };

  const handleMoveSlotSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'slots', movingSlot.id), { date: targetMoveDate });
      setMovingSlot(null);
      setTargetMoveDate('');
      setStatusMessage('Rescheduled slot layout configurations updated.');
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (error) { console.error(error); }
  };

  const today = startOfDay(new Date());
  const startDate = subDays(today, 14);
  const endDate = addDays(today, 22);
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

  const pastDays = dateRange.filter(date => isBefore(date, today) && !isSameDay(date, today));
  const currentAndFutureDays = dateRange.filter(date => !isBefore(date, today) || isSameDay(date, today));

  const renderDayRow = (date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayConfig = dayConfigs.find(d => d.id === dateKey);
    const isRainoutChecked = dayConfig ? !!dayConfig.isRainout : false;

    const daySlots = slots.filter(slot => {
      if (!slot.date) return false;
      const slotDate = slot.date.seconds ? new Date(slot.date.seconds * 1000) : new Date(slot.date + 'T00:00:00');
      return isSameDay(slotDate, date);
    });

    const formattedDateLabel = format(date, 'MMM d, yyyy');

    return (
      <div key={date.toString()} className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-start md:justify-between gap-4 ${isRainoutChecked ? 'bg-blue-50/50 border-blue-300 shadow-sm' : isTodayActive ? 'border-green-500 bg-green-50/20 ring-1 ring-green-400' : 'border-gray-200 bg-white'}`}>
        <div className="min-w-[190px] space-y-2">
          <div>
            <span className="font-bold text-gray-900 block text-base flex items-center gap-1.5">
              {format(date, 'EEEE')}
              {isRainoutChecked && <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-600 text-white uppercase tracking-wider">Rained Out</span>}
            </span>
            <span className="text-sm text-gray-500 font-medium block">{formattedDateLabel}</span>
          </div>
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none bg-gray-50 border border-gray-300 px-2.5 py-1.5 rounded-lg shadow-sm hover:bg-gray-100 transition-colors inline-flex">
              <input type="checkbox" checked={isRainoutChecked} onChange={() => handleDayRainoutToggle(dateKey, isRainoutChecked)} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer" />
              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">🌧️ Rainout Day</span>
            </label>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-3">
          {daySlots.length === 0 ? (
            <span className="text-sm italic text-gray-400 pt-1.5">No slots published for this date</span>
          ) : (
            daySlots.map((slot) => {
              const isBooked = !!slot.clientName;
              const isCompleted = slot.status === 'completed';
              return (
                <div key={slot.id} className="p-4 rounded-lg border flex flex-col gap-3 bg-white border-gray-200 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="font-bold text-sm text-gray-800 pt-0.5">{isCompleted ? `✅ Completed Cut: ${slot.clientName}` : isBooked ? `✂️ Scheduled Cut: ${slot.clientName}` : '🟢 Empty Open Availability Window'}</div>
                    <div className="flex flex-wrap sm:flex-col gap-2 self-start sm:self-center min-w-[110px]">
                      {!isCompleted && isBooked && <button onClick={() => handleCompleteSlot(slot.id, formattedDateLabel, slot.clientName)} className="text-xs px-3 py-1.5 rounded font-bold shadow-sm bg-emerald-600 text-white hover:bg-emerald-700 w-full text-center">✓ Complete</button>}
                      {!isCompleted && isBooked && <button onClick={() => setMovingSlot(slot)} className="text-xs px-3 py-1.5 rounded font-bold shadow-sm bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 w-full text-center">➡️ Move Date</button>}
                      <button onClick={() => handleDeleteSlot(slot.id, formattedDateLabel, slot.clientName)} className={`text-xs px-3 py-1.5 rounded font-bold shadow-sm ${isBooked ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'} w-full text-center`}>✕ Delete</button>
                    </div>
                  </div>
                  {isBooked && (
                    <div className="text-xs text-gray-600 font-medium space-y-0.5 bg-gray-50 p-2 rounded border border-gray-200">
                      <p><span className="font-bold text-gray-700">Phone:</span> {slot.clientPhone || 'Not Provided'}</p>
                      <p><span className="font-bold text-gray-700">Address:</span> {slot.clientAddress || 'Not Provided'}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">📢 Broadcast Note</label>
                    <input type="text" placeholder="e.g. Weather delay, working Daphne area, etc..." value={slot.dailyNote || ''} onChange={(e) => handleNoteChange(slot.id, e.target.value)} className="w-full text-xs rounded border border-gray-300 p-2 bg-white text-gray-900 font-medium focus:ring-1 focus:ring-emerald-600 focus:outline-none" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-md border border-gray-200">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Jamie Rush Admin Gateway</h2>
          <input type="password" placeholder="Enter Master Password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full rounded-lg border p-2.5 mb-4 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600" required />
          <button type="submit" className="w-full rounded-lg bg-emerald-700 p-2.5 text-white font-bold hover:bg-emerald-800 transition shadow-sm">Unlock Dashboard</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 sm:p-6 font-sans relative pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Main Scheduler Controls Block */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Jamie Rush Lawn Operations Panel</h1>
            <p className="text-sm text-gray-500 mt-0.5">Real-time scheduling management & lookahead dashboard engine.</p>
          </div>
          <form onSubmit={handleCreateSlot} className="flex gap-2 items-end sm:w-auto w-full">
            <div className="flex-1 sm:w-44">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Publish Working Date</label>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-gray-900 font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none text-sm" required />
            </div>
            <button type="submit" className="bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg hover:bg-emerald-800 transition h-9 text-sm shadow-sm">+ Add Slot</button>
          </form>
        </div>

        {statusMessage && (
          <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold rounded-lg text-sm text-center shadow-inner animate-pulse">{statusMessage}</div>
        )}

        {/* --- NEW: INTERACTIVE LAST CUT TIMER DATA MANAGEMENT WORKSPACE TABLE --- */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-4">
          <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-1.5">⏱️ Client Cut Timer Configurations</h2>
          
          <form onSubmit={handleCreateTimerSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Client Name</label>
              <input type="text" placeholder="e.g. Herb Miller" value={newTimerName} onChange={(e) => setNewTimerName(e.target.value)} className="w-full rounded-lg border p-2 text-sm text-gray-900 font-medium bg-white focus:outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Last Cut Date & Time</label>
              <input type="datetime-local" value={newTimerStamp} onChange={(e) => setNewTimerStamp(e.target.value)} className="w-full rounded-lg border p-2 text-sm text-gray-900 font-medium bg-white focus:outline-none" required />
            </div>
            <button type="submit" className="bg-gray-900 text-white font-bold text-xs py-2.5 rounded-lg shadow-sm hover:bg-black transition">
              Establish Timer Rule
            </button>
          </form>

          {/* Active Data Collection Grid Spreadsheet Table view */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-inner">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="p-3">Client Target Name</th>
                  <th className="p-3">Saved Timestamp Baseline</th>
                  <th className="p-3 text-right">Operational Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-medium">
                {timers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="p-4 text-center italic text-gray-400 bg-gray-50/30">No client timer variables registered inside database tracks.</td>
                  </tr>
                ) : (
                  timers.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 font-bold text-gray-900">{t.name}</td>
                      <td className="p-3 text-gray-500">
                        {t.lastCutAt ? format(new Date(t.lastCutAt), 'PPpp') : 'Invalid Timestamp Rule'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteTimer(t.id, t.name)}
                          className="text-rose-600 hover:text-rose-800 font-bold px-2 py-1 rounded hover:bg-rose-50"
                        >
                          Purge
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Collapsible Vault History */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <button onClick={() => setIsPastOpen(!isPastOpen)} className="w-full flex items-center justify-between p-2 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg text-sm font-bold text-gray-700">
            <span>{isPastOpen ? '▼ Hide Past 14 Days (History Workspace)' : '► Show Past 14 Days (History Workspace)'}</span>
            <span className="text-xs text-gray-500 bg-white border px-2 py-0.5 rounded-full shadow-sm font-semibold">{pastDays.length} Days Hidden</span>
          </button>
          {isPastOpen && <div className="mt-4 space-y-3 pl-3 border-l-4 border-gray-300">{pastDays.map(renderDayRow)}</div>}
        </div>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink mx-4 text-xs font-bold tracking-widest text-gray-400 uppercase">Active Working Horizon Lookout Range</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        <div className="space-y-3">
          {loading ? <div className="p-12 text-center text-gray-500 font-medium italic bg-white rounded-xl border">Refreshing operational data tracks...</div> : currentAndFutureDays.map(renderDayRow)}
        </div>

      </div>

      {/* RE-SCHEDULING CONFIRMATION MODAL */}
      {movingSlot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl border border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">Reschedule Appointment</h3>
                <p className="text-xs font-semibold text-blue-700 mt-0.5">Client: {movingSlot.clientName}</p>
              </div>
              <button onClick={() => setMovingSlot(null)} className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1">✕</button>
            </div>
            <form onSubmit={handleMoveSlotSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">Select New Date Destination</label>
                <input type="date" value={targetMoveDate} onChange={(e) => setTargetMoveDate(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm text-gray-900 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none" required />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setMovingSlot(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm py-2 rounded-lg transition">Cancel</button>
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-2 rounded-lg transition shadow-sm">Confirm Move</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}