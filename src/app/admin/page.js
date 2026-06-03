'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { format, subDays, addDays, eachDayOfInterval, isSameDay, isBefore, startOfDay } from 'date-fns';

export default function LawnScheduleDashboard() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // Business logic states
  const [slots, setSlots] = useState([]);
  const [dayConfigs, setDayConfigs] = useState([]); // Master tracking state for standalone day rainouts
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  
  // Interface layout states
  const [isPastOpen, setIsPastOpen] = useState(false);

  // 1. Sync real-time data streaming straight from Firestore collections
  useEffect(() => {
    if (!isAuthenticated) return;

    // Stream individual appointment slots
    const qSlots = query(collection(db, 'slots'));
    const unsubscribeSlots = onSnapshot(qSlots, (snapshot) => {
      const slotsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSlots(slotsData);
    }, (error) => console.error("Slots stream error: ", error));

    // Stream blanket daily configs (Rainouts)
    const qDays = query(collection(db, 'days'));
    const unsubscribeDays = onSnapshot(qDays, (snapshot) => {
      const daysData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDayConfigs(daysData);
      setLoading(false);
    }, (error) => console.error("Days configuration stream error: ", error));

    return () => {
      unsubscribeSlots();
      unsubscribeDays();
    };
  }, [isAuthenticated]);

  // 2. Security access pass check
  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === "lawncare2026") {
      setIsAuthenticated(true);
    } else {
      alert('Incorrect access password!');
    }
  };

  // 3. Create a brand new vacant slot
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
      console.error("Error creating slot: ", error);
      setStatusMessage('Failed to save slot to database.');
    }
  };

  // 4. Update the short broadcast note on the fly
  const handleNoteChange = async (slotId, text) => {
    try {
      const slotRef = doc(db, 'slots', slotId);
      await updateDoc(slotRef, {
        dailyNote: text
      });
    } catch (error) {
      console.error("Error saving note: ", error);
    }
  };

  // 5. FIXED: Toggle master blanket Rainout state on the actual day itself
  const handleDayRainoutToggle = async (dateKey, currentSetting) => {
    try {
      const dayRef = doc(db, 'days', dateKey);
      await setDoc(dayRef, {
        isRainout: !currentSetting
      }, { merge: true });
    } catch (error) {
      console.error("Error toggling master day rainout: ", error);
    }
  };

  // 6. Complete a job or delete unbooked empty slots
  const handleCompleteSlot = async (slotId, dateLabel, clientName) => {
    if (clientName) {
      if (window.confirm(`Mark job for ${clientName} on ${dateLabel} as COMPLETE?`)) {
        try {
          const slotRef = doc(db, 'slots', slotId);
          await updateDoc(slotRef, {
            status: 'completed'
          });
        } catch (error) {
          console.error("Error completing job document: ", error);
        }
      }
    } else {
      if (window.confirm(`Remove open availability slot on ${dateLabel}?`)) {
        try {
          await deleteDoc(doc(db, 'slots', slotId));
        } catch (error) {
          console.error("Error removing document: ", error);
        }
      }
    }
  };

  // 7. Generate rolling timeframes (-14 days to +22 days)
  const today = startOfDay(new Date());
  const startDate = subDays(today, 14);
  const endDate = addDays(today, 22);
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

  const pastDays = dateRange.filter(date => isBefore(date, today) && !isSameDay(date, today));
  const currentAndFutureDays = dateRange.filter(date => !isBefore(date, today) || isSameDay(date, today));

  // Render Layout Rows Generator
  const renderDayRow = (date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    
    // Check if this specific day is explicitly marked as a rainout in the database
    const dayConfig = dayConfigs.find(d => d.id === dateKey);
    const isRainoutChecked = dayConfig ? !!dayConfig.isRainout : false;

    const daySlots = slots.filter(slot => {
      if (!slot.date) return false;
      const slotDate = slot.date.seconds 
        ? new Date(slot.date.seconds * 1000) 
        : new Date(slot.date + 'T00:00:00');
      return isSameDay(slotDate, date);
    });

    const isTodayActive = isSameDay(date, today);
    const formattedDateLabel = format(date, 'MMM d, yyyy');

    return (
      <div 
        key={date.toString()} 
        className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-start md:justify-between gap-4 ${
          isRainoutChecked
            ? 'bg-blue-50/50 border-blue-300 shadow-sm'
            : isTodayActive 
              ? 'border-green-500 bg-green-50/20 ring-1 ring-green-400' 
              : 'border-gray-200 bg-white'
        }`}
      >
        {/* Date / Weekday Label and Master Rainout Box */}
        <div className="min-w-[190px] space-y-2">
          <div>
            <span className="font-bold text-gray-900 block text-base flex items-center gap-1.5">
              {format(date, 'EEEE')}
              {isRainoutChecked && <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-600 text-white uppercase tracking-wider">Rained Out</span>}
            </span>
            <span className="text-sm text-gray-500 font-medium block">
              {formattedDateLabel} {isTodayActive && <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full ml-1">Today</span>}
            </span>
          </div>

          {/* --- FIXED: Rainout Checkbox placed on the actual day control panel itself --- */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none bg-gray-50 border border-gray-300 px-2.5 py-1.5 rounded-lg shadow-sm hover:bg-gray-100 transition-colors w-full sm:w-auto inline-flex">
              <input
                type="checkbox"
                checked={isRainoutChecked}
                onChange={() => handleDayRainoutToggle(dateKey, isRainoutChecked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">🌧️ Rainout Day</span>
            </label>
          </div>
        </div>

        {/* Current matching slot loops inside database */}
        <div className="flex-1 flex flex-col gap-3">
          {daySlots.length === 0 ? (
            <span className="text-sm italic text-gray-400 pt-1.5">No slots published for this date</span>
          ) : (
            daySlots.map((slot) => {
              const isBooked = !!slot.clientName;
              const isCompleted = slot.status === 'completed';
              
              return (
                <div 
                  key={slot.id} 
                  className={`p-3.5 rounded-lg border flex flex-col gap-3 bg-white border-gray-200 shadow-sm`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="font-bold text-sm text-gray-800">
                      {isCompleted 
                        ? `✅ Completed Cut: ${slot.clientName}` 
                        : isBooked 
                          ? `✂️ Scheduled Cut: ${slot.clientName}` 
                          : '🟢 Empty Open Availability Window'}
                    </div>
                    
                    {!isCompleted && (
                      <button
                        onClick={() => handleCompleteSlot(slot.id, formattedDateLabel, slot.clientName)}
                        className={`text-xs px-2.5 py-1 rounded font-bold transition-colors self-start sm:self-center ${
                          isBooked 
                            ? 'bg-amber-600 text-white hover:bg-green-700' 
                            : 'bg-white text-gray-700 border hover:bg-gray-100'
                        }`}
                      >
                        {isBooked ? '✓ Complete' : '✕ Remove'}
                      </button>
                    )}
                  </div>

                  {isBooked && (
                    <div className="text-xs text-gray-600 font-medium space-y-0.5 bg-gray-50 p-2 rounded border border-gray-200">
                      <p><span className="font-bold text-gray-700">Phone:</span> {slot.clientPhone || 'Not Provided'}</p>
                      <p><span className="font-bold text-gray-700">Address:</span> {slot.clientAddress || 'Not Provided'}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                      📢 Broadcast Note
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Weather delay, working Daphne area, etc..."
                      value={slot.dailyNote || ''}
                      onChange={(e) => handleNoteChange(slot.id, e.target.value)}
                      className="w-full text-xs rounded border border-gray-300 p-2 bg-white text-gray-900 font-medium focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                    />
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
          <input
            type="password"
            placeholder="Enter Master Password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            className="w-full rounded-lg border p-2.5 mb-4 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
            required
          />
          <button type="submit" className="w-full rounded-lg bg-emerald-700 p-2.5 text-white font-bold hover:bg-emerald-800 transition shadow-sm">
            Unlock Dashboard
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 sm:p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Block Control Component Area */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Jamie Rush Lawn Operations Panel</h1>
            <p className="text-sm text-gray-500 mt-0.5">Real-time scheduling management & lookahead dashboard engine.</p>
          </div>
          <form onSubmit={handleCreateSlot} className="flex gap-2 items-end sm:w-auto w-full">
            <div className="flex-1 sm:w-44">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Publish Working Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2 text-gray-900 font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none text-sm"
                required
              />
            </div>
            <button type="submit" className="bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg hover:bg-emerald-800 transition h-9 text-sm shadow-sm">
              + Add Slot
            </button>
          </form>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold rounded-lg text-sm text-center shadow-inner animate-pulse">
            {statusMessage}
          </div>
        )}

        {/* Collapsible Vault Section */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <button
            onClick={() => setIsPastOpen(!isPastOpen)}
            className="w-full flex items-center justify-between p-2 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg text-sm font-bold text-gray-700"
          >
            <span>{isPastOpen ? '▼ Hide Past 14 Days (History Workspace)' : '► Show Past 14 Days (History Workspace)'}</span>
            <span className="text-xs text-gray-500 bg-white border px-2 py-0.5 rounded-full shadow-sm font-semibold">
              {pastDays.length} Days Hidden
            </span>
          </button>

          {isPastOpen && (
            <div className="mt-4 space-y-3 pl-3 border-l-4 border-gray-300">
              {loading ? <p className="text-sm italic text-gray-400">Loading historical slot records...</p> : pastDays.map(renderDayRow)}
            </div>
          )}
        </div>

        {/* Timeline break partition */}
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink mx-4 text-xs font-bold tracking-widest text-gray-400 uppercase">Active Working Horizon Lookout Range</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        {/* Active Schedule Monitor Feed */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-12 text-center text-gray-500 font-medium italic bg-white rounded-xl border">
              Refreshing operational data tracks from Google Firestore...
            </div>
          ) : (
            currentAndFutureDays.map(renderDayRow)
          )}
        </div>

      </div>
    </div>
  );
}