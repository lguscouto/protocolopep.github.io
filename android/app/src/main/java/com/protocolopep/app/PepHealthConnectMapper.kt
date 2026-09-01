package com.protocolopep.app

import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.units.Mass
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

data class PepWeightRecordPayload(
    val id: String,
    val healthConnectRecordId: String,
    val clientRecordId: String,
    val clientRecordVersion: Long,
    val dataOrigin: String,
    val zoneOffset: String,
    val timestamp: String,
    val date: String,
    val localTime: String,
    val weightKg: Double,
    val ownership: String
)

object PepHealthConnectMapper {
    const val PEP_PACKAGE = "com.protocolopep.app"

    fun ownershipForOrigin(originPackage: String): String =
        if (originPackage == PEP_PACKAGE) "pep" else "external"

    fun createWeightRecord(
        weightKg: Double,
        timestamp: String,
        clientRecordId: String,
        clientRecordVersion: Long,
        zoneOffset: String?,
        fallbackZone: ZoneId = ZoneId.systemDefault()
    ): WeightRecord {
        require(weightKg > 0.0 && weightKg.isFinite()) { "Peso deve ser maior que zero." }
        val instant = Instant.parse(timestamp)
        val resolvedOffset = if (!zoneOffset.isNullOrBlank()) {
            ZoneOffset.of(zoneOffset)
        } else {
            fallbackZone.rules.getOffset(instant)
        }
        val safeVersion = clientRecordVersion.coerceAtLeast(1L)
        val metadata = if (clientRecordId.isNotBlank()) {
            Metadata.manualEntry(
                clientRecordId = clientRecordId,
                clientRecordVersion = safeVersion,
                device = null
            )
        } else {
            Metadata.manualEntry(device = null)
        }

        return WeightRecord(
            weight = Mass.kilograms(weightKg),
            time = instant,
            zoneOffset = resolvedOffset,
            metadata = metadata
        )
    }

    fun toPayload(record: WeightRecord, fallbackZone: ZoneId = ZoneId.systemDefault()): PepWeightRecordPayload {
        val offset = record.zoneOffset
        val date: String
        val localTime: String
        if (offset != null) {
            val local = record.time.atOffset(offset)
            date = local.format(DateTimeFormatter.ISO_LOCAL_DATE)
            localTime = local.format(DateTimeFormatter.ofPattern("HH:mm"))
        } else {
            val local = record.time.atZone(fallbackZone)
            date = local.format(DateTimeFormatter.ISO_LOCAL_DATE)
            localTime = local.format(DateTimeFormatter.ofPattern("HH:mm"))
        }

        val originPackage = record.metadata.dataOrigin.packageName
        val recordId = record.metadata.id
        return PepWeightRecordPayload(
            id = recordId,
            healthConnectRecordId = recordId,
            clientRecordId = record.metadata.clientRecordId ?: "",
            clientRecordVersion = record.metadata.clientRecordVersion,
            dataOrigin = originPackage,
            zoneOffset = offset?.toString() ?: "",
            timestamp = record.time.toString(),
            date = date,
            localTime = localTime,
            weightKg = record.weight.inKilograms,
            ownership = ownershipForOrigin(originPackage)
        )
    }
}
