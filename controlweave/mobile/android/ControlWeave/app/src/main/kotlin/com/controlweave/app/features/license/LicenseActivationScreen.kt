package com.controlweave.app.features.license

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Enterprise license key activation screen.
 * Calls POST /api/v1/billing/activate-license with the entered JWT key.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LicenseActivationScreen(
    onActivated: (tier: String) -> Unit,
    onDismiss: () -> Unit,
    viewModel: LicenseViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(state.activatedTier) {
        state.activatedTier?.let { onActivated(it) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Activate License") },
                navigationIcon = {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                }
            )
        }
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OutlinedTextField(
                value = state.licenseKey,
                onValueChange = viewModel::onKeyChange,
                label = { Text("License Key (JWT)") },
                minLines = 4,
                maxLines = 8,
                textStyle = LocalTextStyle.current.copy(fontFamily = FontFamily.Monospace),
                modifier = Modifier.fillMaxWidth()
            )

            state.error?.let { Text(it, color = Color.Red, style = MaterialTheme.typography.bodySmall) }

            Text(
                "Enterprise license keys are provided when you purchase an Enterprise plan via the ControlWeave website. Contact support if you need your key resent.",
                style = MaterialTheme.typography.bodySmall,
                color = Color.Gray
            )

            Button(
                onClick = viewModel::activate,
                enabled = !state.isActivating && state.licenseKey.isNotBlank(),
                modifier = Modifier.align(Alignment.End)
            ) {
                if (state.isActivating) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                else Text("Activate")
            }
        }
    }
}
