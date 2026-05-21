import Foundation

final class ControlsService {
    static let shared = ControlsService()
    private init() {}

    func list(page: Int = 1, limit: Int = 50, search: String? = nil) async throws -> [Control] {
        let response: ControlsResponse = try await APIClient.shared.request(
            .controlsWithParams(page: page, limit: limit, search: search)
        )
        return response.data
    }

    func detail(id: String) async throws -> Control {
        let response: ControlResponse = try await APIClient.shared.request(.controlDetail(id: id))
        return response.data
    }

    func updateStatus(id: String, status: String, notes: String?) async throws -> Control {
        struct UpdateBody: Encodable {
            let implementationStatus: String
            let implementationNotes: String?
        }
        let response: ControlResponse = try await APIClient.shared.request(
            .updateControlStatus(id: id),
            method: "PUT",
            body: UpdateBody(implementationStatus: status, implementationNotes: notes)
        )
        return response.data
    }
}
