import Foundation

struct EvidenceListResponse: Decodable {
    let success: Bool
    let data: [Evidence]
}

struct Evidence: Decodable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let fileName: String?
    let fileType: String?
    let piiClassification: String?
    let dataSensitivity: String?
    let uploadedAt: Date?
    let expirationDate: Date?

    var isExpired: Bool {
        guard let exp = expirationDate else { return false }
        return exp < Date()
    }
}

enum PiiClassification: String, CaseIterable {
    case none, low, moderate, high, critical

    var displayName: String { rawValue.capitalized }
}

enum DataSensitivity: String, CaseIterable {
    case `public`, `internal`, confidential, restricted

    var displayName: String { rawValue.capitalized }
}
