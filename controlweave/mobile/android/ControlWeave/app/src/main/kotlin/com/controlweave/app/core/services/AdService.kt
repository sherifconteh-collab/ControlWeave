package com.controlweave.app.core.services

import com.controlweave.app.BuildConfig
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AdService @Inject constructor() {

    /** Returns true when ads should be shown for the given tier. */
    fun shouldShowAds(tier: String): Boolean = tier == "community"

    val bannerUnitId: String
        get() = if (BuildConfig.DEBUG) {
            // Google test banner ad unit ID
            "ca-app-pub-3940256099942544/6300978111"
        } else {
            BuildConfig.ADMOB_BANNER_UNIT_ID
        }
}
