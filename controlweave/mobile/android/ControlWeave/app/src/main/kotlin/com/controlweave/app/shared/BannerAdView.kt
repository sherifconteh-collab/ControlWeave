package com.controlweave.app.shared

import android.annotation.SuppressLint
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.controlweave.app.core.services.AdService
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView

/**
 * Compose wrapper for an Android [AdView] banner ad.
 * Only loads and renders an ad when [tier] is "community".
 */
@SuppressLint("MissingPermission")
@Composable
fun BannerAdView(tier: String, adService: AdService, modifier: Modifier = Modifier) {
    if (!adService.shouldShowAds(tier)) return

    AndroidView(
        modifier = modifier,
        factory = { context ->
            AdView(context).apply {
                setAdSize(AdSize.BANNER)
                adUnitId = adService.bannerUnitId
                loadAd(AdRequest.Builder().build())
            }
        }
    )
}
