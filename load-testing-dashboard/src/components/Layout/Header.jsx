import React from 'react';
import { 
  BeakerIcon, 
  ChartBarIcon, 
  ClockIcon,
  PresentationChartLineIcon,
  EllipsisVerticalIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';

const Header = ({ currentTab, onTabChange, isTestRunning }) => {
  const tabs = [
    { id: 'new-test', label: 'Nouveau Test', icon: BeakerIcon },
    { id: 'monitoring', label: 'Monitoring', icon: ChartBarIcon },
    { id: 'visualization', label: 'Visualisation', icon: PresentationChartLineIcon },
    { id: 'history', label: 'Historique', icon: ClockIcon },
  ];

  const externalLinks = [
    { label: 'Locust UI', url: 'http://localhost:8089', color: 'text-green-600' },
    { label: 'Prometheus', url: 'http://localhost:9090', color: 'text-orange-600' },
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo et titre */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <BeakerIcon className="h-8 w-8 text-primary-600" />
              <div>
                <h1 className="text-xl font-bold text-gradient">
                  Load Testing Dashboard
                </h1>
                <p className="text-xs text-gray-500">
                  Pilotage des tests de performance
                </p>
              </div>
            </div>
            
            {/* Indicateur de statut */}
            {isTestRunning && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-success-50 rounded-full">
                <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-success-700">
                  Test en cours
                </span>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    'flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200',
                    currentTab === tab.id
                      ? 'bg-primary-100 text-primary-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Menu liens externes */}
          <div className="relative group">
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors duration-200">
              <EllipsisVerticalIcon className="h-5 w-5" />
            </button>
            
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="py-2">
                <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Liens externes
                </div>
                {externalLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                  >
                    <span className={link.color}>{link.label}</span>
                    <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;