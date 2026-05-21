import Foundation

struct ControlsResponse: Decodable {
    let success: Bool
    let data: [Control]
}

struct ControlResponse: Decodable {
    let success: Bool
    let data: Control
}

struct Control: Decodable, Identifiable {
    let id: String
    let controlId: String?
    let title: String
    let description: String?
    let implementationStatus: String?
    let severity: String?
    let frameworkId: String?
    let updatedAt: Date?
}

enum ImplementationStatus: String, CaseIterable {
    case implemented
    case partiallyImplemented = "partially_implemented"
    case notImplemented = "not_implemented"
    case notApplicable = "not_applicable"
    case planned

    var displayName: String {
        switch self {
        case .implemented:          return "Implemented"
        case .partiallyImplemented: return "Partial"
        case .notImplemented:       return "Not Implemented"
        case .notApplicable:        return "N/A"
        case .planned:              return "Planned"
        }
    }
}
