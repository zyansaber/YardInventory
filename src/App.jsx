import React, { useState } from 'react';
import Navigation from './components/Navigation';
import AdminSetup from './components/AdminSetup';
import DataEntry from './components/DataEntry';
import Analytics from './components/Analytics';

function App() {
  const [activeTab, setActiveTab] = useState('analytics');

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'admin':
        return <AdminSetup />;
      case 'entry':
        return <DataEntry />;
      case 'analytics':
        return <Analytics />;
      default:
        return <Analytics />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Yard Inventory Report System
              </h1>
            </div>
            <div className="text-sm text-gray-500">
              Professional Inventory Management
            </div>
          </div>
        </div>
      </header>

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderActiveComponent()}
      </main>
    </div>
  );
}

export default App;