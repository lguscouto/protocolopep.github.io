package com.protocolopep.app

import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.testing.FakeHealthConnectClient
import androidx.health.connect.client.testing.FakePermissionController
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

class HealthConnectTest {

    @Test
    fun mapperCreatesRealWeightRecordWithStableMetadataFactory() {
        val record = PepHealthConnectMapper.createWeightRecord(
            weightKg = 82.5,
            timestamp = "2026-01-15T13:00:00Z",
            clientRecordId = "pep-weight-1",
            clientRecordVersion = 4L,
            zoneOffset = "-03:00"
        )

        assertEquals(82.5, record.weight.inKilograms, 0.001)
        assertEquals("pep-weight-1", record.metadata.clientRecordId)
        assertEquals(4L, record.metadata.clientRecordVersion)
        assertEquals(ZoneOffset.of("-03:00"), record.zoneOffset)
    }

    @Test
    fun mapperPreservesHistoricalOffsetWhenDeviceZoneChanges() {
        val record = PepHealthConnectMapper.createWeightRecord(
            weightKg = 81.2,
            timestamp = "2026-08-29T11:00:00Z",
            clientRecordId = "pep-weight-2",
            clientRecordVersion = 1L,
            zoneOffset = "-03:00"
        )

        val payload = PepHealthConnectMapper.toPayload(record, ZoneId.of("Asia/Tokyo"))

        assertEquals("2026-08-29", payload.date)
        assertEquals("08:00", payload.localTime)
        assertEquals("-03:00", payload.zoneOffset)
        assertEquals("2026-08-29T11:00:00Z", payload.timestamp)
        assertEquals(record.metadata.lastModifiedTime.toString(), payload.lastModifiedTime)
    }

    @Test
    fun mapperRejectsInvalidPayload() {
        assertThrows(IllegalArgumentException::class.java) {
            PepHealthConnectMapper.createWeightRecord(
                weightKg = 0.0,
                timestamp = "2026-08-29T11:00:00Z",
                clientRecordId = "invalid",
                clientRecordVersion = 1L,
                zoneOffset = "-03:00"
            )
        }
        assertThrows(Exception::class.java) {
            PepHealthConnectMapper.createWeightRecord(
                weightKg = 80.0,
                timestamp = "not-an-instant",
                clientRecordId = "invalid",
                clientRecordVersion = 1L,
                zoneOffset = "-03:00"
            )
        }
    }

    @Test
    fun ownershipUsesOnlyDataOrigin() {
        assertEquals("pep", PepHealthConnectMapper.ownershipForOrigin(PepHealthConnectMapper.PEP_PACKAGE))
        assertEquals("external", PepHealthConnectMapper.ownershipForOrigin("com.sec.android.app.shealth"))
    }

    @Test
    fun fakeClientCoversInsertReadVersionedUpdateAndDelete() = runBlocking {
        val permissions = FakePermissionController(grantAll = true)
        val client = FakeHealthConnectClient(
            packageName = PepHealthConnectMapper.PEP_PACKAGE,
            clock = Clock.fixed(Instant.parse("2026-09-01T12:00:00Z"), ZoneOffset.UTC),
            permissionController = permissions
        )
        val version1 = PepHealthConnectMapper.createWeightRecord(
            weightKg = 80.0,
            timestamp = "2026-09-01T11:00:00Z",
            clientRecordId = "pep-versioned-record",
            clientRecordVersion = 1L,
            zoneOffset = "-03:00"
        )
        val version2 = PepHealthConnectMapper.createWeightRecord(
            weightKg = 79.5,
            timestamp = "2026-09-01T11:00:00Z",
            clientRecordId = "pep-versioned-record",
            clientRecordVersion = 2L,
            zoneOffset = "-03:00"
        )

        client.insertRecords(listOf(version1))
        client.insertRecords(listOf(version2))

        val request = ReadRecordsRequest(
            recordType = WeightRecord::class,
            timeRangeFilter = TimeRangeFilter.between(
                Instant.parse("2026-09-01T00:00:00Z"),
                Instant.parse("2026-09-02T00:00:00Z")
            )
        )
        val stored = client.readRecords(request).records
        assertEquals(1, stored.size)
        val storedRecord = stored.single()
        assertEquals(79.5, storedRecord.weight.inKilograms, 0.001)
        assertEquals(2L, storedRecord.metadata.clientRecordVersion)
        assertEquals(
            storedRecord.metadata.lastModifiedTime.toString(),
            PepHealthConnectMapper.toPayload(storedRecord).lastModifiedTime
        )

        client.deleteRecords(
            WeightRecord::class,
            recordIdsList = listOf(storedRecord.metadata.id),
            clientRecordIdsList = emptyList()
        )
        assertTrue(client.readRecords(request).records.isEmpty())

        client.insertRecords(listOf(version2))

        client.deleteRecords(
            WeightRecord::class,
            recordIdsList = emptyList(),
            clientRecordIdsList = listOf("pep-versioned-record")
        )
        assertTrue(client.readRecords(request).records.isEmpty())
    }
}
