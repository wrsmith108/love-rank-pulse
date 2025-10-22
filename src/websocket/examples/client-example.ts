/**
 * WebSocket Client Example
 *
 * This example shows how to connect to an authenticated WebSocket server
 */

import { io, Socket } from 'socket.io-client';

// Replace with your actual JWT token
const JWT_TOKEN = 'your-jwt-token-here';

// Connect to server with authentication
const socket: Socket = io('http://localhost:3001', {
  // Option 1: Query parameter
  query: { token: JWT_TOKEN },

  // Option 2: Authorization header (uncomment to use)
  // extraHeaders: {
  //   Authorization: `Bearer ${JWT_TOKEN}`
  // },

  // Option 3: Auth object (uncomment to use)
  // auth: { token: JWT_TOKEN },

  // Connection options
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  transports: ['websocket']
});

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  console.log('Socket ID:', socket.id);

  // Send a test message
  socket.emit('message', {
    message: 'Hello from client!'
  });
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);

  // Check error data
  if (error.data) {
    console.error('Error code:', error.data.code);
    console.error('Error details:', error.data);
  }

  // Handle authentication failure
  if (error.message.includes('Authentication') || error.data?.code === 'AUTH_FAILED') {
    console.error('Authentication failed. Please check your token.');
    // Redirect to login or refresh token
  }
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);

  if (reason === 'io server disconnect') {
    // Server disconnected - try to reconnect manually
    socket.connect();
  }
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`✅ Reconnected after ${attemptNumber} attempts`);
});

socket.on('reconnect_error', (error) => {
  console.error('❌ Reconnection error:', error);
});

socket.on('reconnect_failed', () => {
  console.error('❌ Reconnection failed - giving up');
});

// Message events
socket.on('message', (data) => {
  console.log('📨 Message received:');
  console.log(`  From: ${data.username} (${data.userId})`);
  console.log(`  Message: ${data.message}`);
  console.log(`  Time: ${data.timestamp}`);
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

// Token refresh example
socket.on('token:refreshed', (response) => {
  console.log('✅ Token refreshed successfully');
});

socket.on('token:refresh:error', (response) => {
  console.error('❌ Token refresh failed:', response.message);
});

// Function to refresh token
function refreshToken(newToken: string) {
  socket.emit('token:refresh', newToken);
}

// Function to send a message
function sendMessage(message: string) {
  socket.emit('message', { message });
}

// Export for use in other modules
export { socket, refreshToken, sendMessage };

// Example usage:
// import { socket, sendMessage } from './client-example';
// sendMessage('Hello, world!');
