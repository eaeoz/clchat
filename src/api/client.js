const BASE_URL = process.env.API_URL || 'https://social-app-5hge.onrender.com';

class ApiClient {
  constructor() {
    this.baseUrl = BASE_URL;
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
  }

  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  setUser(user) {
    this.user = user;
  }

  getHeaders(contentType = 'application/json') {
    const headers = {};
    if (contentType) headers['Content-Type'] = contentType;
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    return headers;
  }

  async request(method, path, body = null, requiresAuth = true) {
    const url = `${this.baseUrl}${path}`;
    const options = {
      method,
      headers: this.getHeaders(body instanceof FormData ? null : 'application/json'),
    };

    if (body) {
      options.body = body instanceof FormData ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error || data.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      if (error.status === 401 && this.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          options.headers = this.getHeaders(body instanceof FormData ? null : 'application/json');
          const retryResponse = await fetch(url, options);
          return await retryResponse.json();
        }
      }
      throw error;
    }
  }

  async refreshAccessToken() {
    try {
      const url = `${this.baseUrl}/api/auth/refresh`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.accessToken = data.accessToken;
      if (data.refreshToken) this.refreshToken = data.refreshToken;
      return true;
    } catch {
      return false;
    }
  }

  // Auth endpoints
  async register({ username, email, password, fullName, age, gender }) {
    const data = await this.request('POST', '/api/auth/register', {
      username,
      email,
      password,
      fullName,
      age: parseInt(age),
      gender,
    });
    if (data.accessToken) this.setTokens(data.accessToken, data.refreshToken);
    if (data.user) this.setUser(data.user);
    return data;
  }

  async login({ username, password }) {
    const data = await this.request('POST', '/api/auth/login', { username, password });
    if (data.accessToken) this.setTokens(data.accessToken, data.refreshToken);
    if (data.user) this.setUser(data.user);
    return data;
  }

  async getMe() {
    return await this.request('GET', '/api/auth/me');
  }

  async logout() {
    try {
      await this.request('POST', '/api/auth/logout');
    } finally {
      this.accessToken = null;
      this.refreshToken = null;
      this.user = null;
    }
  }

  async verifyEmail(token) {
    return await this.request('POST', '/api/auth/verify-email', { token });
  }

  async resendVerification(email, password) {
    return await this.request('POST', '/api/auth/resend-verification', { email, password });
  }

  async resetPassword(token, newPassword) {
    return await this.request('POST', '/api/auth/reset-password', { token, newPassword });
  }

  // Room endpoints
  async getPublicRooms() {
    return await this.request('GET', '/api/rooms/public');
  }

  async getUsers(search = null) {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return await this.request('GET', `/api/rooms/users${query}`);
  }

  async getUserProfile(userId) {
    return await this.request('GET', `/api/rooms/user-profile/${userId}`);
  }

  async markRoomRead(roomId) {
    return await this.request('POST', '/api/rooms/mark-room-read', { roomId });
  }

  async getPrivateChats() {
    return await this.request('GET', '/api/rooms/private-chats');
  }

  async closePrivateChat(otherUserId) {
    return await this.request('POST', '/api/rooms/close-private-chat', { otherUserId });
  }

  async openPrivateChat(otherUserId) {
    return await this.request('POST', '/api/rooms/open-private-chat', { otherUserId });
  }

  // Report endpoints
  async submitReport(reportedUserId, reason) {
    return await this.request('POST', '/api/report/submit', { reportedUserId, reason });
  }

  async checkSuspension(userId) {
    return await this.request('POST', '/api/report/check-suspension', { userId });
  }

  // Settings
  async getSiteSettings() {
    return await this.request('GET', '/api/settings/site');
  }

  // Health check
  async healthCheck() {
    return await this.request('GET', '/health');
  }
}

export default new ApiClient();
