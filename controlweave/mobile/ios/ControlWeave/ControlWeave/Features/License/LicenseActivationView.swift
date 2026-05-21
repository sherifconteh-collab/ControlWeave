import SwiftUI
import RevenueCat

/// Shown from TierGateView when the user wants to unlock a paid tier.
/// - Pro: RevenueCat IAP purchase flow
/// - Enterprise: License key entry that calls POST /billing/activate-license
struct TierGateView: View {
    let requiredTier: String
    let featureName: String
    @EnvironmentObject var authState: AuthState
    @StateObject private var viewModel = TierGateViewModel()
    @State private var showLicenseEntry = false

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text("\(featureName) requires \(requiredTier.capitalized)")
                .font(.title2.bold())
                .multilineTextAlignment(.center)

            if requiredTier == "pro" || requiredTier == "enterprise" {
                VStack(spacing: 12) {
                    // Pro IAP button
                    Button(action: { Task { await viewModel.purchasePro(authState: authState) } }) {
                        if viewModel.isPurchasing {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            VStack {
                                Text("Upgrade to Pro")
                                Text("$499/mo or $4,990/yr via App Store").font(.caption)
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(viewModel.isPurchasing)

                    if requiredTier == "enterprise" {
                        Button("Activate Enterprise License Key") {
                            showLicenseEntry = true
                        }
                        .buttonStyle(.bordered)
                    }
                }
                .padding(.horizontal)
            }

            if let error = viewModel.errorMessage {
                Text(error).font(.caption).foregroundStyle(.red).multilineTextAlignment(.center).padding(.horizontal)
            }
        }
        .padding()
        .sheet(isPresented: $showLicenseEntry) {
            LicenseActivationView(onActivated: { tier in
                authState.organization = Organization(
                    id: authState.organization?.id ?? "",
                    name: authState.organization?.name ?? "",
                    tier: tier,
                    billingStatus: "license"
                )
            })
        }
    }
}

struct LicenseActivationView: View {
    let onActivated: (String) -> Void
    @Environment(\.dismiss) var dismiss
    @StateObject private var viewModel = LicenseViewModel()

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("License Key (JWT)", text: $viewModel.licenseKey, axis: .vertical)
                        .lineLimit(4...8)
                        .font(.system(.caption, design: .monospaced))
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                }

                if let error = viewModel.errorMessage {
                    Section {
                        Text(error).foregroundStyle(.red).font(.caption)
                    }
                }

                Section {
                    Text("Enterprise license keys are provided when you purchase an Enterprise plan via the ControlWeave website. Contact support if you need your key resent.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Activate License")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if viewModel.isActivating {
                        ProgressView()
                    } else {
                        Button("Activate") {
                            Task {
                                if let tier = await viewModel.activate() {
                                    onActivated(tier)
                                    dismiss()
                                }
                            }
                        }
                        .disabled(viewModel.licenseKey.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            }
        }
    }
}

@MainActor
final class LicenseViewModel: ObservableObject {
    @Published var licenseKey = ""
    @Published var isActivating = false
    @Published var errorMessage: String?

    func activate() async -> String? {
        isActivating = true
        errorMessage = nil
        defer { isActivating = false }

        struct Body: Encodable { let licenseKey: String }
        struct Response: Decodable {
            let success: Bool
            let data: LicenseData?
            let error: String?
        }
        struct LicenseData: Decodable { let tier: String }

        do {
            let response: Response = try await APIClient.shared.request(
                .activateLicense,
                method: "POST",
                body: Body(licenseKey: licenseKey.trimmingCharacters(in: .whitespaces))
            )
            if response.success, let data = response.data {
                return data.tier
            }
            errorMessage = response.error ?? "Activation failed"
        } catch {
            errorMessage = error.localizedDescription
        }
        return nil
    }
}

@MainActor
final class TierGateViewModel: ObservableObject {
    @Published var isPurchasing = false
    @Published var errorMessage: String?

    func purchasePro(authState: AuthState) async {
        isPurchasing = true
        errorMessage = nil
        defer { isPurchasing = false }

        do {
            let offerings = try await Purchases.shared.offerings()
            guard let current = offerings.current, !current.availablePackages.isEmpty else {
                errorMessage = "No packages available. Try again later."
                return
            }

            // Prefer the monthly package (explicit SDK type lookup); fall back to
            // annual. Absence of both is treated as a configuration error rather
            // than silently selecting an arbitrary package via .first.
            guard let pkg = current.monthly ?? current.annual else {
                errorMessage = "No Pro package found. Contact support."
                return
            }

            let result = try await Purchases.shared.purchase(package: pkg)
            if result.userCancelled { return }

            // productIdentifier must be present — if the store returns nil the
            // transaction cannot be verified server-side.
            guard let productId = result.transaction?.productIdentifier,
                  !productId.isEmpty else {
                errorMessage = "Purchase could not be verified. Please contact support with your purchase confirmation."
                return
            }

            struct Body: Encodable { let activeProductId: String }
            struct Response: Decodable {
                let success: Bool
                let data: UpgradeData?
            }
            struct UpgradeData: Decodable { let tier: String }

            let response: Response = try await APIClient.shared.request(
                .mobileUpgrade,
                method: "POST",
                body: Body(activeProductId: productId)
            )

            if response.success, let data = response.data {
                authState.organization = Organization(
                    id: authState.organization?.id ?? "",
                    name: authState.organization?.name ?? "",
                    tier: data.tier,
                    billingStatus: "active_paid"
                )
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
