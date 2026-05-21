package com.controlweave.app.features.license

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.controlweave.app.core.network.ApiClient
import com.controlweave.app.core.network.ApiResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import retrofit2.http.Body
import retrofit2.http.POST
import javax.inject.Inject

data class LicenseState(
    val licenseKey: String = "",
    val isActivating: Boolean = false,
    val error: String? = null,
    val activatedTier: String? = null
)

@HiltViewModel
class LicenseViewModel @Inject constructor(private val apiClient: ApiClient) : ViewModel() {

    private val _state = MutableStateFlow(LicenseState())
    val state: StateFlow<LicenseState> = _state

    fun onKeyChange(v: String) { _state.value = _state.value.copy(licenseKey = v) }

    fun activate() {
        val key = _state.value.licenseKey.trim()
        if (key.isBlank()) return

        viewModelScope.launch {
            _state.value = _state.value.copy(isActivating = true, error = null)
            runCatching {
                val service = apiClient.service<LicenseApiService>()
                val response = service.activateLicense(mapOf("licenseKey" to key))
                if (response.success != true || response.data == null) {
                    throw Exception(response.error ?: "Activation failed")
                }
                response.data.tier
            }.onSuccess { tier ->
                _state.value = _state.value.copy(isActivating = false, activatedTier = tier)
            }.onFailure { e ->
                _state.value = _state.value.copy(isActivating = false, error = e.message)
            }
        }
    }
}

interface LicenseApiService {
    @POST("/api/v1/billing/activate-license")
    suspend fun activateLicense(@Body body: Map<String, String>): ApiResponse<LicenseData>
}

data class LicenseData(val tier: String)
