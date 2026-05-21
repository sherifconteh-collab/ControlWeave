plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.hilt)
    alias(libs.plugins.google.services)
    id("kotlin-kapt")
}

android {
    namespace = "com.controlweave.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.controlweave.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField("String", "API_BASE_URL", "\"https://app.controlweave.com\"")
        buildConfigField("String", "REVENUECAT_API_KEY", "\"${project.findProperty("REVENUECAT_ANDROID_KEY") ?: ""}\"")
        buildConfigField("String", "ADMOB_APP_ID", "\"${project.findProperty("ADMOB_APP_ID") ?: "ca-app-pub-3940256099942544~3347511713"}\"")
        buildConfigField("String", "ADMOB_BANNER_UNIT_ID", "\"${project.findProperty("ADMOB_BANNER_UNIT_ID") ?: "ca-app-pub-3940256099942544/6300978111"}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    // Compose BOM
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    debugImplementation(libs.androidx.ui.tooling)

    // Hilt DI
    implementation(libs.hilt.android)
    kapt(libs.hilt.compiler)
    implementation(libs.androidx.hilt.navigation.compose)

    // Networking
    implementation(libs.retrofit)
    implementation(libs.retrofit.moshi)
    implementation(libs.okhttp.logging)
    implementation(libs.moshi.kotlin)
    kapt(libs.moshi.codegen)

    // Secure token storage
    implementation(libs.androidx.security.crypto)

    // RevenueCat
    implementation(libs.revenuecat)

    // Firebase / FCM
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)

    // AdMob
    implementation(libs.play.services.ads)

    // Coil for image loading
    implementation(libs.coil.compose)
}
