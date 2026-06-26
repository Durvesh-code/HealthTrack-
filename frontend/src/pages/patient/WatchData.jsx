// frontend/src/pages/patient/WatchData.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import api from '../../config/api'; // Your Axios instance
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const WatchData = () => {
  const [chartData, setChartData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [syncing, setSyncing] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();


  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('status') === 'success') {
      alert("Successfully connected to Google Fit!");
      navigate('/patient/watch-data', { replace: true });
    } else if (params.get('status') === 'error') {
      alert("Error connecting to Google Fit.");
      navigate('/patient/watch-data', { replace: true });
    }
    
    fetchStoredData();
  }, [days]);

  const fetchStoredData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/watch/data?days=${days}`);
      setChartData(response.data.chart_data);
      setIsConnected(response.data.is_connected);
    } catch (error) {
      console.error("Error fetching watch data:", error);
    }
    setLoading(false);
  };

  const handleConnect = async () => {
    try {
      const response = await api.get(`/api/watch/auth-url`);
      window.location.href = response.data.url;
    } catch (error) {
      alert("Failed to get authorization URL.");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await api.post('/api/watch/sync');
      setChartData(response.data.chart_data);
      alert(response.data.message);
    } catch (error) {
      alert(error.response?.data?.error || "Error syncing data");
    }
    setSyncing(false);
  };

  const generateChartConfig = (data, label, color) => ({
    labels: data?.labels || [],
    datasets: [{
      label: label,
      data: data?.values || [],
      borderColor: color,
      backgroundColor: `${color}33`,
      fill: true,
      tension: 0.35,
      pointRadius: 4,
      pointHoverRadius: 7,
      borderWidth: 2,
    }],
  });

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: "#e5e7eb" } },
    },
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading your health data...</div>;
  }

  const defaultChartData = {
    steps: { labels: [], values: [] },
    calories: { labels: [], values: [] },
    heart_rate: { labels: [], values: [] },
    sleep: { labels: [], values: [] }
  };

  const displayData = chartData || defaultChartData;

  return (
    <div className="w-full max-w-none px-6 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-red-500">❤️</span> Smartwatch Health Data
          </h2>
          <p className="text-gray-500">Track and visualize your Google Fit metrics.</p>
        </div>
        
        {isConnected && (
          <div className="flex gap-4 items-center">
            <select 
              className="border p-2 rounded-md bg-white text-gray-700"
              value={days} 
              onChange={(e) => setDays(e.target.value)}
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
            <button 
              onClick={handleSync} 
              disabled={syncing}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {syncing ? "⏳ Syncing..." : "🔄 Sync Latest Data"}
            </button>
          </div>
        )}
      </div>

      {!isConnected ? (
        <div className="bg-white p-8 rounded-lg shadow-sm text-center border border-gray-100">
          <p className="text-gray-600 mb-4">Connect your Google Fit account to view your smartwatch data.</p>
          <button 
            onClick={handleConnect}
            className="px-6 py-3 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 shadow-md transition"
          >
            Google Fit (Connect Google Fit)
          </button>
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 md:grid-cols-2 gap-6">

          {/* 1. Steps */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-80">
            <h3 className="font-semibold text-gray-700 mb-4">🚶 Steps</h3>
            <div className="h-60">
              <Line data={generateChartConfig(displayData.steps, "Steps", "#3b82f6")} options={chartOptions} />
            </div>
          </div>

          {/* 2. Calories */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-80">
            <h3 className="font-semibold text-gray-700 mb-4">🔥 Calories Burned (kcal)</h3>
            <div className="h-60">
              <Line data={generateChartConfig(displayData.calories, "Calories", "#f59e0b")} options={chartOptions} />
            </div>
          </div>

          {/* 3. Heart Rate */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-80">
            <h3 className="font-semibold text-gray-700 mb-4">💓 Heart Rate (bpm)</h3>
            <div className="h-60">
              <Line data={generateChartConfig(displayData.heart_rate, "Heart Rate", "#ef4444")} options={chartOptions} />
            </div>
          </div>

          {/* 4. Sleep */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-80">
            <h3 className="font-semibold text-gray-700 mb-4">🛌 Sleep Duration (mins)</h3>
            <div className="h-60">
              <Line data={generateChartConfig(displayData.sleep, "Sleep", "#10b981")} options={chartOptions} />
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default WatchData;