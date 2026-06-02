'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, doc, deleteDoc } from 'firebase/firestore';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [allSlots, setAllSlots] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');

  // Fetch your schedule automatically once logged in
  useEffect(() => {
    if (!isAuthenticated) return;

    const q = query(collection(db, 'slots'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const slotsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      slotsData.sort((a, b) => new Date(a.date) - new Date(b.date));
      setAllSlots(slotsData);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === "lawncare2026") {
      setIsAuthenticated(true);
    } else {
      alert('Incorrect password!');
    }
  };

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    if (!selectedDate) return;

    try {
      await addDoc(collection(db, 'slots'), {
        date: selectedDate,
        isReserved: false,
        clientName: '',
        clientPhone: '',
        clientAddress: ''
      });
      setStatusMessage(`Published slot for ${selectedDate}!`);
      setSelectedDate('');
    } catch (error) {
      console.error(error);
      setStatusMessage('Error creating slot.');
    }
  };

  // New function to handle removing a finished or unwanted slot
  const handleCompleteSlot = async (slotId) => {
    if (window.confirm("Are you sure you want to remove this slot from your schedule?")) {
      try {
        await deleteDoc(doc(db, 'slots', slotId));
      } catch (error) {
        console.error("Error deleting slot: ", error);
        alert("Could not remove slot. Check your Firebase permissions.");
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded bg-white p-6 shadow-md">
          <h2 className="mb-4 text-xl font-bold text-gray-800">Admin Login</h2>
          <input
            type="password"
            placeholder="Enter Password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            className="w-full rounded border p-2 mb-4 text-gray-900 focus:outline-emerald-600"
            required
          />
          <button type="submit" className="w-full rounded bg-emerald-600 p-2 text-white font-semibold hover:bg-emerald-700 transition">
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-800">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Slot Creator Form */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Piston Lawn Dashboard</h1>
          <form onSubmit={handleCreateSlot} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Add Open Working Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded border border-gray-300 p-2 text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>
            <button type="submit" className="bg-emerald-600 text-white font-medium px-6 py-2 rounded hover:bg-emerald-700 h-10 transition">
              Add Slot
            </button>
          </form>
          {statusMessage && <p className="mt-2 text-sm text-emerald-600 font-medium">{statusMessage}</p>}
        </div>

        {/* Master Schedule List */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Your Master Schedule</h2>
          <div className="space-y-4">
            {allSlots.length === 0 ? (
              <p className="text-gray-400 italic">No slots created yet.</p>
            ) : (
              allSlots.map(slot => (
                <div key={slot.id} className={`p-4 rounded-lg border flex flex-col md:flex-row md:justify-between md:items-center ${slot.isReserved ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="font-bold text-gray-900">{new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span className={`mt-1 sm:mt-0 sm:ml-3 w-max px-2 py-0.5 text-xs font-semibold rounded-full ${slot.isReserved ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {slot.isReserved ? 'Booked' : 'Available Open Slot'}
                    </span>
                  </div>
                  
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mt-3 md:mt-0">
                    {slot.isReserved && (
                      <div className="text-sm text-gray-600">
                        <p><strong>Name:</strong> {slot.clientName}</p>
                        <p><strong>Phone:</strong> {slot.clientPhone}</p>
                        <p><strong>Address:</strong> {slot.clientAddress}</p>
                      </div>
                    )}
                    
                    <button 
                      onClick={() => handleCompleteSlot(slot.id)}
                      className="text-xs bg-gray-200 text-gray-700 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded transition font-medium"
                    >
                      {slot.isReserved ? '✓ Complete Job' : '✕ Remove'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}