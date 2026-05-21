# Phase 5: Real-Time Features - Implementation Plan

## Overview

This phase adds real-time capabilities to the ControlWeave platform using WebSocket connections. Users will receive instant notifications for critical AI governance events without polling, enabling faster response times and better user experience.

## Scope

### 1. WebSocket Infrastructure

#### Backend WebSocket Server

**Technology Stack**:
- **Library**: `socket.io` (v4.6+)
- **Authentication**: JWT-based socket authentication
- **Scaling**: Redis adapter for multi-instance support

**Server Setup**:
```javascript
// backend/src/services/websocketService.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');

class WebSocketService {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN,
        credentials: true
      },
      transports: ['websocket', 'polling']
    });
    
    this.setupRedis();
    this.setupAuthentication();
    this.setupEventHandlers();
  }
  
  setupRedis() {
    const pubClient = new Redis(process.env.REDIS_URL);
    const subClient = pubClient.duplicate();
    this.io.adapter(createAdapter(pubClient, subClient));
  }
  
  setupAuthentication() {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.organizationId = decoded.organization_id;
        next();
      } catch (err) {
        next(new Error('Authentication failed'));
      }
    });
  }
  
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.userId} connected`);
      
      // Join organization room
      socket.join(`org:${socket.organizationId}`);
      
      // Join user-specific room
      socket.join(`user:${socket.userId}`);
      
      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
      });
    });
  }
  
  // Emit to organization
  emitToOrganization(organizationId, event, data) {
    this.io.to(`org:${organizationId}`).emit(event, data);
  }
  
  // Emit to specific user
  emitToUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, data);
  }
  
  // Emit to users with specific role
  emitToRole(organizationId, role, event, data) {
    // Query users with role and emit to each
    this.io.in(`org:${organizationId}`).fetchSockets().then(sockets => {
      sockets.forEach(socket => {
        // Check if user has role (would need to query database)
        // For simplicity, emit to all in org for now
        socket.emit(event, data);
      });
    });
  }
}

