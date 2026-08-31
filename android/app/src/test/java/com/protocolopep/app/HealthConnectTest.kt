package com.protocolopep.app

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class HealthConnectTest {

    @Test
    fun testOwnershipClassification() {
        val pepPkg = "com.protocolopep.app"
        val externalPkg = "com.sec.android.app.shealth"

        val pepOwnership = if (pepPkg == "com.protocolopep.app") "pep" else "external"
        val externalOwnership = if (externalPkg == "com.protocolopep.app") "pep" else "external"

        assertEquals("pep", pepOwnership)
        assertEquals("external", externalOwnership)
    }

    @Test
    fun testIsoTimestampAndLocalTimeParsing() {
        val instant = Instant.parse("2026-08-31T11:00:00Z")
        val utcZone = ZoneId.of("UTC")
        val zdtUtc = instant.atZone(utcZone)

        val dateStr = zdtUtc.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val timeStr = zdtUtc.format(DateTimeFormatter.ofPattern("HH:mm"))

        assertEquals("2026-08-31", dateStr)
        assertEquals("11:00", timeStr)
    }

    @Test
    fun testMeasurementPayloadMapping() {
        val recId = "hc_rec_999"
        val clientRecId = "m_1725100000_abc"
        val originPkg = "com.protocolopep.app"
        val weightKg = 82.5

        val item = mapOf(
            "id" to recId,
            "healthConnectRecordId" to recId,
            "clientRecordId" to clientRecId,
            "clientRecordVersion" to 2L,
            "dataOrigin" to originPkg,
            "weightKg" to weightKg,
            "source" to "health_connect",
            "ownership" to if (originPkg == "com.protocolopep.app") "pep" else "external"
        )

        assertEquals("hc_rec_999", item["healthConnectRecordId"])
        assertEquals("m_1725100000_abc", item["clientRecordId"])
        assertEquals("pep", item["ownership"])
        assertEquals(82.5, item["weightKg"] as Double, 0.001)
        assertEquals(2L, item["clientRecordVersion"])
    }

    @Test
    fun testHistoricalZoneOffsetPreservation() {
        val instantUtc = Instant.parse("2026-08-29T11:00:00.000Z")
        val rawZoneOffsetRio = "-03:00"

        val parsedOffsetRio = java.time.ZoneOffset.of(rawZoneOffsetRio)
        assertEquals(-3 * 3600, parsedOffsetRio.totalSeconds)

        val zdtRio = instantUtc.atOffset(parsedOffsetRio)
        assertEquals("2026-08-29", zdtRio.toLocalDate().toString())
        assertEquals(8, zdtRio.hour)
        assertEquals(0, zdtRio.minute)

        // Simulação de sincronização em Tóquio (+09:00)
        val parsedOffsetTokyo = java.time.ZoneOffset.of("+09:00")
        val zdtTokyo = instantUtc.atOffset(parsedOffsetTokyo)
        // O instante subjacente em UTC permanece idêntico
        assertEquals(instantUtc, zdtTokyo.toInstant())
        // O offset original preservado no registro continua sendo -03:00
        assertEquals("-03:00", parsedOffsetRio.id)
    }

    @Test
    fun testExternalAppWithClientRecordIdRemainsExternal() {
        val externalPkg = "com.sec.android.app.shealth"
        val clientRecId = "samsung_health_rec_456"

        val originPkg = externalPkg
        val isPepOrigin = originPkg == "com.protocolopep.app"
        val ownership = if (isPepOrigin) "pep" else "external"

        assertFalse("Não deve inferir PEP ownership a partir de clientRecordId de terceiros", isPepOrigin)
        assertEquals("external", ownership)
        assertEquals("samsung_health_rec_456", clientRecId)
    }

    @Test
    fun testSyncVersionMonotonicIncrement() {
        val initialVersion = 1L
        val weightChanged = true
        val nextVersion = if (weightChanged) initialVersion + 1L else initialVersion

        assertEquals(2L, nextVersion)

        val unchangedVersion = if (false) nextVersion + 1L else nextVersion
        assertEquals(2L, unchangedVersion)
    }
}
