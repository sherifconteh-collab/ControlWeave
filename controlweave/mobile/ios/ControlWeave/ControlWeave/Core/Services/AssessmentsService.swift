import Foundation

final class AssessmentsService {
    static let shared = AssessmentsService()
    private init() {}

    func listEngagements() async throws -> [Engagement] {
        let response: EngagementsResponse = try await APIClient.shared.request(.engagements)
        return response.data
    }

    func detail(id: String) async throws -> Engagement {
        let response: EngagementResponse = try await APIClient.shared.request(.engagementDetail(id: id))
        return response.data
    }

    func findings(engagementId: String) async throws -> [Finding] {
        let response: FindingsResponse = try await APIClient.shared.request(.engagementFindings(id: engagementId))
        return response.data
    }

    func pbcItems(engagementId: String) async throws -> [PbcItem] {
        let response: PbcResponse = try await APIClient.shared.request(.engagementPbc(id: engagementId))
        return response.data
    }
}
