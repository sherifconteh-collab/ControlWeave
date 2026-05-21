import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authState: AuthState
    @StateObject private var viewModel = LoginViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()

                Text("ControlWeave")
                    .font(.largeTitle.bold())
                Text("GRC Platform")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Spacer()

                VStack(spacing: 16) {
                    TextField("Email", text: $viewModel.email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .textFieldStyle(.roundedBorder)

                    SecureField("Password", text: $viewModel.password)
                        .textContentType(.password)
                        .textFieldStyle(.roundedBorder)

                    if viewModel.showTOTP {
                        TextField("Authenticator code", text: $viewModel.totpCode)
                            .keyboardType(.numberPad)
                            .textFieldStyle(.roundedBorder)
                    }

                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                    }

                    Button(action: { Task { await viewModel.login(authState: authState) } }) {
                        if viewModel.isLoading {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text("Sign In")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(viewModel.isLoading || viewModel.email.isEmpty || viewModel.password.isEmpty)
                }
                .padding(.horizontal)

                Spacer()
            }
            .navigationTitle("")
            .navigationBarHidden(true)
        }
    }
}

@MainActor
final class LoginViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var totpCode = ""
    @Published var showTOTP = false
    @Published var isLoading = false
    @Published var errorMessage: String?

    func login(authState: AuthState) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let data = try await AuthService.shared.login(
                email: email,
                password: password,
                totpToken: showTOTP ? totpCode : nil
            )
            authState.user = data.user
            authState.organization = data.organization
            authState.isAuthenticated = true
        } catch LoginError.requiresTOTP {
            showTOTP = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
