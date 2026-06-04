'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { format, subDays, addDays, eachDayOfInterval, isSameDay, isBefore, startOfDay } from 'date-fns';

function SearchableLawnSchedule() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [slots, setSlots] = useState([]);
  const [dayConfigs, setDayConfigs] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  
  const [isPastOpen, setIsPastOpen] = useState(!!searchParams.get('search'));

  useEffect(() => {
    const qSlots = query(collection(db, 'slots'));
    const unsubscribeSlots = onSnapshot(qSlots, (snapshot) => {
      const slotsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSlots(slotsData);
    }, (error) => console.error("Firestore slots connection error: ", error));

    const qDays = query(collection(db, 'days'));
    const unsubscribeDays = onSnapshot(qDays, (snapshot) => {
      const daysData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDayConfigs(daysData);
      setLoading(false);
    }, (error) => console.error("Firestore days configuration error: ", error));

    return () => {
      unsubscribeSlots();
      unsubscribeDays();
    };
  }, []);

  const updateSearchParam = (value) => {
    setSearchQuery(value);
    const params = new URLSearchParams(window.location.search);
    if (value.trim()) {
      params.set('search', value);
      setIsPastOpen(true); 
    } else {
      params.delete('search');
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot || !clientName.trim() || !clientPhone.trim() || !clientAddress.trim()) return;

    try {
      const slotRef = doc(db, 'slots', selectedSlot.id);
      await updateDoc(slotRef, {
        isReserved: true,
        status: 'booked',
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientAddress: clientAddress.trim()
      });

      setBookingSuccess(true);
      setClientName('');
      setClientPhone('');
      setClientAddress('');
      setSelectedSlot(null);
      
      setTimeout(() => setBookingSuccess(false), 5000);
    } catch (error) {
      console.error("Error saving booking: ", error);
      alert("Could not process reservation. Please try again.");
    }
  };

  const today = startOfDay(new Date());
  const startDate = subDays(today, 14);
  const endDate = addDays(today, 22);
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

  const dateMatchesSearch = (date) => {
    if (!searchQuery.trim()) return true;
    const queryClean = searchQuery.toLowerCase().trim();
    
    return slots.some(slot => {
      if (!slot.date || !slot.clientName) return false;
      
      const slotDate = slot.date.seconds 
        ? new Date(slot.date.seconds * 1000) 
        : new Date(slot.date + 'T00:00:00');
        
      if (!isSameDay(slotDate, date)) return false;
      
      return slot.clientName.toLowerCase().includes(queryClean);
    });
  };

  const pastDays = dateRange.filter(date => isBefore(date, today) && !isSameDay(date, today) && dateMatchesSearch(date));
  const currentAndFutureDays = dateRange.filter(date => (!isBefore(date, today) || isSameDay(date, today)) && dateMatchesSearch(date));

  const renderDayRow = (date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayConfig = dayConfigs.find(d => d.id === dateKey);
    const isDayRainout = dayConfig ? !!dayConfig.isRainout : false;

    const daySlots = slots.filter(slot => {
      if (!slot.date) return false;
      const slotDate = slot.date.seconds 
        ? new Date(slot.date.seconds * 1000) 
        : new Date(slot.date + 'T00:00:00');
        
      return isSameDay(slotDate, date);
    });

    const sortedDaySlots = [...daySlots].sort((a, b) => {
      const aReserved = a.status === 'completed' || a.isReserved || !!a.clientName;
      const bReserved = b.status === 'completed' || b.isReserved || !!b.clientName;
      if (aReserved && !bReserved) return -1;
      if (!aReserved && bReserved) return 1;
      return 0;
    });

    const isTodayActive = isSameDay(date, today);
    const dayNoteText = daySlots.find(s => s.dailyNote)?.dailyNote;

    return (
      <div 
        key={date.toString()} 
        className={`p-4 rounded-xl shadow-sm border transition-all flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 ${
          isDayRainout
            ? 'bg-blue-50/60 border-blue-300 ring-1 ring-blue-200' 
            : isTodayActive 
              ? 'border-green-500 bg-green-50/10 ring-1 ring-green-400' 
              : 'border-gray-200 bg-white'
        }`}
      >
        <div className="min-w-[190px] space-y-1.5">
          <div>
            <span className="font-bold text-gray-900 block text-base flex items-center gap-1.5">
              {format(date, 'EEEE')}
              {isDayRainout && <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-600 text-white uppercase tracking-wider animate-pulse">🌧️ Rainout</span>}
            </span>
            <span className="text-sm text-gray-500 font-medium">
              {format(date, 'MMM d, yyyy')} {isTodayActive && !isDayRainout && <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full ml-1">Today</span>}
            </span>
          </div>

          {dayNoteText && (
            <div className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 rounded px-2 py-1 font-semibold shadow-inner mt-1 max-w-[220px]">
              📌 {dayNoteText}
            </div>
          )}
        </div>

        <div className="flex-1 pt-1">
          {daySlots.length === 0 ? (
            <span className="text-sm italic text-gray-400">No slots available for this date</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sortedDaySlots.map((slot) => {
                const isCompleted = slot.status === 'completed';
                const isBooked = !!slot.clientName || slot.isReserved;
                
                if (isCompleted) {
                  return (
                    <div 
                      key={slot.id} 
                      className="text-xs px-3 py-1.5 rounded-lg font-bold bg-black text-white border border-black shadow-sm flex items-center gap-1"
                    >
                      <span>✅ Cut: {slot.clientName}</span>
                    </div>
                  );
                }

                if (isBooked) {
                  return (
                    <div 
                      key={slot.id} 
                      className="text-xs px-3 py-1.5 rounded-lg font-bold bg-gray-100 text-gray-600 border border-gray-200 shadow-sm"
                    >
                      🔒 Booked: {slot.clientName}
                    </div>
                  );
                }

                return (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all shadow-sm ${
                      isDayRainout
                        ? 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    🟢 Available Open Slot
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-12 font-sans relative">
      <div className="bg-emerald-700 text-white text-center py-10 px-4 shadow-sm mb-6">
        <h1 className="text-4xl font-extrabold tracking-tight">Jamie Rush Lawn Service</h1>
        <p className="text-emerald-100 text-lg mt-2 font-semibold">
          Call or Text: (251) 316-1698
        </p>
        <p className="text-emerald-200/80 text-sm mt-1 font-medium">
          View our schedule & reserve your lawn care slot instantly below.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {bookingSuccess && (
          <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold rounded-xl text-center shadow-sm">
            🎉 Appointment scheduled successfully! We'll see you then.
          </div>
        )}

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
            🔍 Filter Timeline by Client Name
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Type client name to look up scheduled or serviced dates (e.g. Herb)..."
              value={searchQuery}
              onChange={(e) => updateSearchParam(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm text-gray-900 font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => updateSearchParam('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink mx-4 text-xs font-bold tracking-widest text-gray-400 uppercase">Live Master Cut Schedule</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
          <button
            onClick={() => setIsPastOpen(!isPastOpen)}
            className="w-full flex items-center justify-between p-2.5 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg text-sm font-bold text-gray-700"
          >
            <span>{isPastOpen ? '▼ Hide Prior 14 Days History' : '► Show Prior 14 Days History'}</span>
            <span className="text-xs text-gray-500 bg-white border px-2 py-0.5 rounded-full shadow-sm font-semibold">
              {pastDays.length} Days Visible
            </span>
          </button>

          {isPastOpen && (
            <div className="mt-4 space-y-3 pl-3 border-l-4 border-gray-300">
              {loading ? (
                <p className="text-sm italic text-gray-400">Syncing database historical feeds...</p>
              ) : pastDays.length === 0 ? (
                <p className="text-sm italic text-gray-400 p-2">No matching historical records found.</p>
              ) : (
                pastDays.map(renderDayRow)
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="p-12 text-center text-gray-400 font-medium italic bg-white rounded-xl border">
              Loading active live timeline records...
            </div>
          ) : currentAndFutureDays.length === 0 ? (
            <div className="p-8 text-center text-gray-400 font-medium italic bg-white rounded-xl border">
              No matching scheduled slots found in the upcoming lookout horizon.
            </div>
          ) : (
            currentAndFutureDays.map(renderDayRow)
          )}
        </div>
      </div>

      {selectedSlot && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900">Enter Details</h3>
                <p className="text-xs font-bold text-emerald-700 mt-0.5">
                  Reserving: {format(new Date(selectedSlot.date + 'T00:00:00'), 'EEEE, MMM d, yyyy')}
                </p>
              </div>
              <button onClick={() => setSelectedSlot(null)} className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1">✕</button>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Your Full Name</label>
                <input
                  type="text"
                  placeholder="John Smith"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm text-gray-900 font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="(251) 555-0199"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm text-gray-900 font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Service Street Address</label>
                <input
                  type="text"
                  placeholder="123 Main St, Daphne, AL"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm text-gray-900 font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setSelectedSlot(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm py-2.5 rounded-lg transition">Cancel</button>
                <button type="submit" className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm py-2.5 rounded-lg transition shadow-sm">Request Appointment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PistonLawnHomeScreenWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 font-medium italic">
        Loading schedule parameters...
      </div>
    }>
      <SearchableLawnSchedule />
    </Suspense>
  );
}