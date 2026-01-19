import React, { useState, useEffect } from 'react';
import { db } from '../utils/firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { useEvent } from '../contexts/EventContext';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';

export default function EventsPage() {
  const { currentEvent, switchActiveEvent } = useEvent();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  
  // Initial state for a brand new event
  const initialFormState = {
    name: '',
    organizationName: '',
    activities: [{ id: 'general', name: 'General Hours' }]
  };

  const [formData, setFormData] = useState(initialFormState);

  // Listen for all events in real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'events'), (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Handler for New Event button
  const handleCreateNew = () => {
    setEditingEvent(null);
    setFormData(initialFormState);
    setIsModalOpen(true);
  };

  // Handler for Edit Config button
  const handleEditConfig = (event) => {
    setEditingEvent(event);
    setFormData({
      name: event.name || '',
      organizationName: event.organizationName || '',
      activities: event.activities || [{ id: 'general', name: 'General Hours' }]
    });
    setIsModalOpen(true);
  };

  const handleAddActivity = () => {
    setFormData(prev => ({
      ...prev,
      activities: [...prev.activities, { id: '', name: '' }]
    }));
  };

  const handleRemoveActivity = (index) => {
    const newActivities = [...formData.activities];
    newActivities.splice(index, 1);
    setFormData(prev => ({ ...prev, activities: newActivities }));
  };

  const handleActivityChange = (index, field, value) => {
    const newActivities = [...formData.activities];
    newActivities[index][field] = value;
    
    // Automatically generate slug/ID from name for URL routing
    if (field === 'name' && !newActivities[index].id) {
      newActivities[index].id = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
    
    setFormData(prev => ({ ...prev, activities: newActivities }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        await updateDoc(doc(db, 'events', editingEvent.id), formData);
      } else {
        await addDoc(collection(db, 'events'), formData);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving event:", err);
    }
  };

  if (loading) return <div className="p-20 text-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Events Management</h1>
        <Button onClick={handleCreateNew} variant="primary">+ Create New Event</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map(event => {
          const isActive = currentEvent?.id === event.id;

          return (
            <div 
              key={event.id} 
              className={`bg-white p-6 rounded-xl shadow-md border transition-all ${
                isActive ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-bold text-gray-900">{event.name}</h2>
                {isActive && (
                  <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                    Active Selection
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-sm mb-4">{event.organizationName}</p>
              
              <div className="mb-6">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">Time Buckets</p>
                <div className="flex flex-wrap gap-2">
                  {(event.activities || []).map(act => (
                    <span key={act.id} className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded border border-gray-200">
                      {act.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <button 
                  onClick={() => handleEditConfig(event)}
                  className="text-sm font-bold text-gray-400 hover:text-primary-600 transition-colors"
                >
                  Edit Config
                </button>

                {!isActive ? (
                  <button 
                    onClick={() => switchActiveEvent(event.id)}
                    className="text-sm font-bold text-primary-600 bg-primary-50 px-4 py-1.5 rounded-lg hover:bg-primary-100 transition-colors"
                  >
                    Switch to Event
                  </button>
                ) : (
                  <span className="text-sm font-bold text-green-600 flex items-center">
                    <span className="mr-1">✓</span> Selected
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Configuration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 max-h-[85vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">
              {editingEvent ? 'Modify Event Config' : 'Setup New Event'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Event Name</label>
                  <input 
                    className="w-full border-gray-300 border rounded-lg p-3 focus:ring-2 focus:ring-primary-500 outline-none" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. VBS 2026"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Organization</label>
                  <input 
                    className="w-full border-gray-300 border rounded-lg p-3 focus:ring-2 focus:ring-primary-500 outline-none" 
                    value={formData.organizationName} 
                    onChange={e => setFormData({...formData, organizationName: e.target.value})}
                    placeholder="e.g. Horizons Church"
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Defined Activities</label>
                  <button type="button" onClick={handleAddActivity} className="text-primary-600 text-xs font-bold hover:underline">+ ADD ITEM</button>
                </div>
                
                <div className="space-y-3">
                  {formData.activities.map((activity, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-100 relative">
                      <div className="flex justify-between items-start mb-2">
                        <input 
                          placeholder="Name (e.g. Training)" 
                          className="bg-transparent font-bold text-gray-800 focus:outline-none w-full"
                          value={activity.name}
                          onChange={e => handleActivityChange(index, 'name', e.target.value)}
                        />
                        <button type="button" onClick={() => handleRemoveActivity(index)} className="text-gray-400 hover:text-red-500 ml-2">×</button>
                      </div>
                      <div className="flex items-center text-[10px] text-gray-400 font-mono">
                        <span className="mr-1">URL SLUG:</span>
                        <input 
                          className="bg-white border rounded px-1 text-gray-600 focus:outline-none"
                          value={activity.id}
                          onChange={e => handleActivityChange(index, 'id', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <Button type="submit" className="flex-1 py-3">Save Configuration</Button>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}