import React, { useState, useEffect } from 'react';
import { LineChart as ChartIcon, ArrowUpDown, DollarSign, Euro, PoundSterling, Moon, Sun, Bell, Calculator, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { format, subDays, subMonths, subYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExchangeRate {
  currency: string;
  symbol: string;
  rate: number;
  change: number;
}

interface Alert {
  currency: string;
  targetRate: number;
  type: 'above' | 'below';
}

interface HistoricalData {
  date: string;
  rate: number;
}

interface APIResponse {
  result: string;
  base_code: string;
  conversion_rates: Record<string, number>;
  time_last_update_unix: number;
}

const API_KEY = import.meta.env.VITE_EXCHANGE_RATE_API_KEY;
const API_BASE_URL = import.meta.env.VITE_EXCHANGE_RATE_API_BASE_URL;

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  BRL: 'R$',
};

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'BRL'] as const;

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '1y'>('7d');
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showConverter, setShowConverter] = useState(false);
  const [convertAmount, setConvertAmount] = useState<string>('');
  const [convertFrom, setConvertFrom] = useState<string>('USD');
  const [convertTo, setConvertTo] = useState<string>('BRL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [alertForm, setAlertForm] = useState({
    currency: 'USD',
    targetRate: '',
    type: 'above' as const,
  });

  const fetchExchangeRates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get<APIResponse>(`${API_BASE_URL}/${API_KEY}/latest/BRL`);
      
      if (response.data.result === 'success') {
        const { conversion_rates, time_last_update_unix } = response.data;
        
        // Convert all rates to BRL (inverse of the rates since we're querying with BRL as base)
        const newRates: ExchangeRate[] = SUPPORTED_CURRENCIES.map(currency => ({
          currency,
          symbol: CURRENCY_SYMBOLS[currency],
          rate: currency === 'BRL' ? 1 : 1 / conversion_rates[currency],
          change: 0, // We would need historical data to calculate the change
        }));
        
        setRates(newRates);
        setLastUpdate(new Date(time_last_update_unix * 1000));
      } else {
        throw new Error('Failed to fetch exchange rates');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch exchange rates';
      setError(`Erro ao carregar taxas de câmbio: ${errorMessage}`);
      console.error('Error fetching exchange rates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExchangeRates();
    // Fetch rates every 5 minutes
    const interval = setInterval(fetchExchangeRates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Generate historical data (simulated as the free API doesn't support historical data)
    const generateHistoricalData = () => {
      const data: HistoricalData[] = [];
      const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 365;
      const baseRate = rates.find(r => r.currency === selectedCurrency)?.rate || 5;
      
      for (let i = days; i >= 0; i--) {
        const date = timeRange === '24h' 
          ? format(subDays(new Date(), i/24), 'HH:mm', { locale: ptBR })
          : format(subDays(new Date(), i), 'dd/MM', { locale: ptBR });
        
        const randomVariation = (Math.random() - 0.5) * 0.2;
        data.push({
          date,
          rate: Number((baseRate + randomVariation).toFixed(2))
        });
      }
      setHistoricalData(data);
    };

    if (rates.length > 0) {
      generateHistoricalData();
    }
  }, [selectedCurrency, timeRange, rates]);

  const handleCreateAlert = () => {
    if (alertForm.targetRate) {
      setAlerts([...alerts, {
        currency: alertForm.currency,
        targetRate: Number(alertForm.targetRate),
        type: alertForm.type
      }]);
      setAlertForm({ ...alertForm, targetRate: '' });
    }
  };

  const calculateConversion = () => {
    const fromRate = rates.find(r => r.currency === convertFrom)?.rate || 1;
    const toRate = rates.find(r => r.currency === convertTo)?.rate || 1;
    const amount = Number(convertAmount);
    if (amount && !isNaN(amount)) {
      return ((amount * fromRate) / toRate).toFixed(2);
    }
    return '0.00';
  };

  if (loading && rates.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando taxas de câmbio...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchExchangeRates}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gradient-to-b from-blue-50 to-blue-100'}`}>
      <header className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ChartIcon className={`h-6 w-6 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h1 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>CâmbioTrack</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowConverter(!showConverter)}
              className={`p-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <Calculator className="h-5 w-5" />
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {loading && (
          <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-md shadow-md">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Atualizando...</span>
            </div>
          </div>
        )}

        {showConverter && (
          <div className={`mb-8 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
            <h2 className="text-xl font-semibold mb-4">Conversor de Moedas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <input
                  type="number"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  placeholder="Valor"
                  className={`w-full rounded-md ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'border-gray-300'
                  } shadow-sm focus:border-blue-500 focus:ring-blue-500`}
                />
              </div>
              <div>
                <select
                  value={convertFrom}
                  onChange={(e) => setConvertFrom(e.target.value)}
                  className={`w-full rounded-md ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'border-gray-300'
                  } shadow-sm focus:border-blue-500 focus:ring-blue-500`}
                >
                  {rates.map(rate => (
                    <option key={rate.currency} value={rate.currency}>
                      {rate.currency}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={convertTo}
                  onChange={(e) => setConvertTo(e.target.value)}
                  className={`w-full rounded-md ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'border-gray-300'
                  } shadow-sm focus:border-blue-500 focus:ring-blue-500`}
                >
                  {rates.map(rate => (
                    <option key={rate.currency} value={rate.currency}>
                      {rate.currency}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 text-center text-xl font-bold">
              {convertAmount} {convertFrom} = {calculateConversion()} {convertTo}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {rates.map((rate) => (
            <div
              key={rate.currency}
              className={`${
                darkMode ? 'bg-gray-800' : 'bg-white'
              } rounded-lg shadow-md p-6 transition-transform hover:scale-105 cursor-pointer ${
                selectedCurrency === rate.currency ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedCurrency(rate.currency)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  {rate.currency === 'USD' && <DollarSign className="h-6 w-6 text-green-500" />}
                  {rate.currency === 'EUR' && <Euro className="h-6 w-6 text-blue-500" />}
                  {rate.currency === 'GBP' && <PoundSterling className="h-6 w-6 text-purple-500" />}
                  {rate.currency === 'BRL' && <DollarSign className="h-6 w-6 text-yellow-500" />}
                  <span className="text-lg font-semibold">{rate.currency}/BRL</span>
                </div>
                <span className={`text-sm font-medium ${
                  rate.change > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {rate.change > 0 ? '+' : ''}{rate.change.toFixed(2)}%
                </span>
              </div>
              <div className="text-3xl font-bold">
                R$ {rate.rate.toFixed(2)}
              </div>
              <div className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Última atualização: {lastUpdate?.toLocaleTimeString('pt-BR') || 'Carregando...'}
              </div>
            </div>
          ))}
        </div>

        <div className={`mt-8 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Histórico de {selectedCurrency}/BRL</h2>
            <div className="flex space-x-2">
              {(['24h', '7d', '30d', '1y'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded-md text-sm ${
                    timeRange === range
                      ? 'bg-blue-500 text-white'
                      : darkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                <XAxis 
                  dataKey="date" 
                  stroke={darkMode ? '#9CA3AF' : '#6B7280'}
                />
                <YAxis 
                  stroke={darkMode ? '#9CA3AF' : '#6B7280'}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: darkMode ? '#1F2937' : '#FFFFFF',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: darkMode ? '#FFFFFF' : '#000000',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`mt-8 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
          <h2 className="text-xl font-semibold mb-4">Alertas de Câmbio</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select
              value={alertForm.currency}
              onChange={(e) => setAlertForm({ ...alertForm, currency: e.target.value })}
              className={`rounded-md ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'border-gray-300'
              } shadow-sm focus:border-blue-500 focus:ring-blue-500`}
            >
              {rates.map(rate => (
                <option key={rate.currency} value={rate.currency}>
                  {rate.currency}
                </option>
              ))}
            </select>
            <select
              value={alertForm.type}
              onChange={(e) => setAlertForm({ ...alertForm, type: e.target.value as 'above' | 'below' })}
              className={`rounded-md ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'border-gray-300'
              } shadow-sm focus:border-blue-500 focus:ring-blue-500`}
            >
              <option value="above">Acima de</option>
              <option value="below">Abaixo de</option>
            </select>
            <input
              type="number"
              value={alertForm.targetRate}
              onChange={(e) => setAlertForm({ ...alertForm, targetRate: e.target.value })}
              placeholder="Valor alvo"
              step="0.01"
              className={`rounded-md ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'border-gray-300'
              } shadow-sm focus:border-blue-500 focus:ring-blue-500`}
            />
            <button
              onClick={handleCreateAlert}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Criar Alerta
            </button>
          </div>
          
          {alerts.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Alertas Ativos</h3>
              <div className="space-y-2">
                {alerts.map((alert, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-md ${
                      darkMode ? 'bg-gray-700' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Bell className="h-5 w-5 text-blue-500" />
                      <span>
                        {alert.currency}/BRL {alert.type === 'above' ? 'acima de' : 'abaixo de'} R$ {alert.targetRate}
                      </span>
                    </div>
                    <button
                      onClick={() => setAlerts(alerts.filter((_, i) => i !== index))}
                      className="text-red-500 hover:text-red-600"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className={`${darkMode ? 'bg-gray-800' : 'bg-white'} mt-12`}>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <p className={`text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>
            © 2024 CâmbioTrack. Dados fornecidos por ExchangeRate-API.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;