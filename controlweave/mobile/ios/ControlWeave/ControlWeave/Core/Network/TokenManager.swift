import Foundation
import Security

/// Stores and retrieves JWT tokens from the iOS Keychain.
final class TokenManager {
    static let shared = TokenManager()
    private init() {}

    private let accessTokenKey = "cw.accessToken"
    private let refreshTokenKey = "cw.refreshToken"
    private let devicePushTokenKey = "cw.devicePushToken"

    var accessToken: String? {
        get { load(key: accessTokenKey) }
        set { newValue == nil ? delete(key: accessTokenKey) : save(newValue!, key: accessTokenKey) }
    }

    var refreshToken: String? {
        get { load(key: refreshTokenKey) }
        set { newValue == nil ? delete(key: refreshTokenKey) : save(newValue!, key: refreshTokenKey) }
    }

    /// The APNs device token registered for push notifications on this device.
    var devicePushToken: String? {
        get { load(key: devicePushTokenKey) }
        set { newValue == nil ? delete(key: devicePushTokenKey) : save(newValue!, key: devicePushTokenKey) }
    }

    func clearAll() {
        delete(key: accessTokenKey)
        delete(key: refreshTokenKey)
        delete(key: devicePushTokenKey)
    }

    // MARK: - Keychain helpers

    private func save(_ value: String, key: String) {
        guard let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String:            kSecClassGenericPassword,
            kSecAttrAccount as String:      key,
            kSecValueData as String:        data,
            kSecAttrAccessible as String:   kSecAttrAccessibleAfterFirstUnlock
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    private func load(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String:        kSecClassGenericPassword,
            kSecAttrAccount as String:  key,
            kSecReturnData as String:   true,
            kSecMatchLimit as String:   kSecMatchLimitOne
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String:        kSecClassGenericPassword,
            kSecAttrAccount as String:  key
        ]
        SecItemDelete(query as CFDictionary)
    }
}
