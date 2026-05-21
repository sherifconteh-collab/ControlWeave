// @tier: exclude
/**
 * Test script for WebSocket real-time features
 * Usage: node scripts/test-websocket.js
 */

const io = require('socket.io-client');
const readline = require('readline');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('Error: ACCESS_TOKEN environment variable required');
  console.log('Usage: ACCESS_TOKEN=your_jwt_token node scripts/test-websocket.js');
  process.exit(1);
}

console.log('🔌 ControlWeave WebSocket Test Client');
console.log('=====================================\n');
console.log(`Connecting to: ${API_URL}`);
console.log('Press Ctrl+C to exit\n');

// Create Socket.IO client
const socket = io(API_URL, {
  auth: { token: ACCESS_TOKEN },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  console.log(`   Socket ID: ${socket.id}\n`);
  showMenu();
});

socket.on('disconnect', (reason) => {
  console.log(`❌ Disconnected: ${reason}\n`);
});

socket.on('connect_error', (error) => {
  console.error(`❌ Connection error: ${error.message}\n`);
});

socket.on('reconnect', (attempt) => {
  console.log(`🔄 Reconnected after ${attempt} attempts\n`);
});

// Real-time events
socket.on('notification.new', (data) => {
  console.log('\n🔔 New Notification:');
  console.log(`   Title: ${data.notification.title}`);
  console.log(`   Message: ${data.notification.message}`);
  console.log(`   Type: ${data.notification.type}`);
  console.log(`   Time: ${data.timestamp}\n`);
});

socket.on('notification.read', (data) => {
  console.log(`\n✓ Notification read: ${data.notificationId}\n`);
});

socket.on('control.updated', (data) => {
  console.log('\n📋 Control Updated:');
  console.log(`   Control: ${data.control.identifier || data.control.id}`);
  console.log(`   Time: ${data.timestamp}\n`);
});

socket.on('assessment.created', (data) => {
  console.log('\n📊 Assessment Created:');
  console.log(`   Assessment ID: ${data.assessment.id}`);
  console.log(`   Time: ${data.timestamp}\n`);
});

socket.on('evidence.uploaded', (data) => {
  console.log('\n📎 Evidence Uploaded:');
  console.log(`   File: ${data.evidence.file_name}`);
  console.log(`   ID: ${data.evidence.id}`);
  console.log(`   Time: ${data.timestamp}\n`);
});

socket.on('vulnerability.created', (data) => {
  console.log('\n🔐 Vulnerability Created:');
  console.log(`   Count: ${data.vulnerability.count || 1}`);
  console.log(`   Source: ${data.vulnerability.source || 'N/A'}`);
  console.log(`   Time: ${data.timestamp}\n`);
});

socket.on('user.online', (data) => {
  console.log(`\n👤 User online: ${data.email} (${data.userId})\n`);
});

socket.on('user.offline', (data) => {
  console.log(`\n👤 User offline: ${data.email} (${data.userId})\n`);
});

socket.on('system.alert', (data) => {
  console.log('\n⚠️  System Alert:');
  console.log(`   Severity: ${data.alert.severity}`);
  console.log(`   Message: ${data.alert.message}`);
  console.log(`   Time: ${data.timestamp}\n`);
});

socket.on('presence.update', (data) => {
  console.log(`\n👥 Presence update: ${data.organizationOnlineCount} users online\n`);
});

socket.on('pong', (data) => {
  console.log(`\n🏓 Pong received at ${data.timestamp}\n`);
});

// Interactive menu
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function showMenu() {
  console.log('Commands:');
  console.log('  1 - Send ping');
  console.log('  2 - Show connection status');
  console.log('  3 - Show event listeners');
  console.log('  q - Quit');
  console.log();
  rl.question('> ', handleCommand);
}

function handleCommand(command) {
  command = command.trim().toLowerCase();
  
  switch (command) {
    case '1':
      console.log('🏓 Sending ping...');
      socket.emit('ping');
      break;
      
    case '2':
      console.log('\n📊 Connection Status:');
      console.log(`   Connected: ${socket.connected}`);
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   Transport: ${socket.io.engine.transport.name}`);
      console.log();
      break;
      
    case '3':
      console.log('\n📡 Registered Event Listeners:');
      const events = Object.keys(socket._callbacks || {});
      events.forEach(event => {
        const count = (socket._callbacks[event] || []).length;
        console.log(`   ${event}: ${count} handler(s)`);
      });
      console.log();
      break;
      
    case 'q':
    case 'quit':
    case 'exit':
      console.log('Disconnecting...');
      socket.disconnect();
      rl.close();
      process.exit(0);
      return;
      
    default:
      console.log('Unknown command. Try again.');
  }
  
  showMenu();
}

// Cleanup
process.on('SIGINT', () => {
  console.log('\nDisconnecting...');
  socket.disconnect();
  rl.close();
  process.exit(0);
});
