import Foundation

enum APIError: Error, LocalizedError {
    case invalidURL
    case noData
    case unauthorized
    case serverError(Int, String)
    case decodingError(Error)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:               return "Invalid URL"
        case .noData:                   return "No data received"
        case .unauthorized:             return "Session expired. Please log in again."
        case .serverError(let code, let msg): return "Server error \(code): \(msg)"
        case .decodingError(let e):     return "Failed to parse response: \(e.localizedDescription)"
        case .networkError(let e):      return e.localizedDescription
        }
    }
}

final class APIClient {
    static let shared = APIClient()
    private init() {}

    private let session = URLSession.shared
    private let baseURL: String = {
        Bundle.main.infoDictionary?["API_BASE_URL"] as? String ?? "https://app.controlweave.com"
    }()

    // MARK: - Generic request

    func request<T: Decodable>(
        _ endpoint: APIEndpoint,
        method: String = "GET",
        body: Encodable? = nil,
        retryOnUnauthorized: Bool = true
    ) async throws -> T {
        guard let url = URL(string: baseURL + endpoint.path) else {
            throw APIError.invalidURL
        }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = TokenManager.shared.accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            req.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.networkError(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.noData
        }

        if http.statusCode == 401 && retryOnUnauthorized {
            try await refreshTokens()
            return try await request(endpoint, method: method, body: body, retryOnUnauthorized: false)
        }

        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(ErrorResponse.self, from: data))?.error ?? "Unknown error"
            throw APIError.serverError(http.statusCode, message)
        }

        do {
            return try JSONDecoder.isoDecoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Token refresh

    private func refreshTokens() async throws {
        guard let refreshToken = TokenManager.shared.refreshToken else {
            throw APIError.unauthorized
        }

        struct RefreshBody: Encodable { let refreshToken: String }
        struct RefreshResponse: Decodable {
            let success: Bool
            let data: TokenPair
        }
        struct TokenPair: Decodable {
            let accessToken: String
            let refreshToken: String
        }

        let result: RefreshResponse = try await request(
            .refreshToken,
            method: "POST",
            body: RefreshBody(refreshToken: refreshToken),
            retryOnUnauthorized: false
        )

        TokenManager.shared.accessToken = result.data.accessToken
        TokenManager.shared.refreshToken = result.data.refreshToken
    }

    // MARK: - Multipart upload

    func upload(
        _ endpoint: APIEndpoint,
        fileData: Data,
        fileName: String,
        mimeType: String,
        fields: [String: String]
    ) async throws -> Data {
        guard let url = URL(string: baseURL + endpoint.path) else {
            throw APIError.invalidURL
        }

        let boundary = UUID().uuidString
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        if let token = TokenManager.shared.accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        var body = Data()
        for (key, value) in fields {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        req.httpBody = body

        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError.serverError((response as? HTTPURLResponse)?.statusCode ?? 0, "Upload failed")
        }
        return data
    }

    // MARK: - Convenience

    func registerPushToken(_ token: String, platform: String) async throws {
        struct Body: Encodable { let token: String; let platform: String }
        struct Empty: Decodable { let success: Bool }
        let _: Empty = try await request(.registerPushToken, method: "POST", body: Body(token: token, platform: platform))
    }

    func removePushToken(_ token: String) async throws {
        struct Empty: Decodable { let success: Bool }
        let _: Empty = try await request(.deletePushToken(token: token), method: "DELETE")
    }
}

private struct ErrorResponse: Decodable { let error: String }

/// Type-erasing wrapper so `Encodable` existentials can be passed to
/// `JSONEncoder.encode`, which requires a concrete conforming type.
private struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void
    init(_ base: any Encodable) { self._encode = { try base.encode(to: $0) } }
    func encode(to encoder: Encoder) throws { try _encode(encoder) }
}

extension JSONDecoder {
    static let isoDecoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}
