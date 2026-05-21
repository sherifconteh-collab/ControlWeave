import Foundation
import UniformTypeIdentifiers

final class EvidenceService {
    static let shared = EvidenceService()
    private init() {}

    func list() async throws -> [Evidence] {
        let response: EvidenceListResponse = try await APIClient.shared.request(.evidence)
        return response.data
    }

    func upload(
        fileData: Data,
        fileName: String,
        mimeType: String,
        title: String,
        piiClassification: String,
        dataSensitivity: String
    ) async throws {
        let fields: [String: String] = [
            "title": title,
            "pii_classification": piiClassification,
            "data_sensitivity": dataSensitivity
        ]
        _ = try await APIClient.shared.upload(
            .evidenceUpload,
            fileData: fileData,
            fileName: fileName,
            mimeType: mimeType,
            fields: fields
        )
    }
}
