package com.protocolopep.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Mass
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

@CapacitorPlugin(name = "PepHealthConnect")
class PepHealthConnectPlugin : Plugin() {

    companion object {
        private const val HEALTH_CONNECT_PKG = "com.google.android.apps.healthdata"
        private val REQUIRED_PERMISSIONS = setOf(
            HealthPermission.getReadPermission(WeightRecord::class),
            HealthPermission.getWritePermission(WeightRecord::class)
        )
    }

    private fun getHealthClient(): HealthConnectClient? {
        val ctx = context ?: return null
        return try {
            if (HealthConnectClient.getSdkStatus(ctx, HEALTH_CONNECT_PKG) == HealthConnectClient.SDK_AVAILABLE) {
                HealthConnectClient.getOrCreate(ctx)
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    @PluginMethod
    fun checkAvailability(call: PluginCall) {
        val ret = JSObject()
        val ctx = context

        if (ctx == null) {
            ret.put("available", false)
            ret.put("status", "UNAVAILABLE")
            ret.put("message", "Contexto Android indisponível.")
            call.resolve(ret)
            return
        }

        try {
            val sdkStatus = HealthConnectClient.getSdkStatus(ctx, HEALTH_CONNECT_PKG)
            when (sdkStatus) {
                HealthConnectClient.SDK_AVAILABLE -> {
                    ret.put("available", true)
                    ret.put("status", "AVAILABLE")
                    ret.put("message", "Health Connect integrado e disponível.")
                }
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> {
                    ret.put("available", false)
                    ret.put("status", "UPDATE_REQUIRED")
                    ret.put("message", "O aplicativo Health Connect precisa ser atualizado.")
                }
                else -> {
                    ret.put("available", false)
                    ret.put("status", "UNAVAILABLE")
                    ret.put("message", "Health Connect não está disponível neste dispositivo.")
                }
            }
            call.resolve(ret)
        } catch (e: Exception) {
            ret.put("available", false)
            ret.put("status", "UNAVAILABLE")
            ret.put("message", "Erro ao verificar Health Connect: ${e.message}")
            call.resolve(ret)
        }
    }

    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        val client = getHealthClient()
        val ret = JSObject()

        if (client == null) {
            ret.put("granted", false)
            ret.put("status", "UNAVAILABLE")
            ret.put("reason", "Health Connect indisponível.")
            call.resolve(ret)
            return
        }

        try {
            runBlocking(Dispatchers.IO) {
                val granted = client.permissionController.getGrantedPermissions()
                val hasAll = REQUIRED_PERMISSIONS.all { it in granted }
                val hasAny = REQUIRED_PERMISSIONS.any { it in granted }

                if (hasAll) {
                    ret.put("granted", true)
                    ret.put("status", "CONNECTED")
                } else if (hasAny) {
                    ret.put("granted", false)
                    ret.put("status", "PARTIALLY_AUTHORIZED")
                } else {
                    ret.put("granted", false)
                    ret.put("status", "NOT_AUTHORIZED")
                }
                call.resolve(ret)
            }
        } catch (e: Exception) {
            ret.put("granted", false)
            ret.put("status", "ERROR")
            ret.put("reason", "Erro ao consultar permissões: ${e.message}")
            call.resolve(ret)
        }
    }

    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        val client = getHealthClient()
        val ret = JSObject()

        if (client == null) {
            ret.put("granted", false)
            ret.put("status", "UNAVAILABLE")
            ret.put("reason", "Health Connect indisponível.")
            call.resolve(ret)
            return
        }

        try {
            runBlocking(Dispatchers.IO) {
                val granted = client.permissionController.getGrantedPermissions()
                val hasAll = REQUIRED_PERMISSIONS.all { it in granted }

                if (hasAll) {
                    ret.put("granted", true)
                    ret.put("status", "CONNECTED")
                    call.resolve(ret)
                } else {
                    // Abre a tela de configurações/permissões do Health Connect
                    openSettingsInternal()
                    ret.put("granted", false)
                    ret.put("status", "NOT_AUTHORIZED")
                    ret.put("reason", "Permissões pendentes no Health Connect.")
                    call.resolve(ret)
                }
            }
        } catch (e: Exception) {
            ret.put("granted", false)
            ret.put("status", "ERROR")
            ret.put("reason", "Erro ao verificar permissões: ${e.message}")
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        val success = openSettingsInternal()
        if (success) {
            call.resolve()
        } else {
            call.reject("Não foi possível abrir as configurações do Health Connect.")
        }
    }

    private fun openSettingsInternal(): Boolean {
        val ctx = context ?: return false
        return try {
            val intent = Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            if (intent.resolveActivity(ctx.packageManager) != null) {
                ctx.startActivity(intent)
                return true
            }

            val playStoreIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("market://details?id=$HEALTH_CONNECT_PKG")
            ).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            if (playStoreIntent.resolveActivity(ctx.packageManager) != null) {
                ctx.startActivity(playStoreIntent)
                return true
            }

            val webIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("https://play.google.com/store/apps/details?id=$HEALTH_CONNECT_PKG")
            ).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            ctx.startActivity(webIntent)
            true
        } catch (e: Exception) {
            false
        }
    }

