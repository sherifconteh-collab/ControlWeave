package com.controlweave.app.core.network

import com.controlweave.app.core.models.LoginData
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface AuthApiService {

    @POST("/api/v1/auth/login")
    suspend fun login(@Body body: Map<String, String?>): Response<ApiResponse<LoginData>>

    @POST("/api/v1/auth/refresh")
    fun refreshToken(@Body body: Map<String, String>): retrofit2.Call<ApiResponse<TokenPair>>

    @POST("/api/v1/auth/logout")
    suspend fun logout(): Response<ApiResponse<Unit>>
}

data class ApiResponse<T>(
    val success: Boolean,
    val data: T? = null,
    val error: String? = null,
    val requiresTOTP: Boolean? = null
)

data class TokenPair(
    val accessToken: String,
    val refreshToken: String
)
