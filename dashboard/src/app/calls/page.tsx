'use client';

import { useEffect, useState } from 'react';
import { Phone, Clock, MessageSquare, Search } from 'lucide-react';
import { format } from 'date-fns';

interface Call {
  id: string;
  call_sid: string;
  from_number: string;
  status: string;
  duration: number;
  intent: string;
  outcome: string;
  started_at: string;
  ended_at: string | null;
  customer_name?: string;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [restaurantId] = useState('demo-restaurant-id');

  useEffect(() => {
    fetchCalls();
  }, []);

  const fetchCalls = async () => {
    try {
      const response = await fetch(`/api/dashboard/calls?restaurantId=${restaurantId}`);
      const data = await response.json();
      setCalls(data.calls);
    } catch (error) {
      console.error('Failed to fetch calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTranscript = async (callId: string) => {
    try {
      const response = await fetch(`/api/dashboard/calls/${callId}/transcript`);
      const data = await response.json();
      setTranscript(data.transcript || 'No transcript available');
    } catch (error) {
      console.error('Failed to fetch transcript:', error);
      setTranscript('Failed to load transcript');
    }
  };

  const handleCallClick = (call: Call) => {
    setSelectedCall(call);
    fetchTranscript(call.id);
  };

  const filteredCalls = calls.filter(
    (call) =>
      call.from_number.includes(searchTerm) ||
      call.intent?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getIntentColor = (intent: string) => {
    switch (intent) {
      case 'order':
        return 'bg-green-100 text-green-800';
      case 'reservation':
        return 'bg-blue-100 text-blue-800';
      case 'question':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'in-progress':
        return 'text-blue-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading calls...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Call History</h1>
        <p className="text-gray-500 mt-1">View and analyze all incoming calls</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call List */}
        <div className="lg:col-span-2">
          <div className="card mb-4">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by phone number, name, or intent..."
                className="flex-1 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredCalls.map((call) => (
              <div
                key={call.id}
                onClick={() => handleCallClick(call)}
                className={`card cursor-pointer transition-all hover:shadow-md ${
                  selectedCall?.id === call.id ? 'ring-2 ring-primary-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <Phone className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {call.customer_name || call.from_number}
                      </p>
                      <p className="text-sm text-gray-500">{call.from_number}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {call.intent && (
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${getIntentColor(
                              call.intent
                            )}`}
                          >
                            {call.intent}
                          </span>
                        )}
                        <span className={`text-xs font-medium ${getStatusColor(call.status)}`}>
                          {call.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {format(new Date(call.started_at), 'MMM d, h:mm a')}
                    </p>
                    {call.duration && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <Clock className="w-4 h-4" />
                        <span>
                          {Math.floor(call.duration / 60)}:
                          {(call.duration % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredCalls.length === 0 && (
            <div className="card text-center py-12">
              <Phone className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No calls found</p>
            </div>
          )}
        </div>

        {/* Transcript Panel */}
        <div className="lg:col-span-1">
          <div className="card sticky top-8">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Transcript</h2>
            </div>

            {selectedCall ? (
              <div>
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <p className="text-sm text-gray-500">Call ID</p>
                  <p className="font-mono text-xs text-gray-700">{selectedCall.call_sid}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                    {transcript}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  Select a call to view transcript
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