    @PluginMethod
    fun writeRecords(call: PluginCall) {
        val client = getHealthClient()
        if (client == null) {
            call.reject("Health Connect indisponível para gravação.")
            return
        }

        try {
            val recordsArray = call.getArray("records") ?: JSArray()
            val recordsToInsert = mutableListOf<WeightRecord>()
            val localZone = ZoneId.systemDefault()

            for (i in 0 until recordsArray.length()) {
                val obj = recordsArray.getJSONObject(i) ?: continue
                val weightKg = obj.optDouble("weightKg", obj.optDouble("weight", 0.0))
                if (weightKg <= 0.0) continue

                val dateStr = obj.optString("date", "")
                val timeStr = obj.optString("time", "12:00")
                
                val instant = try {
                    if (obj.has("timestamp") && obj.getString("timestamp").isNotEmpty()) {
                        Instant.parse(obj.getString("timestamp"))
                    } else if (obj.has("time") && obj.getString("time").contains("T")) {
                        Instant.parse(obj.getString("time"))
                    } else if (dateStr.isNotEmpty()) {
                        val safeTime = if (timeStr.length == 5) "$timeStr:00" else timeStr
                        // Converte a partir de componentes locais do dispositivo
                        val zdt = ZonedDateTime.parse("${dateStr}T${safeTime}", DateTimeFormatter.ISO_LOCAL_DATE_TIME.withZone(localZone))
                        zdt.toInstant()
                    } else {
                        Instant.now()
                    }
                } catch (e: Exception) {
                    Instant.now()
                }

                val clientRecordId = obj.optString("clientRecordId", obj.optString("metadataId", obj.optString("id", "")))
                val zoneOffset = localZone.rules.getOffset(instant)

                val metadata = if (clientRecordId.isNotEmpty()) {
                    Metadata(clientRecordId = clientRecordId)
                } else {
                    Metadata()
                }

                val weightRecord = WeightRecord(
                    weight = Mass.kilograms(weightKg),
                    time = instant,
                    zoneOffset = zoneOffset,
                    metadata = metadata
                )
                recordsToInsert.add(weightRecord)
            }

            if (recordsToInsert.isNotEmpty()) {
                runBlocking(Dispatchers.IO) {
                    client.insertRecords(recordsToInsert)
                }
            }

            val ret = JSObject().apply {
                put("success", true)
                put("count", recordsToInsert.size)
            }
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Erro ao gravar no Health Connect: ${e.message}")
        }
    }

    @PluginMethod
    fun readRecords(call: PluginCall) {
        val client = getHealthClient()
        if (client == null) {
            val ret = JSObject().apply {
                put("records", JSArray())
            }
            call.resolve(ret)
            return
        }

        try {
            val startTimeStr = call.getString("startTime")
            val endTimeStr = call.getString("endTime")

            val startInstant = try {
                if (!startTimeStr.isNullOrEmpty()) Instant.parse(startTimeStr)
                else Instant.now().minusSeconds(90L * 24 * 3600)
            } catch (e: Exception) {
                Instant.now().minusSeconds(90L * 24 * 3600)
            }

            val endInstant = try {
                if (!endTimeStr.isNullOrEmpty()) Instant.parse(endTimeStr)
                else Instant.now()
            } catch (e: Exception) {
                Instant.now()
            }

            val resultList = mutableListOf<JSONObject>()
            val localZone = ZoneId.systemDefault()

            runBlocking(Dispatchers.IO) {
                val response = client.readRecords(
                    ReadRecordsRequest(
                        recordType = WeightRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(startInstant, endInstant)
                    )
                )

                for (record in response.records) {
                    val weightKg = record.weight.inKilograms
                    val zdt = record.time.atZone(localZone)
                    val dateStr = zdt.format(DateTimeFormatter.ISO_LOCAL_DATE)
                    val timeStr = zdt.format(DateTimeFormatter.ofPattern("HH:mm"))
                    val timestampStr = record.time.toString()

                    val clientRecId = record.metadata.clientRecordId ?: record.metadata.id

                    val item = JSONObject().apply {
                        put("id", record.metadata.id)
                        put("clientRecordId", clientRecId)
                        put("metadataId", record.metadata.id)
                        put("timestamp", timestampStr)
                        put("time", timestampStr)
                        put("date", dateStr)
                        put("localTime", timeStr)
                        put("weight", weightKg)
                        put("weightKg", weightKg)
                        put("unit", "kg")
                        put("source", "health_connect")
                    }
                    resultList.add(item)
                }
            }

            val jsArray = JSArray()
            resultList.forEach { jsArray.put(it) }

            val ret = JSObject().apply {
                put("records", jsArray)
            }
            call.resolve(ret)
        } catch (e: Exception) {
            val ret = JSObject().apply {
                put("records", JSArray())
            }
            call.resolve(ret)
        }
    }
}
