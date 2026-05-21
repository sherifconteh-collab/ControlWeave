import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var authState: AuthState
    @StateObject private var viewModel = DashboardViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    ProgressView("Loading...")
                } else if let error = viewModel.errorMessage {
                    ErrorBanner(message: error) { Task { await viewModel.load() } }
                } else if let stats = viewModel.stats {
                    ScrollView {
                        VStack(spacing: 16) {
                            // Compliance gauge
                            ComplianceGaugeCard(score: stats.complianceScore)

                            // Summary tiles
                            LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 12) {
                                StatTile(label: "Total Controls", value: "\(stats.totalControls)")
                                StatTile(label: "Implemented", value: "\(stats.implementedControls)")
                                if let findings = stats.openFindings {
                                    StatTile(label: "Open Findings", value: "\(findings)")
                                }
                                if let overdue = stats.overdueItems {
                                    StatTile(label: "Overdue", value: "\(overdue)")
                                }
                            }
                            .padding(.horizontal)

                            // Per-framework breakdown
                            if let frameworks = stats.frameworkBreakdown, !frameworks.isEmpty {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Frameworks")
                                        .font(.headline)
                                        .padding(.horizontal)

                                    ForEach(frameworks) { fw in
                                        FrameworkRow(framework: fw)
                                    }
                                }
                            }
                        }
                        .padding(.vertical)

                        // AdMob banner — community tier only
                        BannerAdView(tier: authState.tier)
                            .frame(height: authState.tier == "community" ? 50 : 0)
                    }
                }
            }
            .navigationTitle("Dashboard")
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }
}

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published var stats: DashboardStats?
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            stats = try await DashboardService.shared.fetchStats()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct ComplianceGaugeCard: View {
    let score: Double
    var body: some View {
        VStack(spacing: 8) {
            Text("\(Int(score))%")
                .font(.system(size: 48, weight: .bold, design: .rounded))
                .foregroundStyle(score >= 80 ? .green : score >= 60 ? .orange : .red)
            Text("Compliance Score")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(.quaternary, in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

private struct StatTile: View {
    let label: String
    let value: String
    var body: some View {
        VStack(spacing: 4) {
            Text(value).font(.title2.bold())
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(.quaternary, in: RoundedRectangle(cornerRadius: 10))
    }
}

private struct FrameworkRow: View {
    let framework: FrameworkBreakdown
    var body: some View {
        HStack {
            Text(framework.shortName ?? framework.name).font(.subheadline)
            Spacer()
            ComplianceBadge(score: framework.complianceScore)
        }
        .padding(.horizontal)
        .padding(.vertical, 6)
        .background(.quaternary, in: RoundedRectangle(cornerRadius: 8))
        .padding(.horizontal)
    }
}
