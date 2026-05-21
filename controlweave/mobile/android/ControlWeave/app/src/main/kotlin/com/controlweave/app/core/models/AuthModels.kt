package com.controlweave.app.core.models

data class LoginData(
    val accessToken: String,
    val refreshToken: String,
    val user: User,
    val organization: Organization
)

data class User(
    val id: String,
    val email: String,
    val firstName: String?,
    val lastName: String?,
    val role: String
) {
    val displayName: String
        get() = listOfNotNull(firstName, lastName)
            .filter { it.isNotBlank() }
            .joinToString(" ")
            .ifBlank { email }
}

data class Organization(
    val id: String,
    val name: String,
    val tier: String,
    val billingStatus: String?
)
