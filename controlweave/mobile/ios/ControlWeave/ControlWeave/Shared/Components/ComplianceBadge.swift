import SwiftUI

/// Renders a color-coded badge for a compliance score (0-100) or an implementation status string.
struct ComplianceBadge: View {
    var score: Double?
    var status: String?

    var body: some View {
        Text(label)
            .font(.caption.bold())
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }

    private var label: String {
        if let score { return "\(Int(score))%" }
        if let status { return status.replacingOccurrences(of: "_", with: " ").capitalized }
        return ""
    }

    private var color: Color {
        if let score {
            return score >= 80 ? .green : score >= 60 ? .orange : .red
        }
        switch status ?? "" {
        case "implemented":                     return .green
        case "partially_implemented":           return .orange
        case "not_implemented":                 return .red
        case "not_applicable":                  return .secondary
        default:                                return .blue
        }
    }
}
