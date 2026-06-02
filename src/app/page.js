'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { format, subDays, addDays, eachDayOfInterval, isSameDay, isBefore, startOfDay } from 'date-fns';

export default function PistonLawnHomeScreen() {
  // Booking Workflow States
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Modal Form Inputs
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');

  // Interface Layout States (Starts collapsed)
  const [isPastOpen, setIsPastOpen] = useState(false);

  // 1. Listen to live database slots
  useEffect(() => {
    const q = query(collection(db, 'slots'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const slotsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSlots(slotsData);
      setLoading(false);
    }, (error) => {
      console.error("Firestore loading error: ", error);
    });

    return () => unsubscribe();
  }, []);

  // 2. Handle client booking submission from modal
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot || !clientName.trim() || !clientPhone.trim() || !clientAddress.trim()) return;

    try {
      const slotRef = doc(db, 'slots', selectedSlot.id);
      await updateDoc(slotRef, {
        isReserved: true,
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

  // 3. Generate rolling timeframes (-5 days to +22 days)
  const today = startOfDay(new Date());
  const startDate = subDays(today, 5);
  const endDate = addDays(today, 22);
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

  const pastDays = dateRange.filter(date => isBefore(date, today) && !isSameDay(date, today));
  const currentAndFutureDays = dateRange.filter(date => !isBefore(date, today) || isSameDay(date, today));

  // Calendar Day Rows Generator UI
  const renderDayRow = (date) => {
    const daySlots = slots.filter(slot => {
      if (!slot.date) return false;
      const slotDate = slot.date.seconds 
        ? new Date(slot.date.seconds * 1000) 
        : new Date(slot.date + 'T00:00:00');
        
      return isSameDay(slotDate, date);
    });

    // FIXED: Sort slots so booked items (isReserved === true) come first (a - b layout logic)
    const sortedDaySlots = [...daySlots].sort((a, b) => {
      const aBooked = a.isReserved || !!a.clientName;
      const bBooked = b.isReserved || !!b.clientName;
      if (aBooked && !bBooked) return -1;
      if (!aBooked && bBooked) return 1;
      return 0;
    });

    const isTodayActive = isSameDay(date, today);
    const dayNoteText = daySlots.find(s => s.dailyNote)?.dailyNote;

    return (
      <div 
        key={date.toString()} 
        className={`p-4 rounded-xl bg-white shadow-sm border transition-all ${
          isTodayActive ? 'border-green-500 bg-green-50/10 ring-1 ring-green-400' : 'border-gray-200'
        } flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3`}
      >
        {/* Date / Day Display */}
        <div className="min-w-[180px] space-y-1">
          <div>
            <span className="font-bold text-gray-900 block text-base">
              {format(date, 'EEEE')}
            </span>
            <span className="text-sm text-gray-500 font-medium">
              {format(date, 'MMM d, yyyy')} {isTodayActive && <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full ml-1">Today</span>}
            </span>
          </div>

          {/* Public Broadcast Note Badge */}
          {dayNoteText && (
            <div className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 rounded px-2 py-1 font-semibold shadow-inner mt-1 max-w-[220px]">
              📌 {dayNoteText}
            </div>
          )}
        </div>

        {/* Dynamic Slots & Bookings Stream Feed (Booked first, open after) */}
        <div className="flex-1 pt-1">
          {sortedDaySlots.length === 0 ? (
            <span className="text-sm italic text-gray-400">No slots available for this date</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sortedDaySlots.map((slot) => {
                const isBooked = !!slot.clientName || slot.isReserved;
                
                if (isBooked) {
                  return (
                    <div key={slot.id} className="text-xs px-3 py-1.5 rounded-lg font-bold bg-gray-100 text-gray-600 border border-gray-200 shadow-sm">
                      🔒 Booked: {slot.clientName}
                    </div>
                  );
                }

                return (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot)}
                    className="text-xs px-3 py-1.5 rounded-lg font-bold border transition-all shadow-sm bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
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
      
      {/* Brand Hero Banner Header */}
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

        {/* Dynamic Success Alert */}
        {bookingSuccess && (
          <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold rounded-xl text-center shadow-sm animate-fade-in">
            🎉 Appointment scheduled successfully! We'll see you then.
          </div>
        )}

        {/* Timeline Divider Separation Banner */}
        <div className="relative flex py-4 items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink mx-4 text-xs font-bold tracking-widest text-gray-400 uppercase">Live Master Cut Schedule</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        {/* Collapsible History Vault Drawer Section */}
        <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
          <button
            onClick={() => setIsPastOpen(!isPastOpen)}
            className="w-full flex items-center justify-between p-2.5 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg text-sm font-bold text-gray-700"
          >
            <span>{isPastOpen ? '▼ Hide Prior 5 Days History' : '► Show Prior 5 Days History'}</span>
            <span className="text-xs text-gray-500 bg-white border px-2 py-0.5 rounded-full shadow-sm font-semibold">
              {pastDays.length} Days Tucked Away
            </span>
          </button>

          {isPastOpen && (
            <div className="mt-4 space-y-3 pl-3 border-l-4 border-gray-300">
              {loading ? <p className="text-sm italic text-gray-400">Syncing database historical feeds...</p> : pastDays.map(renderDayRow)}
            </div>
          )}
        </div>

        {/* Main Active 3-Week Schedule Feed Area */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-12 text-center text-gray-400 font-medium italic bg-white rounded-xl border">
              Loading active live timeline records...
            </div>
          ) : (
            currentAndFutureDays.map(renderDayRow)
          )}
        </div>

      </div>

      {/* POP-UP MODAL WINDOW OVERLAY */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-gray-100 animate-scale-up">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900">Enter Details</h3>
                <p className="text-xs font-bold text-emerald-700 mt-0.5">
                  Reserving: {format(new Date(selectedSlot.date + 'T00:00:00'), 'EEEE, MMM d, yyyy')}
                </p>
              </div>
              <button 
                onClick={() => setSelectedSlot(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1"
              >
                ✕
              </button>
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
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm py-2.5 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm py-2.5 rounded-lg transition shadow-sm"
                >
                  Request Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}