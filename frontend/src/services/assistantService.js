import axios from 'axios';
import { API_BASE_URL } from './api';

const assistantApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

assistantApi.interceptors.request.use((config) => {
  const token =
    localStorage.getItem('ner88_token') ||
    localStorage.getItem('link_x8_token') ||
    localStorage.getItem('ner_logiai_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Sends prompt to Assistant 88 with optional Command Center context & language
 */
export async function askAssistant88(message, context = {}, language = 'en') {
  try {
    const response = await assistantApi.post('/assistant/chat', {
      message,
      context,
      language,
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('[Assistant 88 Error]', error);
    const detail =
      error.response?.data?.detail ||
      error.message ||
      'Assistant 88 is temporarily unable to retrieve current operational data.';
    return {
      success: false,
      error: detail,
    };
  }
}


/**
 * Checks live health & online status of Assistant 88
 */
export async function getAssistantHealth() {
  try {
    const response = await assistantApi.get('/assistant/health', { timeout: 4000 });
    return {
      isOnline: response.status === 200 && response.data?.status === 'ONLINE',
      status: response.data?.status || 'OFFLINE',
      data: response.data,
    };
  } catch (error) {
    return {
      isOnline: false,
      status: 'OFFLINE',
      error: error.message || 'Offline',
    };
  }
}

/**
 * Retrieves predefined operational quick actions (Section 4 & 22)
 */
export async function getAssistantQuickActions() {
  try {
    const response = await assistantApi.get('/assistant/quick-actions', { timeout: 4000 });
    return response.data || [];
  } catch (error) {
    // Fallback static operational actions if offline
    return [
      {
        id: 'network_status',
        label: 'Network Status',
        prompt: 'What is the current network status?',
        category: 'accessibility',
      },
      {
        id: 'restricted_corridors',
        label: 'Restricted Corridors',
        prompt: 'Which corridors are restricted?',
        category: 'route',
      },
      {
        id: 'active_incidents',
        label: 'Active Incidents',
        prompt: 'Show active incidents',
        category: 'alerts',
      },
      {
        id: 'weather_risk',
        label: 'Weather Risk',
        prompt: 'What is the weather risk?',
        category: 'weather',
      },
      {
        id: 'affected_vehicles',
        label: 'Affected Vehicles',
        prompt: 'How many vehicles are affected?',
        category: 'risk',
      },
      {
        id: 'general_factual',
        label: 'Nagaland Capital',
        prompt: 'What is the capital of Nagaland?',
        category: 'context',
      },
    ];
  }
}
