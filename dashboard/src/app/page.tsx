'use client';

import { useEffect, useState } from 'react';
import { Phone, ShoppingBag, Calendar, TrendingUp, Clock } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface Analytics {
  period: { startDate: string; endDate: string };
  calls: {
    total: number;
    byIntent: { order: number; reservation: number; question: number };
    avgDuration: number;
  };
  orders: {
    total: number;
    revenue: number;
    avgValue: number;
    byType: { pickup: number; delivery: number };
  };
  reservations: {
    total: number;
    confirmed: number;
    cancelled: number;
  };
  performance: {
    conversionRate: string;
    peakHours: Array<{ hour: number; callCount: number }>;
  };
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState('demo-restaurant-id');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/dashboard/analytics?restaurantId=${restaurantId}`);
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Failed to load analytics</div>
      </div>
    );
  }

  const stats = [
    {
      name: 'Total Calls',
      value: analytics.calls.total,
      icon: Phone,
      color: 'blue',
      change: '+12%',
    },
    {
      name: 'Orders Placed',
      value: analytics.orders.total,
      icon: ShoppingBag,
      color: 'green',
      change: '+8%',
    },
    {
      name: 'Total Revenue',
      value: `$${analytics.orders.revenue.toFixed(2)}`,
      icon: TrendingUp,
      color: 'purple',
      change: '+15%',
    },
    {
      name: 'Reservations',
      value: analytics.reservations.total,
      icon: Calendar,
      color: 'orange',
      change: '+5%',
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Overview of your phone agent performance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="card">
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-lg bg-${stat.color}-100 flex items-center justify-center`}
                >
                  <Icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
                <span className="text-sm font-medium text-green-600">
                  {stat.change}
                </span>
              </div>
              <h3 className="text-sm font-medium text-gray-500">{stat.name}</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Call Intent Distribution */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Call Intent Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[
                { name: 'Orders', count: analytics.calls.byIntent.order },
                { name: 'Reservations', count: analytics.calls.byIntent.reservation },
                { name: 'Questions', count: analytics.calls.byIntent.question },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Peak Call Hours */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Peak Call Hours
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.performance.peakHours}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                tickFormatter={(hour) => `${hour}:00`}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(hour) => `${hour}:00`}
                formatter={(value) => [`${value} calls`, 'Calls']}
              />
              <Line type="monotone" dataKey="callCount" stroke="#8b5cf6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="text-sm font-medium text-gray-500">
              Conversion Rate
            </h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {analytics.performance.conversionRate}%
          </p>
          <p className="text-sm text-gray-500 mt-1">Calls to orders</p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="w-5 h-5 text-purple-600" />
            <h3 className="text-sm font-medium text-gray-500">
              Avg Order Value
            </h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            ${analytics.orders.avgValue.toFixed(2)}
          </p>
          <p className="text-sm text-gray-500 mt-1">Per order</p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-medium text-gray-500">
              Avg Call Duration
            </h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {Math.floor(analytics.calls.avgDuration / 60)}:{(analytics.calls.avgDuration % 60).toString().padStart(2, '0')}
          </p>
          <p className="text-sm text-gray-500 mt-1">Minutes</p>
        </div>
      </div>
    </div>
  );
}
