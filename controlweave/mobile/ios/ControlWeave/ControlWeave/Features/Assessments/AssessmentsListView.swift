import SwiftUI

struct AssessmentsListView: View {
    @EnvironmentObject var authState: AuthState
    @StateObject private var viewModel = AssessmentsViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.engagements.isEmpty {
                    ProgressView("Loading assessments...")
                } else if let error = viewModel.errorMessage {
                    ErrorBanner(message: error) { Task { await viewModel.load() } }
                } else {
                    List(viewModel.engagements) { engagement in
                        NavigationLink(destination: AssessmentDetailView(engagement: engagement)) {
                            EngagementRow(engagement: engagement)
                        }
                    }

                    BannerAdView(tier: authState.tier)
                        .frame(height: authState.tier == "community" ? 50 : 0)
                }
            }
            .navigationTitle("Assessments")
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }
}

struct AssessmentDetailView: View {
    let engagement: Engagement
    @StateObject private var viewModel = AssessmentDetailViewModel()

    var body: some View {
        List {
            Section("Details") {
                LabeledContent("Type", value: engagement.engagementType ?? "Assessment")
                LabeledContent("Status", value: engagement.status?.capitalized ?? "Unknown")
                if let auditor = engagement.auditorName {
                    LabeledContent("Auditor", value: auditor)
                }
            }

            Section("Findings (\(viewModel.findings.count))") {
                if viewModel.findings.isEmpty {
                    Text("No findings").foregroundStyle(.secondary)
                } else {
                    ForEach(viewModel.findings) { finding in
                        FindingRow(finding: finding)
                    }
                }
            }

            Section("PBC Items (\(viewModel.pbcItems.count))") {
                if viewModel.pbcItems.isEmpty {
                    Text("No PBC items").foregroundStyle(.secondary)
                } else {
                    ForEach(viewModel.pbcItems) { item in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title).font(.subheadline)
                            if let priority = item.priority {
                                Text(priority.uppercased()).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle(engagement.name)
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load(engagementId: engagement.id) }
    }
}

@MainActor
final class AssessmentsViewModel: ObservableObject {
    @Published var engagements: [Engagement] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do { engagements = try await AssessmentsService.shared.listEngagements() }
        catch { errorMessage = error.localizedDescription }
    }
}

@MainActor
final class AssessmentDetailViewModel: ObservableObject {
    @Published var findings: [Finding] = []
    @Published var pbcItems: [PbcItem] = []

    func load(engagementId: String) async {
        async let f = AssessmentsService.shared.findings(engagementId: engagementId)
        async let p = AssessmentsService.shared.pbcItems(engagementId: engagementId)
        findings = (try? await f) ?? []
        pbcItems = (try? await p) ?? []
    }
}

private struct EngagementRow: View {
    let engagement: Engagement
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(engagement.name).font(.subheadline.bold())
            HStack {
                Text(engagement.engagementType?.replacingOccurrences(of: "_", with: " ").capitalized ?? "")
                    .font(.caption).foregroundStyle(.secondary)
                Spacer()
                if let status = engagement.status {
                    Text(status.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.caption)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(.quaternary, in: Capsule())
                }
            }
        }
        .padding(.vertical, 2)
    }
}

private struct FindingRow: View {
    let finding: Finding
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(finding.title).font(.subheadline)
            if let severity = finding.severity {
                Text(severity.uppercased()).font(.caption)
                    .foregroundStyle(severity == "critical" || severity == "high" ? .red : .orange)
            }
        }
    }
}
