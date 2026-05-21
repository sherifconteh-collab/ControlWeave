import Foundation
import GoogleMobileAds

/// Manages AdMob banner ad state for community-tier users.
/// Ads are shown only when the authenticated org is on the free community tier.
final class AdService: ObservableObject {
    static let shared = AdService()
    private init() {}

    private(set) var isInitialized = false

    func initialize() {
        guard !isInitialized else { return }
        GADMobileAds.sharedInstance().start { _ in }
        isInitialized = true
    }

    /// Returns true when ads should be displayed for the given tier.
    func shouldShowAds(tier: String) -> Bool {
        tier == "community"
    }

    /// The AdMob banner unit ID injected via Xcode build settings.
    /// Falls back to the Google test ad unit ID in debug builds.
    static var bannerUnitId: String {
        #if DEBUG
        return "ca-app-pub-3940256099942544/2934735716"
        #else
        return Bundle.main.infoDictionary?["ADMOB_BANNER_UNIT_ID"] as? String
            ?? "ca-app-pub-3940256099942544/2934735716"
        #endif
    }
}
