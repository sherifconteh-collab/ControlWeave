import Foundation

struct DashboardStatsResponse: Decodable {
    let success: Bool
    let data: DashboardStats
}

struct DashboardStats: Decodable {
    let totalControls: Int
    let implementedControls: Int
    let complianceScore: Double
    let frameworkBreakdown: [FrameworkBreakdown]?
    let openFindings: Int?
    let overdueItems: Int?
}

struct FrameworkBreakdown: Decodable, Identifiable {
    let id: String
    let name: String
    let shortName: String?
    let complianceScore: Double
    let totalControls: Int
    let implementedControls: Int
}
