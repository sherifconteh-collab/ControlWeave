# Real-Time Features Documentation

## Overview

ControlWeave Phase 5 introduces real-time features powered by WebSocket (Socket.IO) and Redis for seamless, instantaneous updates across the platform.

## Architecture

### Backend Components

#### WebSocket Server (`websocketService.js`)
- Built on Socket.IO v4.8.1
- JWT-based authentication
- Redis adapter for multi-instance scaling (optional)
- Room-based event distribution (organization and user rooms)
- User presence tracking

#### Real-Time Event Service (`realtimeEventService.js`)
- 13+ event types for different platform activities
- Centralized event emission API
- Organization-scoped and user-scoped events

#### Real-Time API Routes (`/api/v1/realtime`)
- `GET /status` - WebSocket connection status
- `GET /online-users` - List online users in organization
- `POST /push-subscription` - Subscribe to push notifications
- `DELETE /push-subscription` - Unsubscribe from push notifications
- `GET /push-subscriptions` - Get user's push subscriptions

### Frontend Components

#### WebSocket Context (`WebSocketContext.tsx`)
- React Context provider for WebSocket connection
- Automatic reconnection with exponential backoff
- Custom hooks for event subscriptions
- Connection status tracking

#### WebSocket Status Indicator
- Visual connection status indicator
- Organization online user count
- Auto-hide when connected

#### Real-Time Hooks
- `useWebSocket()` - Access WebSocket connection
- `useWebSocketEvent()` - Subscribe to specific events
- `useNotificationEvents()` - Notification-specific events
- `usePresenceEvents()` - User presence events
- `useSystemAlerts()` - System alert events

## Event Types

### Notification Events
- `notification.new` - New notification created
- `notification.read` - Notification marked as read
- `notification.read_all` - All notifications marked as read

### Control Events
- `control.updated` - Control data updated
- `control.status_changed` - Control implementation status changed

### Assessment Events
- `assessment.created` - New assessment created
- `assessment.updated` - Assessment updated
- `assessment.completed` - Assessment completed

### Evidence Events
- `evidence.uploaded` - New evidence uploaded
- `evidence.approved` - Evidence approved
- `evidence.rejected` - Evidence rejected

### Vulnerability Events
- `vulnerability.created` - New vulnerability detected
- `vulnerability.updated` - Vulnerability updated
- `vulnerability.remediated` - Vulnerability remediated

### POA&M Events
- `poam.created` - POA&M item created
- `poam.updated` - POA&M item updated
- `poam.completed` - POA&M item completed

### User Presence Events
- `user.online` - User came online
- `user.offline` - User went offline

### System Events
- `system.alert` - System-wide alert
- `system.maintenance` - Maintenance notification

## Configuration

### Backend Environment Variables

```bash
# Redis configuration (optional for single-instance deployments)
# Set REDIS_REQUIRED=true in production to fail fast if Redis is unavailable.
REDIS_REQUIRED=false
REDIS_URL=redis://localhost:6379
# Or use discrete configuration:
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0

# CORS origins (must include frontend URL)
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com
```

### Frontend Environment Variables

```bash
# WebSocket connection URL (derived from API URL)
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# VAPID public key for push notifications (optional)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
```

## Usage Examples

### Backend: Emitting Events

```javascript
const { notificationNew, controlUpdated } = require('../services/realtimeEventService');

// Emit new notification to a specific user
notificationNew(userId, organizationId, {
  id: notificationId,
  type: 'control_due',
  title: 'Control Due Soon',
  message: 'AC-2 is due in 7 days',
  link: '/controls/ac-2'
});

// Emit control update to entire organization
controlUpdated(organizationId, {
  id: controlId,
  identifier: 'AC-2',
  status: 'implemented'
});
```

### Frontend: Subscribing to Events

```typescript
import { useWebSocketEvent } from '@/contexts/WebSocketContext';

function MyComponent() {
  useWebSocketEvent('control.updated', (data) => {
    console.log('Control updated:', data.control);
    // Update UI accordingly
  });

  return <div>...</div>;
}
```

### Frontend: Using Notification Events

```typescript
import { useNotificationEvents } from '@/contexts/WebSocketContext';

function NotificationComponent() {
  const { newNotification, notificationRead } = useNotificationEvents();

  useEffect(() => {
    if (newNotification) {
      // Play sound, show toast, etc.
      showToast(newNotification.title);
    }
  }, [newNotification]);

  return <div>...</div>;
}
```

