package com.controlweave.app

import android.app.Application
import com.google.android.gms.ads.MobileAds
import com.revenuecat.purchases.LogLevel
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class ControlWeaveApp : Application() {

    override fun onCreate() {
        super.onCreate()
        configureRevenueCat()
        configureMobileAds()
    }

    private fun configureRevenueCat() {
        val key = BuildConfig.REVENUECAT_API_KEY
        if (key.isBlank()) return
        Purchases.logLevel = LogLevel.WARN
        Purchases.configure(PurchasesConfiguration.Builder(this, key).build())
    }

    private fun configureMobileAds() {
        MobileAds.initialize(this)
    }
}
