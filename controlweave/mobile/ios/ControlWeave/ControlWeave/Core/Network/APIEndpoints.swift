import Foundation

enum APIEndpoint {
    // Auth
    case login
    case logout
    case refreshToken

    // Dashboard
    case dashboardStats

    // Controls
    case controls
    case controlsWithParams(page: Int, limit: Int, search: String?)
    case controlDetail(id: String)
    case updateControlStatus(id: String)

    // Assessments
    case engagements
    case engagementDetail(id: String)
    case engagementFindings(id: String)
    case engagementPbc(id: String)

    // Evidence
    case evidence
    case evidenceUpload

    // Notifications
    case notifications
    case markNotificationRead(id: String)
    case markAllNotificationsRead

    // Push tokens
    case registerPushToken
    case deletePushToken(token: String)

    // Billing
    case mobileUpgrade
    case activateLicense

    var path: String {
        let base = "/api/v1"
        switch self {
        case .login:                          return "\(base)/auth/login"
        case .logout:                         return "\(base)/auth/logout"
        case .refreshToken:                   return "\(base)/auth/refresh"
        case .dashboardStats:                 return "\(base)/dashboard/stats"
        case .controls:                       return "\(base)/controls"
        case .controlsWithParams(let page, let limit, let search):
            var path = "\(base)/controls?page=\(page)&limit=\(limit)"
            if let search, !search.isEmpty {
                path += "&search=\(search.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")"
            }
            return path
        case .controlDetail(let id):          return "\(base)/controls/\(id)"
        case .updateControlStatus(let id):    return "\(base)/controls/\(id)"
        case .engagements:                    return "\(base)/assessments/engagements"
        case .engagementDetail(let id):       return "\(base)/assessments/engagements/\(id)"
        case .engagementFindings(let id):     return "\(base)/assessments/engagements/\(id)/findings"
        case .engagementPbc(let id):          return "\(base)/assessments/engagements/\(id)/pbc"
        case .evidence:                       return "\(base)/evidence"
        case .evidenceUpload:                 return "\(base)/evidence"
        case .notifications:                  return "\(base)/notifications"
        case .markNotificationRead(let id):   return "\(base)/notifications/\(id)/read"
        case .markAllNotificationsRead:       return "\(base)/notifications/read-all"
        case .registerPushToken:              return "\(base)/push-tokens"
        case .deletePushToken(let token):     return "\(base)/push-tokens/\(token.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? token)"
        case .mobileUpgrade:                  return "\(base)/billing/mobile-upgrade"
        case .activateLicense:                return "\(base)/billing/activate-license"
        }
    }
}
