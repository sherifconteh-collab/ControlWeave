import SwiftUI
import GoogleMobileAds

/// Wraps a GADBannerView in SwiftUI. Renders only when tier == "community".
struct BannerAdView: UIViewRepresentable {
    let tier: String

    func makeUIView(context: Context) -> GADBannerView {
        let banner = GADBannerView(adSize: GADAdSizeBanner)
        banner.adUnitID = AdService.bannerUnitId
        banner.rootViewController = context.coordinator.findRootViewController()
        if tier == "community" {
            context.coordinator.loadedForTier = tier
            banner.load(GADRequest())
        }
        return banner
    }

    func updateUIView(_ uiView: GADBannerView, context: Context) {
        // Only reload if the tier has changed to "community" since the last load
        // to avoid triggering a new ad request on every SwiftUI re-render.
        if tier == "community" && context.coordinator.loadedForTier != tier {
            context.coordinator.loadedForTier = tier
            uiView.load(GADRequest())
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject {
        var loadedForTier: String?

        func findRootViewController() -> UIViewController? {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first { $0.isKeyWindow }?
                .rootViewController
        }
    }
}
