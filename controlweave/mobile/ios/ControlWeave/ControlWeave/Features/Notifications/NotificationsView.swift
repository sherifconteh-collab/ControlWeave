import SwiftUI

struct NotificationsView: View {
    @StateObject private var viewModel = NotificationsViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.notifications.isEmpty {
                    ProgressView("Loading...")
                } else if viewModel.notifications.isEmpty {
                    ContentUnavailableView("No Notifications", systemImage: "bell.slash",
                        description: Text("You're all caught up."))
                } else {
                    List(viewModel.notifications) { notification in
                        NotificationRow(notification: notification) {
                            Task { await viewModel.markRead(id: notification.id) }
                        }
                    }
                }
            }
            .navigationTitle("Notifications")
            .toolbar {
                if !viewModel.notifications.filter({ !$0.isRead }).isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Mark All Read") { Task { await viewModel.markAllRead() } }
                    }
                }
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }
}

@MainActor
final class NotificationsViewModel: ObservableObject {
    @Published var notifications: [AppNotification] = []
    @Published var isLoading = false

    func load() async {
        isLoading = true
        defer { isLoading = false }
        notifications = (try? await NotificationsService.shared.list()) ?? []
    }

    func markRead(id: String) async {
        try? await NotificationsService.shared.markRead(id: id)
        if let idx = notifications.firstIndex(where: { $0.id == id }) {
            notifications[idx] = AppNotification(
                id: notifications[idx].id,
                type: notifications[idx].type,
                title: notifications[idx].title,
                message: notifications[idx].message,
                link: notifications[idx].link,
                isRead: true,
                createdAt: notifications[idx].createdAt
            )
        }
    }

    func markAllRead() async {
        try? await NotificationsService.shared.markAllRead()
        await load()
    }
}

private struct NotificationRow: View {
    let notification: AppNotification
    let onRead: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(notification.title).font(.subheadline.bold())
                if !notification.isRead {
                    Circle().fill(.blue).frame(width: 8, height: 8)
                }
                Spacer()
            }
            Text(notification.message).font(.caption).foregroundStyle(.secondary).lineLimit(2)
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
        .onTapGesture { if !notification.isRead { onRead() } }
    }
}