module.exports = WebSocketService;
```

### 2. Real-Time Event Types

#### AI Monitoring Events

**Event: `monitoring:event:created`**
```json
{
  "type": "monitoring:event:created",
  "data": {
    "id": "uuid",
    "rule_id": "uuid",
    "rule_name": "Low Confidence Alert",
    "ai_agent_id": "uuid",
    "ai_agent_name": "Customer Support Bot",
    "event_type": "threshold_exceeded",
    "severity": "high",
    "metric_name": "confidence_score",
    "metric_value": 0.65,
    "threshold_value": 0.70,
    "event_summary": "Confidence score below threshold",
    "blocked": true,
    "requires_review": true,
    "detected_at": "2026-02-18T13:30:00Z"
  }
}
```

**Event: `monitoring:event:reviewed`**
```json
{
  "type": "monitoring:event:reviewed",
  "data": {
    "id": "uuid",
    "reviewed_by": "uuid",
    "reviewed_by_name": "John Doe",
    "review_decision": "approved",
    "review_notes": "False positive, adjusted threshold",
    "reviewed_at": "2026-02-18T13:35:00Z"
  }
}
```

**Event: `monitoring:event:resolved`**
```json
{
  "type": "monitoring:event:resolved",
  "data": {
    "id": "uuid",
    "resolved_by": "uuid",
    "resolved_by_name": "Jane Smith",
    "resolution_notes": "Root cause fixed in model v2.1",
    "resolved_at": "2026-02-18T14:00:00Z"
  }
}
```

**Event: `monitoring:rule:triggered`**
```json
{
  "type": "monitoring:rule:triggered",
  "data": {
    "rule_id": "uuid",
    "rule_name": "Anomaly Detection - Response Time",
    "trigger_count": 5,
    "last_triggered_at": "2026-02-18T13:30:00Z"
  }
}
```

#### Data Sovereignty Events

**Event: `sovereignty:regulatory_change:added`**
```json
{
  "type": "sovereignty:regulatory_change:added",
  "data": {
    "id": "uuid",
    "jurisdiction_code": "EU",
    "jurisdiction_name": "European Union",
    "change_title": "EU AI Act Amendment - High-Risk AI Classification Update",
    "change_type": "amendment",
    "impact_level": "high",
    "effective_date": "2026-06-01",
    "compliance_deadline": "2026-12-01",
    "requires_action": true,
    "summary": "Updated classification criteria for high-risk AI systems"
  }
}
```

**Event: `sovereignty:jurisdiction:compliance_status_changed`**
```json
{
  "type": "sovereignty:jurisdiction:compliance_status_changed",
  "data": {
    "jurisdiction_id": "uuid",
    "jurisdiction_name": "European Union",
    "old_status": "in_progress",
    "new_status": "compliant",
    "changed_by": "uuid",
    "changed_by_name": "Compliance Officer",
    "changed_at": "2026-02-18T13:30:00Z"
  }
}
```

#### Vendor Risk Events

**Event: `vendor:incident:created`**
```json
{
  "type": "vendor:incident:created",
  "data": {
    "id": "uuid",
    "vendor_name": "Anthropic",
    "incident_type": "service_outage",
    "severity": "high",
    "incident_summary": "API downtime for 2 hours",
    "incident_date": "2026-02-18",
    "requires_customer_notification": true,
    "requires_regulatory_reporting": false
  }
}
```

**Event: `vendor:assessment:overdue`**
```json
{
  "type": "vendor:assessment:overdue",
  "data": {
    "vendor_id": "uuid",
    "vendor_name": "OpenAI",
    "last_assessment_date": "2025-08-18",
    "next_assessment_date": "2026-02-18",
    "days_overdue": 5
  }
}
```

**Event: `vendor:sla:violated`**
```json
{
  "type": "vendor:sla:violated",
  "data": {
    "vendor_id": "uuid",
    "vendor_name": "Google Gemini",
    "metric": "uptime_percentage",
    "sla_value": 99.9,
    "actual_value": 99.7,
    "period_start": "2026-02-01",
    "period_end": "2026-02-18"
  }
}
```

### 3. Frontend WebSocket Client

#### React Hook for WebSocket Connection

```typescript
// hooks/useWebSocket.ts
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoConnect = true,
    onConnect,
    onDisconnect,
    onError
  } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001', {
      auth: { token },
      autoConnect,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    socket.on('connect', () => {
      setIsConnected(true);
      onConnect?.();
    });
    
    socket.on('disconnect', () => {
      setIsConnected(false);
      onDisconnect?.();
    });
    
    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      onError?.(error);
    });
    
    socketRef.current = socket;
    
    return () => {
      socket.disconnect();
    };
  }, [autoConnect, onConnect, onDisconnect, onError]);
  
  const subscribe = (event: string, handler: (data: any) => void) => {
    socketRef.current?.on(event, handler);
    
    return () => {
      socketRef.current?.off(event, handler);
    };
  };
  
  const emit = (event: string, data: any) => {
    socketRef.current?.emit(event, data);
  };
  
  return {
    isConnected,
    subscribe,
    emit,
    socket: socketRef.current
  };
}
```

#### Real-Time Monitoring Events Hook

```typescript
// hooks/useRealtimeMonitoringEvents.ts
import { useEffect, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { toast } from 'react-hot-toast';

export function useRealtimeMonitoringEvents() {
  const [events, setEvents] = useState<any[]>([]);
  const { isConnected, subscribe } = useWebSocket();
  
  useEffect(() => {
    const unsubscribeCreated = subscribe('monitoring:event:created', (data) => {
      setEvents(prev => [data, ...prev]);
      
      // Show toast notification for high/critical events
      if (data.severity === 'high' || data.severity === 'critical') {
        toast.error(`${data.severity.toUpperCase()}: ${data.event_summary}`, {
          duration: 5000,
          position: 'top-right',
        });
      }
    });
    
    const unsubscribeReviewed = subscribe('monitoring:event:reviewed', (data) => {
      setEvents(prev => prev.map(event => 
        event.id === data.id ? { ...event, ...data } : event
      ));
    });
    
    const unsubscribeResolved = subscribe('monitoring:event:resolved', (data) => {
      setEvents(prev => prev.map(event => 
        event.id === data.id ? { ...event, ...data } : event
      ));
    });
    
    return () => {
      unsubscribeCreated();
      unsubscribeReviewed();
      unsubscribeResolved();
    };
  }, [subscribe]);
  
  return { events, isConnected };
}
```

### 4. Push Notifications

#### Browser Push Notifications

**Service Worker Setup**:
```javascript
// public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

**Push Subscription Management**:
```typescript
// lib/push-notifications.ts
export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications not supported');
  }
  
  const registration = await navigator.serviceWorker.register('/sw.js');
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  });
  
  // Send subscription to backend
  await fetch('/api/v1/notifications/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
    },
    body: JSON.stringify(subscription)
  });
  
  return subscription;
}
```

#### Backend Push Notification Service

```javascript
// backend/src/services/pushNotificationService.js
const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:contehconsulting@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

class PushNotificationService {
  async sendNotification(userId, notification) {
    // Get user's push subscriptions from database
    const subscriptions = await this.getUserSubscriptions(userId);
    
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon,
      url: notification.url,
      tag: notification.tag,
      requireInteraction: notification.requireInteraction
    });
    
    const promises = subscriptions.map(subscription => {
      return webpush.sendNotification(subscription, payload)
        .catch(error => {
          if (error.statusCode === 410) {
            // Subscription expired, remove from database
            this.removeSubscription(subscription);
          }
        });
    });
    
    await Promise.all(promises);
  }
  
  async getUserSubscriptions(userId) {
    const result = await pool.query(
      'SELECT subscription FROM push_subscriptions WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    return result.rows.map(row => row.subscription);
  }
  
  async removeSubscription(subscription) {
    await pool.query(
      'UPDATE push_subscriptions SET is_active = false WHERE subscription = $1',
      [subscription]
    );
  }
}

module.exports = new PushNotificationService();
```

### 5. Live Monitoring Event Stream

#### Component Implementation

```typescript
// components/ai-monitoring/LiveEventStream.tsx
import { useRealtimeMonitoringEvents } from '@/hooks/useRealtimeMonitoringEvents';
import { EventCard } from './EventCard';
import { Badge } from '@/components/ui/badge';

export function LiveEventStream() {
  const { events, isConnected } = useRealtimeMonitoringEvents();
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Live Event Stream</h2>
        <Badge variant={isConnected ? 'success' : 'destructive'}>
          {isConnected ? '● Live' : '○ Disconnected'}
        </Badge>
      </div>
      
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No events yet. Waiting for monitoring events...
          </div>
        ) : (
          events.map(event => (
            <EventCard key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}
```

### 6. Real-Time Notifications UI

#### Notification Center

```typescript
// components/NotificationCenter.tsx
import { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { subscribe } = useWebSocket();
  
  useEffect(() => {
    // Subscribe to all notification events
    const unsubscribe = subscribe('notification', (data) => {
      setNotifications(prev => [data, ...prev].slice(0, 50)); // Keep last 50
      setUnreadCount(prev => prev + 1);
    });
    
    return unsubscribe;
  }, [subscribe]);
  
  const markAllAsRead = () => {
    setUnreadCount(0);
  };
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 hover:bg-gray-100 rounded-full">
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <button
            onClick={markAllAsRead}
            className="text-sm text-blue-600 hover:underline"
          >
            Mark all as read
          </button>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No notifications
            </div>
          ) : (
            notifications.map((notification, index) => (
              <div
                key={index}
                className="p-4 border-b hover:bg-gray-50 cursor-pointer"
              >
                <div className="font-medium">{notification.title}</div>
                <div className="text-sm text-gray-600">{notification.body}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(notification.timestamp).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

## Database Schema

### Push Subscriptions Table

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions (user_id);
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions (user_id, is_active) WHERE is_active = true;
```

### Notification Preferences Table

```sql
-- Already exists in migration 043_notification_preferences.sql
-- Add WebSocket and Push notification channels

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS websocket_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT false;
```

## Event Emission Integration

### Monitoring Events

```javascript
// backend/src/routes/aiMonitoring.js

// After creating monitoring event
const result = await pool.query(/* ... */);
const event = result.rows[0];

// Emit to WebSocket
const wsService = req.app.get('wsService');
wsService.emitToOrganization(organization_id, 'monitoring:event:created', {
  ...event,
  ai_agent_name: agentName // fetch from join
});

// Send push notification if critical/high severity
if (event.severity === 'critical' || event.severity === 'high') {
  const pushService = req.app.get('pushService');
  await pushService.sendNotification(userId, {
    title: `${event.severity.toUpperCase()} Monitoring Alert`,
    body: event.event_summary,
    url: `/dashboard/ai-monitoring/events/${event.id}`,
    tag: 'monitoring-event',
    requireInteraction: event.severity === 'critical'
  });
}
```

## Testing

### WebSocket Integration Tests

```javascript
// __tests__/websocket.test.js
const io = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');

describe('WebSocket Service', () => {
  let ioServer, clientSocket;
  
  beforeAll((done) => {
    const httpServer = createServer();
    ioServer = new Server(httpServer);
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = io(`http://localhost:${port}`, {
        auth: { token: 'test-token' }
      });
      clientSocket.on('connect', done);
    });
  });
  
  afterAll(() => {
    ioServer.close();
    clientSocket.close();
  });
  
  test('should receive monitoring event', (done) => {
    clientSocket.on('monitoring:event:created', (data) => {
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('severity');
      done();
    });
    
    ioServer.emit('monitoring:event:created', {
      id: 'test-uuid',
      severity: 'high'
    });
  });
});
```

## Deployment

### Environment Variables

```env
# WebSocket
WS_PORT=3002
REDIS_URL=redis://localhost:6379

