import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../utils/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import Input from '../components/common/Input';

export default function CreateEventPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    organizationName: '',
    startDate: '',
    endDate: '',
    supervisorName: '',
    typicalStartTime: '09:00',
    typicalEndTime: '15:00'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // addDoc auto-generates a unique ID for the new event
      const docRef = await addDoc(collection(db, 'events'), {
        ...formData,
        createdAt: serverTimestamp() // Use server-side time for consistency
      });

      console.log("Event created with ID: ", docRef.id);
      navigate('/admin/events'); // Redirect back to list
    } catch (err) {
      console.error("Error adding event: ", err);
      alert("Failed to create event. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="p-8">
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-6 text-gray-900">Create New Volunteer Event</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Event Name" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g. VBS 2026" />
            <Input label="Organization" name="organizationName" value={formData.organizationName} onChange={handleChange} required />

            <div className="grid grid-cols-2 gap-4">
              <Input label="Start Date" type="date" name="startDate" value={formData.startDate} onChange={handleChange} required />
              <Input label="End Date" type="date" name="endDate" value={formData.endDate} onChange={handleChange} required />
            </div>

            <Input label="Supervisor Name" name="supervisorName" value={formData.supervisorName} onChange={handleChange} required />

            <div className="grid grid-cols-2 gap-4">
              <Input label="Typical Start" type="time" name="typicalStartTime" value={formData.typicalStartTime} onChange={handleChange} />
              <Input label="Typical End" type="time" name="typicalEndTime" value={formData.typicalEndTime} onChange={handleChange} />
            </div>

            <div className="flex gap-4 mt-8">
              <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                {loading ? 'Creating...' : 'Create Event'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/admin/events')}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}