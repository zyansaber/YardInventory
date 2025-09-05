import React, { useState, useEffect } from 'react';
import { getAllYards, addWeeklyRecord, getWeeklyRecords, getWeekStartDate, getAllWeeklyRecords } from '../firebase/database';

const DataEntry = () => {
  const [yards, setYards] = useState({});
  const [allWeeklyRecords, setAllWeeklyRecords] = useState({});
  const [stockInputs, setStockInputs] = useState({});
  const [dateInputs, setDateInputs] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});
  const [unreportedYards, setUnreportedYards] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [yardsData, allRecordsData] = await Promise.all([
      getAllYards(),
      getAllWeeklyRecords()
    ]);
    
    setYards(yardsData);
    setAllWeeklyRecords(allRecordsData);
    
    // Initialize date inputs with today's date
    const today = new Date().toISOString().split('T')[0];
    const initialDates = {};
    const initialStocks = {};
    
    Object.keys(yardsData).forEach(yardName => {
      initialDates[yardName] = today;
      
      // Try to get existing data for today's week
      const weekStart = getWeekStartDate(today);
      const weekRecords = allRecordsData[weekStart]?.records || [];
      const existingRecord = weekRecords.find(r => r.dealer === yardName);
      if (existingRecord) {
        initialStocks[yardName] = existingRecord.stock.toString();
      }
    });
    
    setDateInputs(initialDates);
    setStockInputs(initialStocks);
    
    // Calculate unreported yards for current week
    const currentWeek = getWeekStartDate();
    const currentWeekRecords = allRecordsData[currentWeek]?.records || [];
    const reportedYards = new Set(currentWeekRecords.map(r => r.dealer));
    const unreported = Object.keys(yardsData).filter(yardName => !reportedYards.has(yardName));
    setUnreportedYards(unreported);
    
    setLoading(false);
  };

  const handleStockChange = (yardName, value) => {
    setStockInputs({
      ...stockInputs,
      [yardName]: value
    });
  };

  const handleDateChange = async (yardName, date) => {
    setDateInputs({
      ...dateInputs,
      [yardName]: date
    });

    // Load existing data for the selected week
    const weekStart = getWeekStartDate(date);
    const weekRecords = allWeeklyRecords[weekStart]?.records || [];
    const existingRecord = weekRecords.find(r => r.dealer === yardName);
    
    if (existingRecord) {
      setStockInputs({
        ...stockInputs,
        [yardName]: existingRecord.stock.toString()
      });
    } else {
      setStockInputs({
        ...stockInputs,
        [yardName]: ''
      });
    }
  };

  const handleSubmit = async (yardName) => {
    const stockValue = parseInt(stockInputs[yardName]);
    if (isNaN(stockValue) || stockValue < 0) return;

    const selectedDate = dateInputs[yardName];
    const weekStart = getWeekStartDate(selectedDate);

    setSaving({ ...saving, [yardName]: true });

    const recordData = {
      dealer: yardName,
      stock: stockValue,
      status: 'Reported',
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    const result = await addWeeklyRecord(weekStart, recordData);
    
    if (result.success) {
      loadData();
    }
    
    setSaving({ ...saving, [yardName]: false });
  };

  const getStockStatus = (yardName, stock) => {
    const yard = yards[yardName];
    if (!yard || yard.Min === null || yard.Max === null) {
      return { status: 'unknown', color: 'bg-gray-100 text-gray-800' };
    }

    if (stock < yard.Min) {
      return { status: 'low', color: 'bg-red-100 text-red-800' };
    } else if (stock > yard.Max) {
      return { status: 'high', color: 'bg-yellow-100 text-yellow-800' };
    } else {
      return { status: 'normal', color: 'bg-green-100 text-green-800' };
    }
  };

  const getCurrentStock = (yardName) => {
    const selectedDate = dateInputs[yardName];
    const weekStart = getWeekStartDate(selectedDate);
    const weekRecords = allWeeklyRecords[weekStart]?.records || [];
    const record = weekRecords.find(r => r.dealer === yardName);
    return record ? record.stock : null;
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'low': return 'Below Min';
      case 'high': return 'Above Max';
      case 'normal': return 'Normal';
      default: return 'No Limits';
    }
  };

  const getUnreportedWeeksCount = (yardName) => {
    const currentWeek = getWeekStartDate();
    const weeks = Object.keys(allWeeklyRecords).sort().reverse();
    let count = 0;
    
    for (const week of weeks) {
      if (week > currentWeek) continue;
      
      const records = allWeeklyRecords[week].records || [];
      const hasReport = records.some(r => r.dealer === yardName);
      
      if (!hasReport) {
        count++;
      } else {
        break;
      }
    }
    
    return count;
  };

  const getSeverityColor = (weeksCount) => {
    if (weeksCount >= 4) return 'text-red-600';
    if (weeksCount >= 2) return 'text-yellow-600';
    return 'text-green-600';
  };

  const handleUnreportedYardClick = (yardName) => {
    // Focus on the yard's input field
    const inputElement = document.getElementById(`stock-${yardName}`);
    if (inputElement) {
      inputElement.focus();
      inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Inventory Data Entry</h2>
        
        <div className="text-sm text-gray-600 mb-4">
          Enter stock levels for each yard. You can select different dates for individual yards.
        </div>

        {/* Unreported Yards Alert */}
        {unreportedYards.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center mb-2">
              <span className="text-red-600 mr-2">⚠️</span>
              <h3 className="text-sm font-medium text-red-800">
                {unreportedYards.length} yard(s) missing data this week
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {unreportedYards.map(yardName => {
                const weeksCount = getUnreportedWeeksCount(yardName);
                return (
                  <button
                    key={yardName}
                    onClick={() => handleUnreportedYardClick(yardName)}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 transition-colors cursor-pointer"
                  >
                    {yardName}
                    <span className={`ml-1 ${getSeverityColor(weeksCount)}`}>
                      ({weeksCount}w)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">Yard Inventory ({Object.keys(yards).length} yards)</h3>
        </div>
        
        <div className="divide-y divide-gray-100">
          {Object.entries(yards)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([yardName, yardData]) => {
              const currentStock = getCurrentStock(yardName);
              const stockStatus = currentStock !== null ? getStockStatus(yardName, currentStock) : null;
              const unreportedWeeks = getUnreportedWeeksCount(yardName);
              
              return (
                <div key={yardName} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-1">
                        <h4 className="text-base font-medium text-gray-900 truncate">{yardName}</h4>
                        <span className="text-sm text-gray-500">({yardData.Company})</span>
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          yardData.Class === 'Self-owned' ? 'bg-green-100 text-green-800' :
                          yardData.Class === 'JV Dealer' ? 'bg-blue-100 text-blue-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {yardData.Class}
                        </span>
                        {unreportedWeeks > 0 && (
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 ${getSeverityColor(unreportedWeeks)}`}>
                            {unreportedWeeks}w missing
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>Min: {yardData.Min || 'Not set'}</span>
                        <span>Max: {yardData.Max || 'Not set'}</span>
                        {currentStock !== null && (
                          <span className="flex items-center space-x-2">
                            <span>Current: {currentStock.toLocaleString()}</span>
                            {stockStatus && (
                              <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${stockStatus.color}`}>
                                {getStatusText(stockStatus.status)}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 ml-4">
                      <input
                        type="date"
                        value={dateInputs[yardName] || ''}
                        onChange={(e) => handleDateChange(yardName, e.target.value)}
                        className="w-36 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <input
                        id={`stock-${yardName}`}
                        type="number"
                        value={stockInputs[yardName] || ''}
                        onChange={(e) => handleStockChange(yardName, e.target.value)}
                        placeholder="Enter stock level"
                        className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        min="0"
                      />
                      <button
                        onClick={() => handleSubmit(yardName)}
                        disabled={!stockInputs[yardName] || saving[yardName]}
                        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 text-sm"
                      >
                        {saving[yardName] ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Saving...</span>
                          </>
                        ) : (
                          <span>Submit</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
        
        {Object.keys(yards).length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No yards configured. Please add yards in the Admin & Setup page first.
          </div>
        )}
      </div>
    </div>
  );
};

export default DataEntry;