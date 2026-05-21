import Foundation

extension Date {
    var shortDisplay: String {
        Date.shortFormatter.string(from: self)
    }

    var relativeDisplay: String {
        Date.relativeFormatter.localizedString(for: self, relativeTo: Date())
    }

    // MARK: - Cached formatters

    private static let shortFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .short
        f.timeStyle = .none
        return f
    }()

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .abbreviated
        return f
    }()
}
