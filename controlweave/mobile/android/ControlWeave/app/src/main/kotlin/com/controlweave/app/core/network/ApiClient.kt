package com.controlweave.app.core.network

import com.controlweave.app.BuildConfig
import okhttp3.Authenticator
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ApiClient @Inject constructor(private val tokenManager: TokenManager) {

    val moshi: Moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    private val authInterceptor = okhttp3.Interceptor { chain ->
        val token = tokenManager.accessToken
        val req = if (token != null) {
            chain.request().newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else chain.request()
        chain.proceed(req)
    }

    private val tokenAuthenticator = object : Authenticator {
        override fun authenticate(route: Route?, response: Response): Request? {
            // Prevent infinite retry loops: only attempt one refresh per request chain.
            if (responseCount(response) >= 2) return null

            val refresh = tokenManager.refreshToken ?: return null
            // Synchronous refresh call (called on OkHttp thread, not coroutine)
            return try {
                val refreshRetrofit = buildRetrofit(includeAuth = false)
                val service = refreshRetrofit.create(AuthApiService::class.java)
                val call = service.refreshToken(mapOf("refreshToken" to refresh)).execute()

                if (!call.isSuccessful) {
                    tokenManager.clearAll()
                    return null
                }

                val body = call.body()
                val newAccessToken = body?.data?.accessToken
                val newRefreshToken = body?.data?.refreshToken

                if (body?.success != true || newAccessToken.isNullOrEmpty()) {
                    tokenManager.clearAll()
                    return null
                }

                tokenManager.accessToken = newAccessToken
                tokenManager.refreshToken = newRefreshToken
                response.request.newBuilder()
                    .header("Authorization", "Bearer $newAccessToken")
                    .build()
            } catch (_: Exception) {
                null
            }
        }

        private fun responseCount(response: Response): Int {
            var count = 1
            var prior = response.priorResponse
            while (prior != null) {
                count++
                prior = prior.priorResponse
            }
            return count
        }
    }

    private fun buildOkHttp(includeAuth: Boolean = true): OkHttpClient {
        return OkHttpClient.Builder().apply {
            if (includeAuth) {
                addInterceptor(authInterceptor)
                authenticator(tokenAuthenticator)
            }
            if (BuildConfig.DEBUG) {
                addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
            }
        }.build()
    }

    private fun buildRetrofit(includeAuth: Boolean = true): Retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .client(buildOkHttp(includeAuth))
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()

    val retrofit: Retrofit = buildRetrofit()

    inline fun <reified T> service(): T = retrofit.create(T::class.java)
}
