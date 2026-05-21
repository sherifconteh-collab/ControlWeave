package com.controlweave.app.fcm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.controlweave.app.MainActivity
import com.controlweave.app.R
import com.controlweave.app.core.network.ApiClient
import com.controlweave.app.core.network.TokenManager
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.POST
import retrofit2.http.Path
import javax.inject.Inject

@AndroidEntryPoint
class CwFirebaseMessagingService : FirebaseMessagingService() {

    @Inject lateinit var tokenManager: TokenManager
    @Inject lateinit var apiClient: ApiClient

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Register token with backend if user is authenticated
        if (tokenManager.accessToken != null) {
            CoroutineScope(Dispatchers.IO).launch {
                runCatching {
                    val service = apiClient.service<PushTokenApiService>()
                    service.registerToken(mapOf("token" to token, "platform" to "android"))
                }
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val title = message.notification?.title ?: message.data["title"] ?: return
        val body = message.notification?.body ?: message.data["body"] ?: return
        showLocalNotification(title, body)
    }

    private fun showLocalNotification(title: String, body: String) {
        val channelId = "cw_alerts"
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(channelId, "Alerts", NotificationManager.IMPORTANCE_DEFAULT)
            )
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        nm.notify(System.currentTimeMillis().toInt(), notification)
    }
}

interface PushTokenApiService {
    @POST("/api/v1/push-tokens")
    suspend fun registerToken(@Body body: Map<String, String>): retrofit2.Response<Unit>

    @DELETE("/api/v1/push-tokens/{token}")
    suspend fun deleteToken(@Path("token") token: String): retrofit2.Response<Unit>
}
