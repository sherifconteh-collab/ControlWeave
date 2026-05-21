import Foundation

final class DashboardService {
    static let shared = DashboardService()
    private init() {}

    func fetchStats() async throws -> DashboardStats {
        let response: DashboardStatsResponse = try await APIClient.shared.request(.dashboardStats)
        return response.data
    }
}
