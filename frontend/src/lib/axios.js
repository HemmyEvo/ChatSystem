import axios from 'axios'

const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api')

export const api = axios.create({
  baseURL: apiUrl,
  withCredentials: true, // Include cookies in requests
})
