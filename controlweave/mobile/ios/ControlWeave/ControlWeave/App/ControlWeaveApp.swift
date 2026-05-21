import SwiftUI
import RevenueCat

@main
struct ControlWeaveApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var authState = AuthState()

    init() {
        configureRevenueCat()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authState)
        }
    }

    private func configureRevenueCat() {
        let rcKey = Bundle.main.infoDictionary?["REVENUECAT_API_KEY"] as? String ?? ""
        guard !rcKey.isEmpty else { return }
        Purchases.configure(withAPIKey: rcKey)
        Purchases.logLevel = .warn
    }
}

/// Tracks authentication state across the app lifecycle.
final class AuthState: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var organization: Organization?
    @Published var user: User?

    var tier: String { organization?.tier ?? "community" }
}

struct RootView: View {
    @EnvironmentObject var authState: AuthState

    var body: some View {
        if authState.isAuthenticated {
            MainTabView()
        } else {
            LoginView()
        }
    }
}

struct MainTabView: View {
    @EnvironmentObject var authState: AuthState

    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Dashboard", systemImage: "chart.bar.fill") }
            ControlsListView()
                .tabItem { Label("Controls", systemImage: "shield.checkerboard") }
            AssessmentsListView()
                .tabItem { Label("Assessments", systemImage: "checklist") }
            EvidenceListView()
                .tabItem { Label("Evidence", systemImage: "doc.fill") }
            NotificationsView()
                .tabItem { Label("Alerts", systemImage: "bell.fill") }
        }
    }
}
