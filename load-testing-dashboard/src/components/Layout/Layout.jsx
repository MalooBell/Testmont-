import React from 'react';
import Header from './Header';
import ConnectionStatus from '../Common/ConnectionStatus';

const Layout = ({ children, currentTab, onTabChange, isTestRunning }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        currentTab={currentTab} 
        onTabChange={onTabChange}
        isTestRunning={isTestRunning}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      
      <ConnectionStatus />
    </div>
  );
};

export default Layout;