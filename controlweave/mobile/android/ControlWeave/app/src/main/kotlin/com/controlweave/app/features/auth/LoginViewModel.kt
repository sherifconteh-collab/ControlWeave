package com.controlweave.app.features.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.controlweave.app.core.models.LoginData
import com.controlweave.app.core.network.ApiClient
import com.controlweave.app.core.network.AuthApiService
import com.controlweave.app.core.network.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginState(
    val email: String = "",
    val password: String = "",
    val totpCode: String = "",
    val showTOTP: Boolean = false,
    val isLoading: Boolean = false,
    val error: String? = null,
    val loginData: LoginData? = null
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val apiClient: ApiClient,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _state = MutableStateFlow(LoginState())
    val state: StateFlow<LoginState> = _state

    fun onEmailChange(v: String) { _state.value = _state.value.copy(email = v) }
    fun onPasswordChange(v: String) { _state.value = _state.value.copy(password = v) }
    fun onTotpChange(v: String) { _state.value = _state.value.copy(totpCode = v) }

    fun login() {
        val s = _state.value
        viewModelScope.launch {
            _state.value = s.copy(isLoading = true, error = null)
            runCatching {
                val service = apiClient.service<AuthApiService>()
                val body = buildMap<String, String?> {
                    put("email", s.email)
                    put("password", s.password)
                    if (s.showTOTP && s.totpCode.isNotBlank()) put("totpToken", s.totpCode)
                }
                val response = service.login(body)
                val apiResp = response.body()
                if (apiResp?.requiresTOTP == true) throw TotpRequiredException()
                if (!response.isSuccessful || apiResp?.success != true) {
                    throw Exception(apiResp?.error ?: "Login failed")
                }
                apiResp.data ?: throw Exception("No data returned")
            }.onSuccess { data ->
                tokenManager.accessToken = data.accessToken
                tokenManager.refreshToken = data.refreshToken
                _state.value = _state.value.copy(isLoading = false, loginData = data)
            }.onFailure { e ->
                when (e) {
                    is TotpRequiredException ->
                        _state.value = _state.value.copy(isLoading = false, showTOTP = true)
                    else ->
                        _state.value = _state.value.copy(isLoading = false, error = e.message)
                }
            }
        }
    }
}

private class TotpRequiredException : Exception("TOTP required")
