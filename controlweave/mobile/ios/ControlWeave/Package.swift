// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ControlWeave",
    platforms: [.iOS(.v17)],
    dependencies: [
        .package(
            url: "https://github.com/RevenueCat/purchases-ios.git",
            from: "5.0.0"
        ),
        .package(
            url: "https://github.com/googleads/swift-package-manager-google-mobile-ads.git",
            from: "11.0.0"
        )
    ],
    targets: [
        .target(
            name: "ControlWeave",
            dependencies: [
                .product(name: "RevenueCat", package: "purchases-ios"),
                .product(name: "GoogleMobileAds", package: "swift-package-manager-google-mobile-ads")
            ]
        )
    ]
)
