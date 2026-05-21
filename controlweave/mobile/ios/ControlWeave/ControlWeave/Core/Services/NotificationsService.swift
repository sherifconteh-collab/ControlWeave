import Foundation

final class NotificationsService {
    static let shared = NotificationsService()
    private init() {}

    func list() async throws -> [AppNotification] {
        let response: NotificationsResponse = try await APIClient.shared.request(.notifications)
        return response.data
    }

    func markRead(id: String) async throws {
        struct Empty: Decodable { let success: Bool }
        let _: Empty = try await APIClient.shared.request(.markNotificationRead(id: id), method: "PATCH")
    }

    func markAllRead() async throws {
        struct Empty: Decodable { let success: Bool }
        let _: Empty = try await APIClient.shared.request(.markAllNotificationsRead, method: "POST")
    }
}
