import Foundation

struct EngagementsResponse: Decodable {
    let success: Bool
    let data: [Engagement]
}

struct EngagementResponse: Decodable {
    let success: Bool
    let data: Engagement
}

struct Engagement: Decodable, Identifiable {
    let id: String
    let name: String
    let engagementType: String?
    let status: String?
    let startDate: Date?
    let endDate: Date?
    let auditorName: String?
    let createdAt: Date?
}

struct FindingsResponse: Decodable {
    let success: Bool
    let data: [Finding]
}

struct Finding: Decodable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let severity: String?
    let status: String?
    let controlId: String?
}

struct PbcResponse: Decodable {
    let success: Bool
    let data: [PbcItem]
}

struct PbcItem: Decodable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let priority: String?
    let status: String?
    let dueDate: Date?
}
