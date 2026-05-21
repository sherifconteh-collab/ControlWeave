package com.controlweave.app.features.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.controlweave.app.core.models.DashboardStats
import com.controlweave.app.core.models.FrameworkBreakdown
import com.controlweave.app.core.services.AdService
import com.controlweave.app.shared.BannerAdView

@Composable
fun DashboardScreen(
    tier: String,
    adService: AdService,
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) { viewModel.load() }

    Scaffold(topBar = { TopAppBar(title = { Text("Dashboard") }) }) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.isLoading -> CircularProgressIndicator(Modifier.align(Alignment.Center))
                state.error != null -> Text(
                    state.error!!, color = Color.Red,
                    modifier = Modifier.align(Alignment.Center).padding(16.dp)
                )
                state.stats != null -> DashboardContent(state.stats!!, tier, adService)
            }
        }
    }
}

@Composable
private fun DashboardContent(stats: DashboardStats, tier: String, adService: AdService) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            // Compliance score card
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    Modifier.padding(24.dp).fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    val color = when {
                        stats.complianceScore >= 80 -> Color(0xFF2E7D32)
                        stats.complianceScore >= 60 -> Color(0xFFF57F17)
                        else -> Color(0xFFC62828)
                    }
                    Text(
                        "${stats.complianceScore.toInt()}%",
                        style = MaterialTheme.typography.displayMedium,
                        color = color
                    )
                    Text("Compliance Score", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("Total Controls", stats.totalControls.toString(), Modifier.weight(1f))
                StatCard("Implemented", stats.implementedControls.toString(), Modifier.weight(1f))
            }
        }
        stats.frameworkBreakdown?.takeIf { it.isNotEmpty() }?.let { frameworks ->
            item { Text("Frameworks", style = MaterialTheme.typography.titleMedium) }
            items(frameworks.size) { i -> FrameworkRow(frameworks[i]) }
        }
        item {
            BannerAdView(tier = tier, adService = adService, modifier = Modifier.fillMaxWidth().height(50.dp))
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier) {
        Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, style = MaterialTheme.typography.headlineMedium)
            Text(label, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun FrameworkRow(fw: FrameworkBreakdown) {
    Card(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(fw.shortName ?: fw.name, modifier = Modifier.weight(1f))
            Text(
                "${fw.complianceScore.toInt()}%",
                color = when {
                    fw.complianceScore >= 80 -> Color(0xFF2E7D32)
                    fw.complianceScore >= 60 -> Color(0xFFF57F17)
                    else -> Color(0xFFC62828)
                }
            )
        }
    }
}
