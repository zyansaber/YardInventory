import { database } from './config';
import { ref, set, get, push, remove, onValue, off } from 'firebase/database';

// Yard Management
export const createYard = async (yardName, yardData) => {
  try {
    await set(ref(database, `Yard/${yardName}`), yardData);
    return { success: true };
  } catch (error) {
    console.error('Error creating yard:', error);
    return { success: false, error: error.message };
  }
};

export const updateYard = async (yardName, yardData) => {
  try {
    await set(ref(database, `Yard/${yardName}`), yardData);
    return { success: true };
  } catch (error) {
    console.error('Error updating yard:', error);
    return { success: false, error: error.message };
  }
};

export const deleteYard = async (yardName) => {
  try {
    await remove(ref(database, `Yard/${yardName}`));
    return { success: true };
  } catch (error) {
    console.error('Error deleting yard:', error);
    return { success: false, error: error.message };
  }
};

export const getAllYards = async () => {
  try {
    const snapshot = await get(ref(database, 'Yard'));
    return snapshot.exists() ? snapshot.val() : {};
  } catch (error) {
    console.error('Error getting yards:', error);
    return {};
  }
};

// Weekly Records Management
export const addWeeklyRecord = async (weekStartDate, recordData) => {
  try {
    const weekRef = ref(database, `weeklyRecords/${weekStartDate}`);
    const snapshot = await get(weekRef);
    
    let records = [];
    if (snapshot.exists()) {
      records = snapshot.val().records || [];
    }
    
    // Find existing record for this dealer or add new one
    const existingIndex = records.findIndex(r => r.dealer === recordData.dealer);
    if (existingIndex >= 0) {
      records[existingIndex] = recordData;
    } else {
      records.push(recordData);
    }
    
    await set(weekRef, { records });
    return { success: true };
  } catch (error) {
    console.error('Error adding weekly record:', error);
    return { success: false, error: error.message };
  }
};

export const getWeeklyRecords = async (weekStartDate) => {
  try {
    const snapshot = await get(ref(database, `weeklyRecords/${weekStartDate}`));
    return snapshot.exists() ? snapshot.val().records || [] : [];
  } catch (error) {
    console.error('Error getting weekly records:', error);
    return [];
  }
};

export const getAllWeeklyRecords = async () => {
  try {
    const snapshot = await get(ref(database, 'weeklyRecords'));
    return snapshot.exists() ? snapshot.val() : {};
  } catch (error) {
    console.error('Error getting all weekly records:', error);
    return {};
  }
};

// Real-time listeners
export const subscribeToYards = (callback) => {
  const yardsRef = ref(database, 'Yard');
  onValue(yardsRef, callback);
  return () => off(yardsRef, 'value', callback);
};

export const subscribeToWeeklyRecords = (callback) => {
  const recordsRef = ref(database, 'weeklyRecords');
  onValue(recordsRef, callback);
  return () => off(recordsRef, 'value', callback);
};

// Utility functions
export const getWeekStartDate = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start of week
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};