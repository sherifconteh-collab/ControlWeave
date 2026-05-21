import SwiftUI
import PhotosUI

struct EvidenceListView: View {
    @StateObject private var viewModel = EvidenceViewModel()
    @State private var showUpload = false

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.evidence.isEmpty {
                    ProgressView("Loading evidence...")
                } else if let error = viewModel.errorMessage {
                    ErrorBanner(message: error) { Task { await viewModel.load() } }
                } else if viewModel.evidence.isEmpty {
                    ContentUnavailableView("No Evidence", systemImage: "doc.fill",
                        description: Text("Upload your first piece of evidence."))
                } else {
                    List(viewModel.evidence) { item in
                        EvidenceRow(item: item)
                    }
                }
            }
            .navigationTitle("Evidence")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { showUpload = true }) {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showUpload) {
                EvidenceUploadView(onUploaded: { Task { await viewModel.load() } })
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }
}

struct EvidenceUploadView: View {
    let onUploaded: () -> Void
    @Environment(\.dismiss) var dismiss
    @StateObject private var viewModel = EvidenceUploadViewModel()
    @State private var photoItem: PhotosPickerItem?

    var body: some View {
        NavigationStack {
            Form {
                Section("File") {
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Label(
                            viewModel.selectedFileName ?? "Choose from Photos",
                            systemImage: "photo"
                        )
                    }
                    .onChange(of: photoItem) { _, new in
                        Task { await viewModel.loadPhoto(new) }
                    }
                }

                Section("Details") {
                    TextField("Title", text: $viewModel.title)

                    Picker("PII Classification", selection: $viewModel.piiClassification) {
                        ForEach(PiiClassification.allCases, id: \.rawValue) {
                            Text($0.displayName).tag($0.rawValue)
                        }
                    }

                    Picker("Data Sensitivity", selection: $viewModel.dataSensitivity) {
                        ForEach(DataSensitivity.allCases, id: \.rawValue) {
                            Text($0.displayName).tag($0.rawValue)
                        }
                    }
                }

                if let error = viewModel.errorMessage {
                    Section {
                        Text(error).foregroundStyle(.red).font(.caption)
                    }
                }
            }
            .navigationTitle("Upload Evidence")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if viewModel.isUploading {
                        ProgressView()
                    } else {
                        Button("Upload") {
                            Task {
                                let success = await viewModel.upload()
                                if success { onUploaded(); dismiss() }
                            }
                        }
                        .disabled(viewModel.fileData == nil || viewModel.title.isEmpty)
                    }
                }
            }
        }
    }
}

@MainActor
final class EvidenceViewModel: ObservableObject {
    @Published var evidence: [Evidence] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do { evidence = try await EvidenceService.shared.list() }
        catch { errorMessage = error.localizedDescription }
    }
}

@MainActor
final class EvidenceUploadViewModel: ObservableObject {
    @Published var fileData: Data?
    @Published var selectedFileName: String?
    @Published var selectedMimeType: String = "image/jpeg"
    @Published var title = ""
    @Published var piiClassification = PiiClassification.none.rawValue
    @Published var dataSensitivity = DataSensitivity.internal.rawValue
    @Published var isUploading = false
    @Published var errorMessage: String?

    func loadPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }

        // Derive MIME type and file extension from the item's content type so
        // HEIC, PNG, and other formats are handled correctly server-side.
        let contentType = item.supportedContentTypes.first
        let mimeType: String
        let fileExtension: String
        if let utType = contentType {
            if utType.conforms(to: .png) {
                mimeType = "image/png"; fileExtension = "png"
            } else if utType.conforms(to: .webP) {
                mimeType = "image/webp"; fileExtension = "webp"
            } else if utType.conforms(to: .heic) || utType.identifier == "public.heic" {
                mimeType = "image/heic"; fileExtension = "heic"
            } else {
                // Default to JPEG for all other image types
                mimeType = "image/jpeg"; fileExtension = "jpg"
            }
        } else {
            mimeType = "image/jpeg"; fileExtension = "jpg"
        }

        if let data = try? await item.loadTransferable(type: Data.self) {
            fileData = data
            selectedFileName = "photo.\(fileExtension)"
            selectedMimeType = mimeType
        }
    }

    func upload() async -> Bool {
        guard let data = fileData, !title.isEmpty else { return false }
        isUploading = true
        errorMessage = nil
        defer { isUploading = false }
        do {
            try await EvidenceService.shared.upload(
                fileData: data,
                fileName: selectedFileName ?? "upload.jpg",
                mimeType: selectedMimeType,
                title: title,
                piiClassification: piiClassification,
                dataSensitivity: dataSensitivity
            )
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}

private struct EvidenceRow: View {
    let item: Evidence
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.title).font(.subheadline.bold())
            HStack {
                if let pii = item.piiClassification {
                    Text("PII: \(pii.capitalized)").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                if item.isExpired {
                    Text("Expired").font(.caption).foregroundStyle(.red)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
