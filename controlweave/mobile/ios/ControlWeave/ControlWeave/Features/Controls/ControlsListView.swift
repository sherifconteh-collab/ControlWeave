import SwiftUI

struct ControlsListView: View {
    @EnvironmentObject var authState: AuthState
    @StateObject private var viewModel = ControlsViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.controls.isEmpty {
                    ProgressView("Loading controls...")
                } else if let error = viewModel.errorMessage {
                    ErrorBanner(message: error) { Task { await viewModel.load() } }
                } else {
                    List(viewModel.filteredControls) { control in
                        NavigationLink(destination: ControlDetailView(control: control)) {
                            ControlRow(control: control)
                        }
                    }
                    .searchable(text: $viewModel.searchText, prompt: "Search controls")

                    BannerAdView(tier: authState.tier)
                        .frame(height: authState.tier == "community" ? 50 : 0)
                }
            }
            .navigationTitle("Controls")
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }
}

struct ControlDetailView: View {
    let control: Control
    @StateObject private var viewModel = ControlDetailViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let cid = control.controlId {
                    Text(cid).font(.caption).foregroundStyle(.secondary)
                }
                Text(control.title).font(.headline)
                if let desc = control.description {
                    Text(desc).font(.body).foregroundStyle(.secondary)
                }

                Divider()

                Text("Implementation Status").font(.subheadline.bold())
                Picker("Status", selection: $viewModel.selectedStatus) {
                    ForEach(ImplementationStatus.allCases, id: \.rawValue) { s in
                        Text(s.displayName).tag(s.rawValue)
                    }
                }
                .pickerStyle(.menu)

                if viewModel.isSaving {
                    ProgressView("Saving...").frame(maxWidth: .infinity)
                } else {
                    Button("Save Status") { Task { await viewModel.save(controlId: control.id) } }
                        .buttonStyle(.borderedProminent)
                }

                if let error = viewModel.errorMessage {
                    Text(error).font(.caption).foregroundStyle(.red)
                }
            }
            .padding()
        }
        .navigationTitle("Control Detail")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { viewModel.selectedStatus = control.implementationStatus ?? ImplementationStatus.notImplemented.rawValue }
    }
}

@MainActor
final class ControlsViewModel: ObservableObject {
    @Published var controls: [Control] = []
    @Published var searchText = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    var filteredControls: [Control] {
        guard !searchText.isEmpty else { return controls }
        return controls.filter {
            $0.title.localizedCaseInsensitiveContains(searchText) ||
            ($0.controlId?.localizedCaseInsensitiveContains(searchText) == true)
        }
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do { controls = try await ControlsService.shared.list() }
        catch { errorMessage = error.localizedDescription }
    }
}

@MainActor
final class ControlDetailViewModel: ObservableObject {
    @Published var selectedStatus = ""
    @Published var isSaving = false
    @Published var errorMessage: String?

    func save(controlId: String) async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do { _ = try await ControlsService.shared.updateStatus(id: controlId, status: selectedStatus, notes: nil) }
        catch { errorMessage = error.localizedDescription }
    }
}

private struct ControlRow: View {
    let control: Control
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                if let cid = control.controlId { Text(cid).font(.caption).foregroundStyle(.secondary) }
                Spacer()
                if let status = control.implementationStatus {
                    ComplianceBadge(status: status)
                }
            }
            Text(control.title).font(.subheadline).lineLimit(2)
        }
        .padding(.vertical, 2)
    }
}