# Push Notifications
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
```

### Docker Compose

```yaml
version: '3.8'
services:
  backend:
    # ... existing config
    environment:
      - WS_PORT=3002
      - REDIS_URL=redis://redis:6379
    ports:
      - "3001:3001"
      - "3002:3002"
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
  
  frontend:
    # ... existing config
    environment:
      - NEXT_PUBLIC_WS_URL=ws://localhost:3002

volumes:
  redis-data:
```

## Acceptance Criteria

- [ ] WebSocket server successfully authenticates connections
- [ ] Clients receive real-time monitoring events
- [ ] Clients receive regulatory change notifications
- [ ] Clients receive vendor incident alerts
- [ ] Push notifications work on supported browsers
- [ ] Connection automatically reconnects after disconnect
- [ ] Events are properly scoped to organization
- [ ] Notification center displays recent events
- [ ] Users can enable/disable push notifications
- [ ] Load testing: 1000+ concurrent connections
- [ ] Redis adapter works across multiple server instances

## Performance Targets

- Connection establishment: < 500ms
- Event delivery latency: < 100ms
- Reconnection time: < 2 seconds
- Concurrent connections: 10,000+ per instance
- Message throughput: 10,000 messages/second

---

**Ready for Development**: After Phase 4 completion
**Dependencies**: Phase 4 frontend dashboards, Redis infrastructure
**Estimated Timeline**: 3-4 weeks
**Team Size**: 1-2 backend + 1 frontend developer
