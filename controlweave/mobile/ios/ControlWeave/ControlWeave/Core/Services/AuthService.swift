import Foundation

final class AuthService {
    static let shared = AuthService()
    private init() {}

    func login(email: String, password: String, totpToken: String? = nil) async throws -> LoginData {
        let body = LoginRequest(email: email, password: password, totpToken: totpToken)
        let response: LoginResponse = try await APIClient.shared.request(.login, method: "POST", body: body)

        if response.requiresTOTP == true {
            throw LoginError.requiresTOTP
        }
        guard response.success, let data = response.data else {
            throw APIError.serverError(401, response.error ?? "Login failed")
        }

        TokenManager.shared.accessToken = data.accessToken
        TokenManager.shared.refreshToken = data.refreshToken
        return data
    }

    func logout() async {
        // Remove push token from server before clearing local tokens so the
        // device stops receiving notifications for this account after logout.
        if let pushToken = TokenManager.shared.devicePushToken {
            try? await APIClient.shared.removePushToken(pushToken)
        }
        if TokenManager.shared.accessToken != nil {
            _ = try? await APIClient.shared.request(.logout, method: "POST") as EmptyResponse
        }
        TokenManager.shared.clearAll()
    }
}

enum LoginError: Error, LocalizedError {
    case requiresTOTP

    var errorDescription: String? { "TOTP code required" }
}

private struct EmptyResponse: Decodable { let success: Bool? }
