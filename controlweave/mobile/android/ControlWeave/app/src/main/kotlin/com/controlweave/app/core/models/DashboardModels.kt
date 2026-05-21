package com.controlweave.app.core.models

data class DashboardStats(
    val totalControls: Int,
    val implementedControls: Int,
    val complianceScore: Double,
    val frameworkBreakdown: List<FrameworkBreakdown>?,
    val openFindings: Int?,
    val overdueItems: Int?
)

data class FrameworkBreakdown(
    val id: String,
    val name: String,
    val shortName: String?,
    val complianceScore: Double,
    val totalControls: Int,
    val implementedControls: Int
)
