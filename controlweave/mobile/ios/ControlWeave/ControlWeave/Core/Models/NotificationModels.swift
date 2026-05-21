import Foundation

struct NotificationsResponse: Decodable {
    let success: Bool
    let data: [AppNotification]
}

struct AppNotification: Decodable, Identifiable {
    let id: String
    let type: String
    let title: String
    let message: String
    let link: String?
    let isRead: Bool
    let createdAt: Date?
}
