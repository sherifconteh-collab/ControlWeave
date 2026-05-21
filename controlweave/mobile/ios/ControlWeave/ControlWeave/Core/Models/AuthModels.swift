import Foundation

struct LoginRequest: Encodable {
    let email: String
    let password: String
    let totpToken: String?
}

struct LoginResponse: Decodable {
    let success: Bool
    let data: LoginData?
    let requiresTOTP: Bool?
    let error: String?
}

struct LoginData: Decodable {
    let accessToken: String
    let refreshToken: String
    let user: User
    let organization: Organization
}

struct User: Decodable, Identifiable {
    let id: String
    let email: String
    let firstName: String?
    let lastName: String?
    let role: String

    var displayName: String {
        let parts = [firstName, lastName].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? email : parts.joined(separator: " ")
    }
}

struct Organization: Decodable, Identifiable {
    let id: String
    let name: String
    let tier: String
    let billingStatus: String?
}
