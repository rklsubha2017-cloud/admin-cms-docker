import axios from 'axios';

const API_BASE_URL = '/api'; 

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
});

// Axios Request Interceptor
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Axios Response Interceptor (Handle Token Expiry)
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// --- Update your api.js with these securely configured calls ---

export const getVpnNodes = async () => {
    const token = localStorage.getItem('token'); // Grab the login badge
    
    // Pass the token in the Headers
    const response = await axios.get('/api/vpn/nodes', {
        headers: {
            Authorization: `Bearer ${token}`
        }
    }); 
    return response.data;
};

export const generateVpnKey = async (data) => {
    const token = localStorage.getItem('token'); // Grab the login badge
    
    // Pass the token in the Headers
    const response = await axios.post('/api/vpn/keys/generate', data, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    return response.data;
};
