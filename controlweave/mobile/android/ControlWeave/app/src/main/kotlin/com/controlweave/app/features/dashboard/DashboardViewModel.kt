package com.controlweave.app.features.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.controlweave.app.core.models.DashboardStats
import com.controlweave.app.core.network.ApiClient
import com.controlweave.app.core.network.ApiResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import retrofit2.http.GET
import javax.inject.Inject

data class DashboardState(
    val stats: DashboardStats? = null,
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class DashboardViewModel @Inject constructor(private val apiClient: ApiClient) : ViewModel() {

    private val _state = MutableStateFlow(DashboardState())
    val state: StateFlow<DashboardState> = _state

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            runCatching {
                val service = apiClient.service<DashboardApiService>()
                val response = service.getStats()
                response.data ?: throw Exception(response.error ?: "Failed to load stats")
            }.onSuccess { stats ->
                _state.value = DashboardState(stats = stats)
            }.onFailure { e ->
                _state.value = DashboardState(error = e.message)
            }
        }
    }
}

interface DashboardApiService {
    @GET("/api/v1/dashboard/stats")
    suspend fun getStats(): ApiResponse<DashboardStats>
}