## Push Notifications

### Browser Setup

Push notifications require user permission and service worker registration:

```typescript
import { 
  requestNotificationPermission,
  subscribeToPushNotifications 
} from '@/lib/pushNotifications';

// Request permission
const permission = await requestNotificationPermission();

if (permission === 'granted') {
  // Subscribe to push notifications
  const success = await subscribeToPushNotifications(apiUrl, accessToken);
}
```

### Service Worker

The service worker (`/public/sw.js`) handles:
- Push event reception
- Notification display
- Notification click handling
- Automatic app focus/open on click

## Scaling with Redis

For production deployments with multiple backend instances:

1. **Install Redis** (local, managed service, or container)
2. **Configure `REDIS_URL`** (or host/port/password/db variables)
3. **Set `REDIS_REQUIRED=true` in production** for fail-fast startup safety
4. **WebSocket adapter** automatically uses Redis when configured
5. **Benefits**:
   - Events broadcast across all server instances
   - Users can connect to any server instance
   - Seamless horizontal scaling

### Redis Setup Example

```bash
# Docker
docker run -d -p 6379:6379 redis:7-alpine

# Railway
# 1) Add a Redis service in the same project
# 2) Set backend env vars:
#    REDIS_URL=<Railway Redis connection URL>
#    REDIS_REQUIRED=true

# Managed Redis (AWS ElastiCache, Azure Cache, etc.)
# Use connection string in REDIS_URL env var
```

## Testing

### Manual Testing

1. **Start backend**: `npm run dev` (in `backend/`)
2. **Start frontend**: `npm run dev` (in `frontend/`)
3. **Open two browser windows** logged in as different users
4. **Create a notification** via API or admin interface
5. **Observe real-time update** in all connected windows

### WebSocket Connection Test

```bash
# Check WebSocket status
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/v1/realtime/status
```

### Event Emission Test

```javascript
// In backend code or script
const { systemAlert } = require('./src/services/realtimeEventService');

systemAlert(null, {
  severity: 'info',
  message: 'Test system alert'
});
```

## Performance Considerations

- **Connection Limits**: Socket.IO can handle thousands of concurrent connections per instance
- **Redis Overhead**: Minimal latency added (~1-2ms) for cross-instance events
- **Heartbeat**: Default 25s ping/pong keeps connections alive
- **Reconnection**: Automatic with exponential backoff (max 5 attempts)

## Security

- **Authentication**: JWT token required for WebSocket connection
- **Authorization**: Events scoped to user's organization
- **CORS**: Configured origins only
- **Rate Limiting**: Inherited from Express server rate limits

## Troubleshooting

### WebSocket Connection Fails

1. Check CORS configuration includes frontend URL
2. Verify JWT token is valid and not expired
3. Check firewall/proxy allows WebSocket upgrades
4. Ensure port 3001 (or configured port) is accessible

### Events Not Received

1. Verify WebSocket connection is established (check status indicator)
2. Check browser console for errors
3. Verify user is in correct organization
4. Check event emission in backend logs

### Redis Connection Issues

1. Verify Redis is running: `redis-cli ping` should return `PONG`
2. Check Redis connection URL format
3. Verify Redis authentication if required
4. Check network connectivity to Redis server

### Push Notifications Not Working

1. Verify browser supports push notifications
2. Check notification permission is granted
3. Verify VAPID keys are configured
4. Check service worker is registered: DevTools → Application → Service Workers
5. Test with simple notification: `new Notification('Test', { body: 'Test message' })`

## Monitoring

Log events are emitted for:
- WebSocket connections/disconnections
- Authentication failures
- Redis adapter status
- Event emissions (debug level)

Check logs with:
```bash
# Backend logs
tail -f logs/app.log

# Or console output in development
npm run dev
```

## Future Enhancements

Potential improvements for Phase 6+:
- Typing indicators for collaborative editing
- Live cursor positions in documents
- Real-time collaborative assessment scoring
- Video call notifications
- Chat/messaging system
- Screen sharing for auditor sessions
- Real-time dashboard updates with live metrics
- Collaborative control mapping

## Support

For issues or questions:
- GitHub Issues: https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues
- Documentation: Check `/docs` folder for additional guides
- Community: Discussion forums (if available)
