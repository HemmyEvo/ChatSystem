import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.MODE === 'production' ? '/api' : 'http://localhost:3000/api',
  withCredentials: true, // Include cookies in requests
})